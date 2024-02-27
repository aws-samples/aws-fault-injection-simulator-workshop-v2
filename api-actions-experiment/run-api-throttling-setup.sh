#!/bin/bash

ROLEARN=$(aws iam list-roles | jq '.Roles[].Arn | select(contains("cfn-exec"))' -r)
SUBNETID=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=Services/Microservices/PublicSubnet1" --query "Subnets[].SubnetId" --output text)
echo $SUBNETID

aws cloudformation create-stack --stack-name fisapithrottle --template-body file://api-throttling.yaml --parameters ParameterKey=LambdaFunctionName,ParameterValue=fis-workshop-api-errors-throttling ParameterKey=apiGatewayName,ParameterValue=fis-workshop-throttle ParameterKey=apiGatewayStageName,ParameterValue=v1 --capabilities CAPABILITY_NAMED_IAM --role-arn $ROLEARN

aws cloudformation wait stack-create-complete --stack-name fisapithrottle
echo "fisapithrottle is Ready!!"
