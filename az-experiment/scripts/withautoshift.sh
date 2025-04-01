#!/bin/bash

# Function to list all load balancers
function list_load_balancers() {
    echo "Load Balancers:"
    aws elbv2 describe-load-balancers --query 'LoadBalancers[*].{Name:LoadBalancerName,Type:Type}' --output table
}

while true; do
json_data=$(aws fis list-experiments)


experiment=$(echo "$json_data" | jq -r '.experiments[] | select((.tags.Name // .tags.name) == "azpowerinterruption") | select(.state.status == "running") | .state.status')
echo $experiment

  if [ "$experiment" == "running" ]; then
    echo "Impact Detected!!!!!" 
    
    echo
    echo "Enabling zonal_shift.config.enabled true"
    
    echo "Enabling Zonal Shift"

   # Main script

   list_load_balancers
  
   echo "Enabling zonal_shift.config.enabled true"
   eksasg=$(aws autoscaling describe-auto-scaling-groups --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'eks')].AutoScalingGroupName" --output text)
   eksasg=$(echo "$eksasg" | tr -d '[:space:]')
   eksasgarn=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $eksasg --query 'AutoScalingGroups[0].AutoScalingGroupARN' --output text)
   aws arc-zonal-shift create-practice-run-configuration --resource-identifier="$eksasgarn" --outcome-alarms type=CLOUDWATCH,alarmIdentifier=arn:aws:cloudwatch:us-east-1:637741707650:alarm:FisStackAsg-FisAsgHighCpuAlarm98AE69AA-4sJhyM3mcxSR
   aws arc-zonal-shift update-zonal-autoshift-configuration --resource-identifier="$eksasgarn" --zonal-autoshift-status="ENABLED"

   ecssrv=$(aws autoscaling describe-auto-scaling-groups --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'Services')].AutoScalingGroupName" --output text)
   ecssrv=$(echo "$ecssrv" | tr -d '[:space:]')
   ecsasgarn=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ecssrv --query 'AutoScalingGroups[0].AutoScalingGroupARN' --output text)
   aws arc-zonal-shift create-practice-run-configuration --resource-identifier="$ecsasgarn" --outcome-alarms type=CLOUDWATCH,alarmIdentifier=arn:aws:cloudwatch:us-east-1:637741707650:alarm:FisStackAsg-FisAsgHighCpuAlarm98AE69AA-4sJhyM3mcxSR
   aws arc-zonal-shift update-zonal-autoshift-configuration --resource-identifier="$ecsasgarn" --zonal-autoshift-status="ENABLED"


   load_balancer_arns=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[*].LoadBalancerArn' --output text)

    for load_balancer_arn in $load_balancer_arns; do
       aws elbv2 modify-load-balancer-attributes --load-balancer-arn $load_balancer_arn --attributes Key=zonal_shift.config.enabled,Value=true
       aws arc-zonal-shift create-practice-run-configuration --resource-identifier="$load_balancer_arn" --outcome-alarms type=CLOUDWATCH,alarmIdentifier=arn:aws:cloudwatch:us-east-1:637741707650:alarm:FisStackAsg-FisAsgHighCpuAlarm98AE69AA-4sJhyM3mcxSR
       aws arc-zonal-shift update-zonal-autoshift-configuration --resource-identifier="$load_balancer_arn" --zonal-autoshift-status="ENABLED"    
    done

    echo "EKS cluster PetSite in zonalshift mode"
    cluster_arn=$(aws eks describe-cluster --name PetSite --query 'cluster.arn' --output text)
    aws arc-zonal-shift create-practice-run-configuration --resource-identifier="$cluster_arn" --outcome-alarms type=CLOUDWATCH,alarmIdentifier=arn:aws:cloudwatch:us-east-1:637741707650:alarm:FisStackAsg-FisAsgHighCpuAlarm98AE69AA-4sJhyM3mcxSR
    aws arc-zonal-shift update-zonal-autoshift-configuration --resource-identifier="$cluster_arn" --zonal-autoshift-status="ENABLED"    done
done