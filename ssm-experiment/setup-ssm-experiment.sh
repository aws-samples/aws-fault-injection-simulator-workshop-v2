#!/bin/bash
echo "Provisioning CPU stress instances"

# Pin the region so the stack always deploys to the workshop region, regardless
# of the caller's default. Falls back to us-east-1 if AWS_REGION is unset.
REGION="${AWS_REGION:-us-east-1}"

# Query public subnet from VPC stack
SUBNET_ID=$(aws ec2 describe-subnets --region "${REGION}" --filters "Name=tag:Name,Values=Services/Microservices/PrivateSubnet2" --query "Subnets[].SubnetId" --output text)

# Launch CloudFormation stack
aws cloudformation deploy \
    --region "${REGION}" \
    --stack-name FisCpuStress \
    --template-file CPUStressInstances.yaml  \
    --parameter-overrides \
        SubnetId=${SUBNET_ID} \
    --no-fail-on-empty-changeset \
    --capabilities CAPABILITY_NAMED_IAM
