import boto3
import json
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    s3_client = boto3.client('s3')
    
    # Extract parameters from the event payload
    s3_bucket_arn_primary = event['s3BucketARNPrimary']
    s3_bucket_arn_secondary = event['s3BucketARNSecondary']
    s3_replication_role_arn = event['s3ReplicationRoleARN']
    
    # Log the extracted values
    logger.info(f"Primary Bucket ARN: {s3_bucket_arn_primary}")
    logger.info(f"Secondary Bucket ARN: {s3_bucket_arn_secondary}")
    logger.info(f"Replication Role ARN: {s3_replication_role_arn}")


    # Extract bucket names from ARNs
    primary_bucket = s3_bucket_arn_primary.split(':')[-1]
    secondary_bucket = s3_bucket_arn_secondary.split(':')[-1]
    # Log the extracted bucket names
    logger.info(f"Primary Bucket Name: {primary_bucket}")
    logger.info(f"Secondary Bucket Name: {secondary_bucket}")
    
    
    # Set up replication configuration
    replication_config = {
        'Role': s3_replication_role_arn,
        'Rules': [
            {
                'ID': 'ReplicationRule',
                'Status': 'Enabled',
                'Priority': 1,
                'DeleteMarkerReplication': { 'Status': 'Disabled' },
                'Filter': { 'Prefix': '' },
                'Destination': {
                    'Bucket': s3_bucket_arn_secondary,
                    'Metrics': {
                        'Status': 'Enabled',
                        'EventThreshold': { 'Minutes': 15 }
                    },
                    'ReplicationTime': {
                        'Status': 'Enabled',
                        'Time': { 'Minutes': 15 }
                    }
                }
            }
        ]
    }
    
    # Apply replication configuration
    try:
        s3_client.put_bucket_replication(
            Bucket=primary_bucket,
            ReplicationConfiguration=replication_config
        )
        logger.info("S3 replication set up successfully")
        return {
            'statusCode': 200,
            'body': json.dumps('S3 replication set up successfully')
        }
    except Exception as e:
        error_message = f'Error setting up S3 replication: {str(e)}'
        logger.error(error_message)
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error setting up S3 replication: {str(e)}')
        }
