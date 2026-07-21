import json
import logging
import os
import ssl
import time
import urllib.request
import boto3
from aws_xray_sdk.ext.flask.middleware import XRayMiddleware
from aws_xray_sdk.core import patch_all, xray_recorder
from flask import Flask, request, g

app = Flask(__name__)
xray_recorder.configure(service='petfood-metric')
patch_all()
XRayMiddleware(app, xray_recorder)


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
# during FIS experiments. Mirrors the petadoptionshistory-py reference so all
# services emit the same top-level JSON fields for CloudWatch Contributor Insights.
CONTEXT = {
    'service': os.getenv('SERVICE_NAME', 'petfood-metric'),
    'az': _resolve_availability_zone(),
    'node': os.getenv('NODE_NAME', ''),
    'instance': os.getenv('POD_NAME') or os.getenv('HOSTNAME', ''),
}

# Use the root logger (not getLogger(__name__)): Flask names its app.logger after
# the import name, so getLogger(__name__) would share that logger and emit each
# line twice (Flask's handler + root). The reference (petadoptionshistory) uses
# the root logger for the same reason.
logging.basicConfig(level=int(os.getenv('LOG_LEVEL', 20)), format='%(message)s')
logger = logging.getLogger()


def _log(level, event, **fields):
    record = {'level': logging.getLevelName(level), 'event': event}
    record.update(CONTEXT)
    record.update(fields)
    logger.log(level, json.dumps(record))


@app.before_request
def _start_timer():
    g._start = time.time()


@app.after_request
def _log_request(response):
    latency_ms = int((time.time() - getattr(g, '_start', time.time())) * 1000)
    _log(logging.INFO, 'request', path=request.path, status=response.status_code,
         latency_ms=latency_ms, bytes=response.calculate_content_length(), err='')
    return response

class EvidentlyProject:
    """Base for all Evidently interactions"""

    def __init__(self):
        self.client = boto3.client('evidently')
        self.project = os.getenv('EVIDENTLY_PROJECT', 'petfood')

    @xray_recorder.capture('evidently_project_exists')
    def project_exists(self):
        """Returns False if the project does not currently exist"""
        try:
            self.client.get_project(project=self.project)
            logger.info("Evidently project '%s' found", self.project)
            return True
        except self.client.exceptions.ResourceNotFoundException:
            logger.warning("Evidently project '%s' not found", self.project)
            return False

    @xray_recorder.capture('evidently_put_metric')
    def put_metric(self, entity_id, value):
        """Puts metric into Evidently"""
        data = json.dumps({
            'userDetails': {'entityId': entity_id},
            'details': {'donation': value}
        })
        response = self.client.put_project_events(
            events=[{
                'timestamp': time.time(),
                'data': data,
                'type': 'aws.evidently.custom'
            }],
            project=self.project
        )
        logger.warning("Response to put_metric call: %s", response)

@app.route('/metric/<entity_id>/<value>')
def root_path(entity_id, value):
    """Base URL for our handler"""
    logger.info("Raw request headers: %s", request.headers)
    xray_recorder.begin_segment('petfood-metric')
    evidently = EvidentlyProject()
    if not evidently.project_exists():
        xray_recorder.end_segment()
        return json.dumps({'statusCode': 404, 'body': 'Evidently project not found'})
    evidently.put_metric(entity_id, float(value))
    xray_recorder.end_segment()
    return json.dumps('ok')

@app.route('/status')
def status_path():
    """Used for health checks"""
    logger.info("Raw request headers: %s", request.headers)
    return json.dumps({'statusCode': 200, 'body': 'ok'})
