#!/bin/sh
cd "$(dirname "$0")/../iam/"
aws iam create-role --role-name fis-reg-role --assume-role-policy-document file://fis-reg-experiment-policy.json
aws iam put-role-policy --role-name fis-reg-role --policy-name fis-reg-policy --policy-document file://fis-reg-task-policy.json
cd "$(dirname "$0")"
sh petstore_reg_check.sh
cd -
