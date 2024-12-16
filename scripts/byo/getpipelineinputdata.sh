#!/bin/bash

# Get the project name containing "PipelineDeployProject"
PROJECT_NAME=$(aws codebuild list-projects --output text --query 'projects[?contains(@, `PipelineDeployProject`)] | [0]')

if [ -z "$PROJECT_NAME" ]; then
    echo "No CodeBuild project found containing 'PipelineDeployProject'"
    exit 1
fi

echo "Found CodeBuild project: \$PROJECT_NAME"
echo "----------------------------------------"

# Get the VPC configuration
VPC_CONFIG=$(aws codebuild batch-get-projects --names "$PROJECT_NAME" --query 'projects[0].vpcConfig')

# Extract VPC ID
VPC_ID=$(echo "$VPC_CONFIG" | jq -r '.vpcId')
echo "VPC ID: $VPC_ID"

# Extract Subnet IDs
echo "Subnet IDs:"
echo "$VPC_CONFIG" | jq -r '.subnets[]'

# Extract Security Group IDs
echo "Security Group IDs:"
echo "$VPC_CONFIG" | jq -r '.securityGroupIds[]'

# Get additional information about the VPC
if [ "$VPC_ID" != "null" ]; then
    echo "\nVPC Details:"
    aws ec2 describe-vpcs --vpc-ids "$VPC_ID" --query 'Vpcs[0].[VpcId,CidrBlock,State]' --output table

    # Get Subnet details
    echo "\nSubnet Details:"
    SUBNET_IDS=$(echo "$VPC_CONFIG" | jq -r '.subnets[]')
    for SUBNET_ID in $SUBNET_IDS; do
        aws ec2 describe-subnets --subnet-ids "$SUBNET_ID" --query 'Subnets[0].[SubnetId,CidrBlock,AvailabilityZone]' --output table
    done

    # Get Security Group details
    echo "\nSecurity Group Details:"
    SG_IDS=$(echo "$VPC_CONFIG" | jq -r '.securityGroupIds[]')
    for SG_ID in $SG_IDS; do
        aws ec2 describe-security-groups --group-ids "$SG_ID" --query 'SecurityGroups[0].[GroupId,GroupName,Description]' --output table
    done
fi
