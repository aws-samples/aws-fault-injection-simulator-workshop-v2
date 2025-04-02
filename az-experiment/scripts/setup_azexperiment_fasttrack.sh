#!/bin/bash

function list_load_balancers() {
    echo "Load Balancers:"
    aws elbv2 describe-load-balancers --query 'LoadBalancers[*].{Name:LoadBalancerName,Type:Type}' --output table
}


# Main script

cd ~/environment/workshopfiles/fis-workshop/az-experiment/iam/
aws iam create-role --role-name fis-az-role --assume-role-policy-document file://fis-az-experiment-policy.json
aws iam put-role-policy --role-name fis-az-role --policy-name fis-az-policy --policy-document file://fis-az-task-policy.json
cd ~/environment/workshopfiles/fis-workshop/az-experiment/scripts/
cd ~/environment/workshopfiles/fis-workshop/ecs-experiment/
sh updatetaskdef.sh
cd -

list_load_balancers
  
echo "Enabling zonal_shift.config.enabled true"
eksasg=$(aws autoscaling describe-auto-scaling-groups --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'eks')].AutoScalingGroupName" --output text)
eksasg=$(echo "$eksasg" | tr -d '[:space:]')
eksasgarn=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $eksasg --query 'AutoScalingGroups[0].AutoScalingGroupARN' --output text)
aws autoscaling update-auto-scaling-group \
    --auto-scaling-group-name "$eksasg" \
    --availability-zone-impairment-policy '{"ZonalShiftEnabled": true, "ImpairedZoneHealthCheckBehavior": "IgnoreUnhealthy"}'
echo "Check $eksasg settings for zonalshift and unhealthy hosts"

aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$eksasg" \
    --query 'AutoScalingGroups[0].AvailabilityZoneImpairmentPolicy' 

ecssrv=$(aws autoscaling describe-auto-scaling-groups --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'Services')].AutoScalingGroupName" --output text)
ecssrv=$(echo "$ecssrv" | tr -d '[:space:]')
ecsasgarn=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ecssrv --query 'AutoScalingGroups[0].AutoScalingGroupARN' --output text)
aws autoscaling update-auto-scaling-group \
    --auto-scaling-group-name "$ecssrv" \
    --availability-zone-impairment-policy '{"ZonalShiftEnabled": true, "ImpairedZoneHealthCheckBehavior": "IgnoreUnhealthy"}'
echo "Check $ecssrv settings for zonalshift and unhealthy hosts"

aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$ecssrv" \
    --query 'AutoScalingGroups[0].AvailabilityZoneImpairmentPolicy' 


load_balancer_arns=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[*].LoadBalancerArn' --output text)

for load_balancer_arn in $load_balancer_arns; do
    aws elbv2 modify-load-balancer-attributes --load-balancer-arn $load_balancer_arn --attributes Key=zonal_shift.config.enabled,Value=true
    start_zonal_shift "$load_balancer_arn" "$AZ"
done

