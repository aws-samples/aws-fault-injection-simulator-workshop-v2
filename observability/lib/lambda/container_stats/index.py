import boto3
import time
from datetime import datetime
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_ecs_cluster_info():
    ecs_client = boto3.client('ecs')
    clusters_info = []
    
    logger.info("Starting ECS cluster information collection")
    
    # Get list of ECS clusters
    paginator = ecs_client.get_paginator('list_clusters')
    for page in paginator.paginate():
        cluster_arns = page['clusterArns']
        logger.info(f"Found {len(cluster_arns)} ECS clusters")
        
        for cluster_arn in cluster_arns:
            # Get cluster name from ARN
            cluster_name = cluster_arn.split('/')[1]
            logger.info(f"Processing ECS cluster: {cluster_name}")
            
            # Get tasks in the cluster
            tasks_paginator = ecs_client.get_paginator('list_tasks')
            tasks = []
            for task_page in tasks_paginator.paginate(cluster=cluster_arn):
                tasks.extend(task_page['taskArns'])
            
            logger.info(f"Found {len(tasks)} tasks in cluster {cluster_name}")
            
            if tasks:
                # Get task details including AZ information
                az_count = {}
                for i in range(0, len(tasks), 100):  # Process in batches of 100
                    batch = tasks[i:i + 100]
                    logger.debug(f"Processing batch of {len(batch)} tasks")
                    task_details = ecs_client.describe_tasks(cluster=cluster_arn, tasks=batch)
                    
                    for task in task_details['tasks']:
                        # Get the AZ where the task is running
                        for container in task.get('containers', []):
                            for eni in container.get('networkInterfaces', []):
                                if 'availabilityZone' in eni:
                                    az = eni['availabilityZone']
                                    a                                    logger.debug(f"Added container in AZ {az}")
            
                logger.info(f"Cluster {cluster_name} container distribution: {az_count}")
                clusters_info.append({
                    'cluster_name': cluster_name,
                    'type': 'ECS',
                    'az_distribution': az_count
                })
    
    return clusters_info

def get_eks_cluster_info():
    eks_client = boto3.client('eks')
    ec2_client = boto3.client('ec2')
    clusters_info = []
    
    logger.info("Starting EKS cluster information collection")
    
    try:
        # Get list of EKS clusters
        paginator = eks_client.get_paginator('list_clusters')
        for page in paginator.paginate():
            cluster_names = page['clusters']
            logger.info(f"Found {len(cluster_names)} EKS clusters")
            
            for cluster_name in cluster_names:
                logger.info(f"Processing EKS cluster: {cluster_name}")
                
                # Get cluster details
                cluster = eks_client.describe_cluster(name=cluster_name)['cluster']
                
                # Get ENIs associated with the cluster's VPC
                paginator = ec2_client.get_paginator('describe_network_interfaces')
                az_count = {}
                
                # Filter for pod ENIs
                for page in paginator.paginate(
                    Filters=[
                        {'Name': 'vpc-id', 'Values': [vpc_id]},
                        {'Name': 'description', 'Values': ['*amazon-k8s*']},
                        {'Name': 'status', 'Values': ['in-use']}
                    ]
                ):
                    for eni in page['NetworkInterfaces']:
                        az = eni['AvailabilityZone']
                        # Each ENI typically represents one pod
                        logger.debug(f"Added pod in AZ {az}")
                
                logger.info(f"Cluster {cluster_name} pod distribution: {az_count}")
                clusters_info.append({
                    'cluster_name': cluster_name,
                    'type': 'EKS',
                    'az_distribution': az_count
                })
    
    except Exception as e:
        logger.error(f"Error collecting EKS information: {str(e)}", exc_info=True)
        raise
    
    return clusters_info

def send_metrics_to_cloudwatch(clusters_info):
    cloudwatch = boto3.client('cloudwatch')
    
    logger.info(f"Starting to send metrics to CloudWatch for {len(clusters_info)} clusters")
    
    for cluster in clusters_info:
        for az, container_count in cluster['az_distribution'].items():
            logger.info(f"Sending metric for cluster {cluster['cluster_name']}, "
                       f"type {cluster['type']}, AZ {az}, count {container_count}")
            
            try:
                cloudwatch.put_metric_data(
                    Namespace='ContainerDistribution',
                    MetricData=[
                        {
                            'MetricName': 'ContainersCount',
                            'Value': container_count,
                            'Unit': 'Count',
                            'Timestamp': datetime.utcnow(),
                            'Dimensions': [
                                {
                                    'Name': 'ClusterName',
                                    'Value': cluster['cluster_name']
                                },
                                {
                                    'Name': 'ClusterType',
                                    'Value': cluster['type']
                                },
                                {
                                    'Name': 'AvailabilityZone',
                                    'Value': az
                                }
                            ]
                        }
                    ]
                )
            except Exception as e:
                logger.error(f"Error sending metric for cluster {cluster['cluster_name']}, AZ {az}: {str(e)}")
                raise

def lambda_handler(event, context):
    logger.info("Container Stats Collection Lambda started")
    logger.info(f"Event: {event}")
    
    try:
        # Get cluster information
        clusters_info = []
        
        logger.info("Collecting ECS cluster information...")
        ecs_info = get_ecs_cluster_info()
        clusters_info.extend(ecs_info)
        logger.info(f"Found {len(ecs_info)} ECS clusters")
        
        logger.info("Collecting EKS cluster information...")
        eks_info = get_eks_cluster_info()
        clusters_info.extend(eks_info)
        logger.info(f"Found {len(eks_info)} EKS clusters")
        
        # Send metrics to CloudWatch
        logger.info("Sending metrics to CloudWatch...")
        send_metrics_to_cloudwatch(clusters_info)
        
        logger.info("Lambda execution completed successfully")
        return {
            'statusCode': 200,
            'body': f'Successfully processed {len(clusters_info)} clusters'
        }
    
    except Exception as e:
        logger.error(f"Error in lambda execution: {str(e)}", exc_info=True)
        raise
