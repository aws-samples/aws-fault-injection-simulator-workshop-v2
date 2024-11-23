#!/bin/sh
cd ~/environment/workshopfiles/fis-workshop/az-experiment/
aws iam create-role --role-name fis-az-role --assume-role-policy-document file://fis-az-experiment-policy.json
aws iam put-role-policy --role-name fis-az-role --policy-name fis-az-policy --policy-document file://fis-az-task-policy.json
aws cloudformation create-stack --stack-name AZImpairmentDashboard --template-body file://az-impairment-dashboard.yaml --capabilities CAPABILITY_NAMED_IAM
chmod +x removeusersimtags.sh
bash removeusersimtags.sh

cd ~/environment/workshopfiles/fis-workshop/ecs-experiment/
sh updatetaskdef.sh
cd -
