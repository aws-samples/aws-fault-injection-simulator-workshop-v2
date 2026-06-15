import json
import logging
import os
import ssl
import time
import urllib.request
import psycopg2
import config
import repository
from flask import Flask, jsonify, request, g

# Setup flask app
app = Flask(__name__)


def _resolve_az_from_node_label():
    """On EKS, read this pod's node's topology.kubernetes.io/zone label via the
    in-cluster Kubernetes API. IMDS is not reachable from pods on this cluster,
    so the node label is the reliable AZ source. NODE_NAME is injected via the
    downward API; the pod's ServiceAccount needs RBAC 'get nodes'. Best-effort:
    returns '' on any failure (ranking then falls back to node)."""
    node = os.getenv('NODE_NAME')
    host = os.getenv('KUBERNETES_SERVICE_HOST')
    if not node or not host:
        return ''
    port = os.getenv('KUBERNETES_SERVICE_PORT', '443')
    sa = '/var/run/secrets/kubernetes.io/serviceaccount'
    try:
        with open(sa + '/token') as f:
            token = f.read().strip()
        ctx = ssl.create_default_context(cafile=sa + '/ca.crt')
        req = urllib.request.Request(
            'https://{}:{}/api/v1/nodes/{}'.format(host, port, node),
            headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(req, timeout=2, context=ctx) as resp:
            labels = json.loads(resp.read().decode()).get('metadata', {}).get('labels', {})
            return labels.get('topology.kubernetes.io/zone', '')
    except Exception:
        return ''


def _resolve_availability_zone():
    """Best-effort AZ lookup; never raises. Order: explicit env, ECS Task
    Metadata v4, then (on EKS) the node's topology.kubernetes.io/zone label."""
    az = os.getenv('AWS_AVAILABILITY_ZONE')
    if az:
        return az
    uri = os.getenv('ECS_CONTAINER_METADATA_URI_V4')
    if uri:
        try:
            with urllib.request.urlopen(uri + '/task', timeout=2) as resp:
                az = json.loads(resp.read().decode()).get('AvailabilityZone', '')
                if az:
                    return az
        except Exception:
            pass
    return _resolve_az_from_node_label()


# Location context, resolved once at startup, attached to every log line so that
# errors / latency can be attributed to a specific service, AZ and host/node
# during FIS experiments (AZ power interruption, instance termination).
CONTEXT = {
    'service': os.getenv('SERVICE_NAME', 'petadoptionshistory'),
    'az': _resolve_availability_zone(),
    'node': os.getenv('NODE_NAME', ''),
    'instance': os.getenv('POD_NAME') or os.getenv('HOSTNAME', ''),
}

logging.basicConfig(level=int(os.getenv('LOG_LEVEL', 20)), format='%(message)s')
logger = logging.getLogger()


def _log(level, event, **fields):
    record = {'level': logging.getLevelName(level), 'event': event}
    record.update(CONTEXT)
    record.update(fields)
    logger.log(level, json.dumps(record))


cfg = config.fetch_config()
conn_params = config.get_rds_connection_parameters(cfg['rds_secret_arn'], cfg['region'])
db = psycopg2.connect(**conn_params)


@app.before_request
def _start_timer():
    g._start = time.time()


@app.after_request
def _log_request(response):
    latency_ms = int((time.time() - getattr(g, '_start', time.time())) * 1000)
    # bytes + err included for field parity with the other PetAdoptions services
    # so one set of Contributor Insights rules works across all of them.
    _log(logging.INFO, 'request', method=request.method, path=request.path,
         status=response.status_code, latency_ms=latency_ms,
         bytes=response.calculate_content_length(), err='')
    return response


@app.route('/petadoptionshistory/api/home/transactions', methods=['GET'])
def transactions_get():
    try:
        transactions = repository.list_transaction_history(db)
        return jsonify(transactions)
    except Exception as e:
        _log(logging.ERROR, 'error', op='list_transaction_history', error=str(e))
        raise


@app.route('/petadoptionshistory/api/home/transactions', methods=['DELETE'])
def transactions_delete():
    try:
        repository.delete_transaction_history(db)
        return jsonify(success=True)
    except Exception as e:
        _log(logging.ERROR, 'error', op='delete_transaction_history', error=str(e))
        raise


@app.route('/health/status')
def status_path():
    try:
        repository.check_alive(db)
        return jsonify(success=True)
    except Exception as e:
        _log(logging.ERROR, 'error', op='check_alive', error=str(e))
        raise