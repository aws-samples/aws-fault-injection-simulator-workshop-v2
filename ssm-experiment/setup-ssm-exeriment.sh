#!/bin/bash
echo "Provisioning CPU stress instances"

# Query public subnet from VPC stack
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=Services/Microservices/PrivateSubnet2" --query "Subnets[].SubnetId" --output text)

# Launch CloudFormation stack
aws cloudformation deploy \
    --stack-name FisCpuStress \
    --template-file CPUStressInstances.yaml  \
    --parameter-overrides \
        SubnetId=${SUBNET_ID} \
    --no-fail-on-empty-changeset \
    --capabilities CAPABILITY_IAM
