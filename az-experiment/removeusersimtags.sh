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
