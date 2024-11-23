#!/bin/sh

cd ~/environment/workshopfiles/fis-workshop/reg-experiment/iam/
aws iam create-role --role-name fis-reg-role --assume-role-policy-document file://fis-reg-experiment-policy.json
aws iam put-role-policy --role-name fis-reg-role --policy-name fis-reg-policy --policy-document file://fis-reg-task-policy.json
cd ~/environment/workshopfiles/fis-workshop/reg-experiment/scripts/
sh petstore_reg_check.sh
cd -
