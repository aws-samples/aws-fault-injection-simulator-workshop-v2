#!/bin/bash

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ROLEARN=$(aws iam list-roles | jq --arg r "$REGION" '.Roles[].Arn | select(contains("cfn-exec") and contains($r))' -r)

echo "Stack deployment takes about 1min"
aws cloudformation create-stack --stack-name fisapithrottle --template-body file://api-throttling.yaml --parameters ParameterKey=LambdaFunctionName,ParameterValue=fis-workshop-api-errors-throttling ParameterKey=apiGatewayName,ParameterValue=fis-workshop-throttle ParameterKey=apiGatewayStageName,ParameterValue=v1 --capabilities CAPABILITY_NAMED_IAM --role-arn $ROLEARN

aws cloudformation wait stack-create-complete --stack-name fisapithrottle
echo "fisapithrottle is Ready!!"
