#!/bin/bash

SSM_ROLE_NAME=FisWorkshopSsmEc2DemoRole
FIS_ROLE_NAME=FisSsmExecutionRole

if aws iam get-role --role-name $FIS_ROLE_NAME > /dev/null 2>&1; then
        echo "IAM role $FIS_ROLE_NAME exists"
else
        cd ~/environment/workshopfiles/fis-workshop/ssm-experiment
        aws iam create-role --role-name $FIS_ROLE_NAME --assume-role-policy-document file://fis-ssm-trust-policy.json
	aws iam attach-role-policy --role-name $FIS_ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSFaultInjectionSimulatorSSMAccess
	aws iam attach-role-policy --role-name $FIS_ROLE_NAME --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
fi

echo "================================================================"
echo "Creating SSM role that is assumed by the document"
echo "================================================================"

if aws iam get-role --role-name $SSM_ROLE_NAME > /dev/null 2>&1; then
        echo "IAM role $SSM_ROLE_NAME exists"
else
        cd ~/environment/workshopfiles/fis-workshop/ssm-experiment
	aws iam create-role \
	  --role-name ${SSM_ROLE_NAME} \
	  --assume-role-policy-document file://iam-ec2-demo-trust.json

	aws iam put-role-policy \
	  --role-name ${SSM_ROLE_NAME} \
	  --policy-name ${SSM_ROLE_NAME} \
	  --policy-document file://iam-ec2-demo-policy.json
fi
