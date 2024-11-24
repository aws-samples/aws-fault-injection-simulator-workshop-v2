#!/bin/sh
cd ~/environment/workshopfiles/fis-workshop/az-experiment/iam/
aws iam create-role --role-name fis-az-role --assume-role-policy-document file://fis-az-experiment-policy.json
aws iam put-role-policy --role-name fis-az-role --policy-name fis-az-policy --policy-document file://fis-az-task-policy.json
cd ~/environment/workshopfiles/fis-workshop/az-experiment/scripts/
bash removeusersimtags.sh
cd ~/environment/workshopfiles/fis-workshop/ecs-experiment/
sh updatetaskdef.sh
cd -
