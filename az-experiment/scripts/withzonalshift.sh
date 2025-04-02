#!/bin/bash

# Function to list all load balancers
function list_load_balancers() {
    echo "Load Balancers:"
    aws elbv2 describe-load-balancers --query 'LoadBalancers[*].{Name:LoadBalancerName,Type:Type}' --output table
}

# Function to monitor the progress of the Zonal Shift
function monitor_zonal_shift() {
    local load_balancer_arn=$1
    local zonal_shift_status="INACTIVE"

    while [ "$zonal_shift_status" != "ACTIVE" ]; do
        zonal_shift_status=$(aws arc-zonal-shift list-zonal-shifts --resource-identifier $load_balancer_arn --query 'items[0].status' --output text)
        if [ "$zonal_shift_status" != "ACTIVE" ]; then
        zonal_shift_status=""
            break
        fi

        # Wait for 10 seconds before checking the status again
    done
    echo $zonal_shift_status
}

while true; do
json_data=$(aws fis list-experiments)


experiment=$(echo "$json_data" | jq -r '.experiments[] | select((.tags.Name // .tags.name) == "azpowerinterruption") | select(.state.status == "running") | .state.status')
echo $experiment

  if [ "$experiment" == "running" ]; then
    echo "Impact Detected!!!!!" 
    
    echo "Waiting for Zonal Shift to be active" 

   # Main script

   list_load_balancers
  
   echo "Enabling zonal_shift.config.enabled true"
   eksasg=$(aws autoscaling describe-auto-scaling-groups --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'eks')].AutoScalingGroupName" --output text)
   eksasg=$(echo "$eksasg" | tr -d '[:space:]')
   eksasgarn=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $eksasg --query 'AutoScalingGroups[0].AutoScalingGroupARN' --output text)

   echo "Check $eksasg settings for zonalshift and unhealthy hosts"

   aws autoscaling describe-auto-scaling-groups \
             --auto-scaling-group-names "$eksasg" \
             --query 'AutoScalingGroups[0].AvailabilityZoneImpairmentPolicy' 

   ecssrv=$(aws autoscaling describe-auto-scaling-groups --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'Services')].AutoScalingGroupName" --output text)
   ecssrv=$(echo "$ecssrv" | tr -d '[:space:]')
   ecsasgarn=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ecssrv --query 'AutoScalingGroups[0].AutoScalingGroupARN' --output text)

   echo "Check $ecssrv settings for zonalshift and unhealthy hosts"

   aws autoscaling describe-auto-scaling-groups \
             --auto-scaling-group-names "$ecssrv" \
             --query 'AutoScalingGroups[0].AvailabilityZoneImpairmentPolicy' 


   load_balancer_arns=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[*].LoadBalancerArn' --output text)

    echo "EKS cluster PetSite in zonalshift mode"
    cluster_arn=$(aws eks describe-cluster --name PetSite --query 'cluster.arn' --output text)
    echo "EKS Cluster ARN:" $cluster_arn

    while true; do
        all_processed=true
        for load_balancer_arn in $load_balancer_arns; do
            zonal_shift_status=$(monitor_zonal_shift "$load_balancer_arn")
            if [ -n "$zonal_shift_status" ]; then
                all_processed=false
                echo "Zonal Shift for $load_balancer_arn is $zonal_shift_status"
            fi
        done

        if $all_processed; then
            echo "Impact is mitiagted, Zonal Shift is being deactivated"
            break
        fi

    # Sleep for 5 seconds before the next iteration
        sleep 5
    done  
    
    break
  else
    echo "Experiment with tag 'azpowerinterruption' is not in 'running' state. Waiting 5 seconds..."
    sleep 5
  fi
done
