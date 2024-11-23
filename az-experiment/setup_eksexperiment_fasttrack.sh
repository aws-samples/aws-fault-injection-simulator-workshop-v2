#!/bin/sh

cd ~/environment/workshopfiles/fis-workshop/eks-experiment/
aws iam create-role --role-name eks-fis-role --assume-role-policy-document file://fis-trust-policy.json
aws iam attach-role-policy --role-name eks-fis-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSFaultInjectionSimulatorNetworkAccess
aws iam attach-role-policy --role-name eks-fis-role --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
aws iam attach-role-policy --role-name eks-fis-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSFaultInjectionSimulatorEKSAccess
aws iam attach-role-policy --role-name eks-fis-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSFaultInjectionSimulatorEC2Access
aws iam attach-role-policy --role-name eks-fis-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSFaultInjectionSimulatorSSMAccess
aws iam attach-role-policy --role-name eks-fis-role --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess

aws eks update-kubeconfig --name PetSite --region $AWS_REGION  

kubectl apply -f rbac.yaml

eksctl create iamidentitymapping \
        --arn arn:aws:iam::$ACCOUNT_ID:role/eks-fis-role \
        --username fis-experiment \
        --cluster PetSite \
        --region=$AWS_REGION


eksctl get iamidentitymapping --cluster PetSite --region=$AWS_REGION

kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

cd -
eksctl utils update-zonal-shift-config -f zonal-shift-cluster.yaml    
kubectl patch deployment petsite-deployment -n default --type=json --patch-file topology-patch-petsite.json
kubectl patch deployment petsite-deployment -n default --type=json --patch-file topology-patch-pethistory.json
