import boto3
import time


def handler(event, context):
    client = boto3.client('ec2')

    time.sleep(10)
    pending_attachment_found = True
    start_time = time.time()

    while pending_attachment_found:
        query = client.describe_transit_gateway_peering_attachments(
            Filters=[{
                'Name': 'state',
                'Values': [
                    'pending',
                ]
            }])
        pending_attachment_found = len(
            query['TransitGatewayPeeringAttachments']) > 0

        if not pending_attachment_found:
            print("No pending acceptance found. Job is finished")
            return {
                'statusCode': 200,
                'body': 'No pending acceptance found. Job is finished'
            }

        # Check if 15 minutes have passed
        if time.time() - start_time > 900:  # 900 seconds = 15 minutes
            print("Timeout reached. Exiting.")
            return {
                'statusCode': 200,
                'body':
                'Timeout reached. Some attachments may still be pending.'
            }

        time.sleep(10)

    return {'statusCode': 200, 'body': 'Script completed successfully'}
