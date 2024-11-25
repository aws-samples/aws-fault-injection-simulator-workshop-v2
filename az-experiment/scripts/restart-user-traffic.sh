#!/bin/bash

# Set the AWS region

CLUSTERARN=$(aws ecs list-clusters --output text | grep UserSimulationStack)
CLUSTER_NAME=$(echo $CLUSTERARN | awk -F'/' '{print $2}')

echo $CLUSTER_NAME

echo "Restarting tasks in cluster: $CLUSTER_NAME"

# Get a list of all the services in the cluster
services=$(aws ecs list-services --cluster "$CLUSTER_NAME" --output text --query 'serviceArns[]')

# Loop through each service and restart the tasks
for service in $services; do
  echo "Stopping tasks for service: $service"
  srv_name=$(echo $service | awk -F'/' '{print $3}')
  echo $srv_name
  aws ecs update-service --cluster $CLUSTER_NAME --service $srv_name --desired-count 0
done

sleep 10

echo "turning back on"

for service in $services; do
  echo "Restarting tasks for service: $service"
  srv_name=$(echo $service | awk -F'/' '{print $3}')
  echo $srv_name
  aws ecs update-service --cluster $CLUSTER_NAME --service $srv_name --desired-count 1
done
