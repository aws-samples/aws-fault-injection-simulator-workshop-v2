import json
import logging
import os
import random
import ssl
import time
import urllib.request
import boto3
from aws_xray_sdk.ext.flask.middleware import XRayMiddleware
from aws_xray_sdk.core import patch_all, xray_recorder
from flask import Flask, request, g

app = Flask(__name__)
plugins = ('EC2Plugin',)
xray_recorder.configure(plugins=plugins, service='petfood')
patch_all()
XRayMiddleware(app, xray_recorder)
xray_recorder.begin_segment('petfood')


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
    'service': os.getenv('SERVICE_NAME', 'petfood'),
    'az': _resolve_availability_zone(),
    'node': os.getenv('NODE_NAME', ''),
    'instance': os.getenv('POD_NAME') or os.getenv('HOSTNAME', ''),
}

# Use the root logger (not getLogger(__name__)): Flask names its app.logger after
# the import name ('petfood'), so getLogger(__name__) would share that logger and
# emit each line twice (Flask's handler + root). The reference (petadoptionshistory)
# uses the root logger for the same reason.
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
        self.upsell_feature = 'petfood-upsell'
        self.upsell_text_feature = 'petfood-upsell-text'

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

    @xray_recorder.capture('evidently_get_upsell_evaluation')
    def get_upsell_evaluation(self, entity_id):
        """Gets the feature evaluation for petfood-upsell"""
        try:
            response = self.client.evaluate_feature(
                entityId=entity_id,
                feature=self.upsell_feature,
                project=self.project
            )
            return {
                'feature_enabled': response['value']['boolValue'],
                'variation': response['variation']
            }
        except self.client.exceptions.ResourceNotFoundException:
            logger.warning("Evidently feature '%s' not found for project '%s'", self.upsell_feature, self.project)
            return return_default()

    @xray_recorder.capture('evidently_get_upsell_text')
    def get_upsell_text(self, entity_id):
        """Gets the feature evaluation for petfood-upsell-verbiage"""
        try:
            response = self.client.evaluate_feature(
                entityId=entity_id,
                feature=self.upsell_text_feature,
                project=self.project
            )
            logger.info("Evidently feature '%s': %s", self.upsell_text_feature, response['value']['stringValue'])
            return response['value']['stringValue']
        except self.client.exceptions.ResourceNotFoundException:
            logger.warning("Evidently feature '%s' not found for project '%s'", self.upsell_text_feature, self.project)
            return 'Error getting upsell message - check that your feature exists in Evidently!'

@xray_recorder.capture('return_evidently_response')
def return_evidently_response(evidently):
    """Create a response using an Evidently project"""
    logger.info("Building Evidently response")
    entity_id = str(random.randint(1, 100))
    evaluation = evidently.get_upsell_evaluation(entity_id)
    logger.warning("Response from feature evaluation: %s", evaluation)
    return json.dumps({
        'statusCode': 200,
        'message': evidently.get_upsell_text(entity_id),
        'variation': evaluation,
        'entityId': entity_id
    })

@xray_recorder.capture('return_default_response')
def return_default():
    """Returns the default response to the user"""
    logger.warning("Returning default response to the user")
    return json.dumps({
        'message': 'Thank you for supporting our community!',
        'statusCode': 200
    })

@app.route('/')
def root_path():
    """Base URL for our handler"""
    logger.info("Raw request headers: %s", request.headers)
    evidently = EvidentlyProject()
    if not evidently.project_exists():
        return return_default()
    else:
        return return_evidently_response(evidently)

@app.route('/status')
def status_path():
    """Used for health checks"""
    logger.info("Raw request headers: %s", request.headers)
    return json.dumps({'statusCode': 200, 'body': 'ok'})
