#!/bin/bash

ROLEARN=$(aws iam list-roles | jq '.Roles[].Arn | select(contains("cfn-exec") and contains("us-east-1"))' -r)
SUBNETID=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=Services/Microservices/PublicSubnet1" --query "Subnets[].SubnetId" --output text)

echo "Stack deployment takes about 2min"
aws cloudformation create-stack --stack-name fisapiunavailable --template-body file://api-unavailable.yaml --parameters  ParameterKey=ErrorQueue,ParameterValue=fis-workshop-api-queue-unavailable ParameterKey=LambdaFunctionName,ParameterValue=fis-workshop-api-errors-unavailable ParameterKey=LatestAmiId,ParameterValue=/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2 ParameterKey=SubnetId,ParameterValue=$SUBNETID ParameterKey=apiGatewayName,ParameterValue=fis-workshop-unavailable ParameterKey=apiGatewayStageName,ParameterValue=v1 --capabilities CAPABILITY_NAMED_IAM --role-arn $ROLEARN

aws cloudformation wait stack-create-complete --stack-name fisapiunavailable
echo "fisapiunavailable is Ready!!"
