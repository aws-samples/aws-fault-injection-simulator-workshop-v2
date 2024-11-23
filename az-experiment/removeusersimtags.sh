#!/bin/bash

# Set the VPC name
VPC_NAME="UserSimulationStack/Vpc"

# Get the VPC ID
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=$VPC_NAME" --query 'Vpcs[0].VpcId' --output text)

# Check if the VPC ID was found
if [ -z "$VPC_ID" ]; then
  echo "Error: VPC with name '$VPC_NAME' not found."
  exit 1
fi

aws ec2 delete-tags --resources $VPC_ID --tags Key=AzImpairmentPower

SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text)

if [ -z "$SUBNET_IDS" ]; then
  echo "No subnets found for VPC '$VPC_ID'."
else
  # Remove the tag from each subnet
  for SUBNET_ID in $SUBNET_IDS; do
    aws ec2 delete-tags --resources $SUBNET_ID --tags Key=AzImpairmentPower
  done
fi

# Get the cluster ARN using the cluster name
CLUSTER_ARN=$(aws ecs list-clusters | jq -r '.clusterArns[]' | grep UserSimulationStack)

if [ -z "$CLUSTER_ARN" ]; then
    echo "Error: UserSimulationStack cluster not found"
    exit 1
fi

# Update tag for the cluster itself
echo "Updating tag for cluster: $CLUSTER_ARN"
aws ecs tag-resource \
    --resource-arn "$CLUSTER_ARN" \
    --tags "key=AzImpairmentPower,value=false"

if [ $? -eq 0 ]; then
    echo "Successfully updated tag for cluster: $CLUSTER_ARN"
else
    echo "Failed to update tag for cluster: $CLUSTER_ARN"
fi

# List all services in the cluster
SERVICES=$(aws ecs list-services --cluster "$CLUSTER_ARN" | jq -r '.serviceArns[]')

if [ -z "$SERVICES" ]; then
    echo "No services found in the cluster"
    exit 0
fi

# Loop through each service and update the tag
for SERVICE_ARN in $SERVICES; do
    echo "Updating tag for service: $SERVICE_ARN"
    
    aws ecs tag-resource \
        --resource-arn "$SERVICE_ARN" \
        --tags "key=AzImpairmentPower,value=false"
        
    if [ $? -eq 0 ]; then
        echo "Successfully updated tag for service: $SERVICE_ARN"
    else
        echo "Failed to update tag for service: $SERVICE_ARN"
    fi
done

echo "Tag update completed for cluster and all services"
