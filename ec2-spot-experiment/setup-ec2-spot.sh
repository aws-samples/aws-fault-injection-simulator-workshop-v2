#!/bin/bash

echo "Provisioning spot resources"

# Use subnet from workshop deploy
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=Services/Microservices/PublicSubnet1" --query "Subnets[].SubnetId" --output text)
S3_BUCKET=$(aws s3 ls | grep pet | awk '{print $3}')

# Normally it should be possible to just pass the parameterstore string to an AWS::EC2::Image::Id parameter but found at least one account where that's broken
AMI_ID=$( aws ssm get-parameters --names /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-ebs --query 'Parameters[0].Value' --output text)

sam deploy \
  -t ec2-spot.yaml \
  --stack-name FisSpotTest \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides "SubnetId=${SUBNET_ID} ImageId=${AMI_ID}" \
  --s3-bucket $S3_BUCKET

echo "OK" > deploy-status.txt
