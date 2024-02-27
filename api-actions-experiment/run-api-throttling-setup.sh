#!/bin/bash

ROLEARN=$(aws iam list-roles | jq '.Roles[].Arn | select(contains("cfn-exec"))' -r)

echo "Stack deployment takes about 1min"
aws cloudformation create-stack --stack-name fisapithrottle --template-body file://api-throttling.yaml --parameters ParameterKey=LambdaFunctionName,ParameterValue=fis-workshop-api-errors-throttling ParameterKey=apiGatewayName,ParameterValue=fis-workshop-throttle ParameterKey=apiGatewayStageName,ParameterValue=v1 --capabilities CAPABILITY_NAMED_IAM --role-arn $ROLEARN

aws cloudformation wait stack-create-complete --stack-name fisapithrottle
echo "fisapithrottle is Ready!!"
