import boto3
import logging
from datetime import datetime

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_asg_distribution():
    asg_client = boto3.client('autoscaling')
    asg_distributions = []

    try:
        # Get list of all Auto Scaling groups
        paginator = asg_client.get_paginator('describe_auto_scaling_groups')
        logger.info("Starting to collect Auto Scaling group information")

        for page in paginator.paginate():
            for asg in page['AutoScalingGroups']:
                asg_name = asg['AutoScalingGroupName']
                logger.info(f"Processing Auto Scaling group: {asg_name}")

                # Initialize AZ distribution counter
                az_distribution = {}

                # Count instances per AZ
                for instance in asg['Instances']:
                    if 'AvailabilityZone' in instance:
                        az = instance['AvailabilityZone']

                logger.info(f"ASG {asg_name} instance distribution: {az_distribution}")

                # Get additional ASG information
                asg_distributions.append({
                    'asg_name': asg_name,
                    'az_distribution': az_distribution,
                    'desired_capacity': asg['DesiredCapacity'],
                    'min_size': asg['MinSize'],
                    'max_size': asg['MaxSize']
                })

        logger.info(f"Found {len(asg_distributions)} Auto Scaling groups")
        return asg_distributions

    except Exception as e:
        logger.error(f"Error collecting ASG information: {str(e)}", exc_info=True)
        raise

def send_metrics_to_cloudwatch(asg_distributions):
    """
    Send metrics to CloudWatch
    """
    cloudwatch = boto3.client('cloudwatch')
    
    logger.info(f"Starting to send metrics to CloudWatch for {len(asg_distributions)} Auto Scaling groups")

    try:
        for asg in asg_distributions:
            # Send instance distribution metrics
            for az, instance_count in asg['az_distribution'].items():
                logger.debug(f"Sending metric for ASG {asg['asg_name']}, AZ {az}, count {instance_count}")
                
                cloudwatch.put_metric_data(
                    Namespace='AutoScalingDistribution',
                    MetricData=[{
                        'MetricName': 'InstanceCount',
                        'Value': instance_count,
                        'Unit': 'Count',
                        'Timestamp': datetime.utcnow(),
                        'Dimensions': [{
                            'Name': 'AutoScalingGroupName',
                            'Value': asg['asg_name']
                        }, {
                            'Name': 'AvailabilityZone',
                            'Value': az
                        }]
                    }]
                )

            # Send capacity metrics
            capacity_metrics = {
                'DesiredCapacity': asg['desired_capacity'],
                'MinSize': asg['min_size'],
                'MaxSize': asg['max_size']
            }

            for metric_name, value in capacity_metrics.items():
                cloudwatch.put_metric_data(
                    Namespace='AutoScalingDistribution',
                    MetricData=[{
                        'MetricName': metric_name,
                        'Value': value,
                        'Unit': 'Count',
                        'Timestamp': datetime.utcnow(),
                        'Dimensions': [{
                            'Name': 'AutoScalingGroupName',
                            'Value': asg['asg_name']
                        }]
                    }]
                )

    except Exception as e:
        logger.error(f"Error sending metrics to CloudWatch: {str(e)}", exc_info=True)
        raise

def lambda_handler(event, context):
    """
    Main Lambda handler
    """
    logger.info(f"Starting Auto Scaling group distribution collection. Event: {event}")
    
    try:
        # Get ASG distribution information
        asg_distributions = get_asg_distribution()
        
        # Send metrics to CloudWatch
        send_metrics_to_cloudwatch(asg_distributions)
        
        logger.info("Successfully completed Auto Scaling group distribution collection")
        return {
            'statusCode': 200,
            'body': f'Successfully processed {len(asg_distributions)} Auto Scaling groups'
        }
        
    except Exception as e:
        logger.error(f"Error in lambda execution: {str(e)}", exc_info=True)
        raise
