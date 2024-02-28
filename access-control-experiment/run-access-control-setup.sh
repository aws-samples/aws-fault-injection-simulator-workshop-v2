#!/bin/bash

ROLEARN=$(aws iam list-roles | jq '.Roles[].Arn | select(contains("cfn-exec"))' -r)

ROLE_NAME="FisWorkshopServiceRole"

echo "#########################################################"
echo "Checking if $ROLE_NAME exists if it doesn't we create it"
echo "#########################################################"

if aws iam get-role --role-name $ROLE_NAME > /dev/null 2>&1; then
        echo "IAM role $ROLE_NAME exists"
else
        cd ~/environment/workshopfiles/fis-workshop/access-control-experiment/
        aws iam create-role --role-name FisWorkshopServiceRole --assume-role-policy-document file://fis-trust-policy.json
        aws iam put-role-policy --role-name FisWorkshopServiceRole --policy-name FisWorkshopServicPolicy --policy-document file://workshop-policy.json  
fi

echo "#########################################################"
echo "Creating the iam users for the access control section"
echo "#########################################################"
aws cloudformation create-stack --stack-name fisaccesscontrol --template-body file://setup-users.yaml --capabilities CAPABILITY_NAMED_IAM --role-arn $ROLEARN

aws cloudformation wait stack-create-complete --stack-name fisaccesscontrol
echo "fisaccesscontrol is ready!!"
