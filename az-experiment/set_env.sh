#!/bin/sh
export AWS_PAGER=""
export ACCOUNT_ID=$(aws sts get-caller-identity --output text --query Account)
export AWS_REGION=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
echo "export ACCOUNT_ID=${ACCOUNT_ID}" | tee -a ~/.bash_profile
echo "export AWS_REGION=${AWS_REGION}" | tee -a ~/.bash_profile
aws configure set default.region ${AWS_REGION}
aws configure get default.region
export MYSITE=$(aws ssm get-parameter --name '/petstore/petsiteurl'  | jq -r .Parameter.Value | tr '[:upper:]' '[:lower:]' | cut -f 3 -d '/')
echo -e "\e[1;32m Your petsite URL: http://$MYSITE \e[0m"
