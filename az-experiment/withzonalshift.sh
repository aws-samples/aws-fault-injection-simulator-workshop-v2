#!/bin/bash

AZ=$1
TIME=$2

# Function to list all load balancers
function list_load_balancers() {
    echo "Load Balancers:"
    aws elbv2 describe-load-balancers --query 'LoadBalancers[*].{Name:LoadBalancerName,Type:Type}' --output table
}


# Function to start the Zonal Shift
function start_zonal_shift() {
    # Set the AWS region
    AWS_REGION=$AWS_REGION
    #echo $AWS_REGION
    #echo $AZ

    # Get the Availability Zone information
    AZ_INFO=$(aws ec2 describe-availability-zones --region $AWS_REGION --output json)

    # Extract the Availability Zone ID for us-east-1a
    AZ_ID=$(echo $AZ_INFO | jq -r '.AvailabilityZones[] | select(.ZoneName == "'"$AZ"'") | .ZoneId')
    #echo $AZ_ID


    # Print the Availability Zone ID
    echo "Failing away from:  $AZ_ID"
    aws arc-zonal-shift start-zonal-shift --away-from "$AZ_ID" --expires-in $TIME --resource-identifier "$load_balancer_arn" --comment "shift away from AZ us-east-1a"
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

function disable_enable_cross_zone_lb() {
    all_args=("$@")
    attribute=${all_args[0]}
    target_groups=$(aws elbv2 describe-target-groups --query "TargetGroups[].TargetGroupArn" --output text)
    for tg in $target_groups; do
        echo "Updating cross-zone load balancing for target group: $tg"
        aws elbv2 modify-target-group-attributes \
            --target-group-arn "$tg" \
            --attributes Key=load_balancing.cross_zone.enabled,Value="false" > /dev/null 2>&1
        json_data=$(aws elbv2 describe-target-group-attributes --target-group-arn "$tg" )
        cross_zone_enabled=$(echo $json_data | jq -r '.Attributes[] | select(.Key == "load_balancing.cross_zone.enabled") | .Value')
        attribute_value=$cross_zone_enabled
        echo "The value for $tg of 'load_balancing.cross_zone.enabled' is: $cross_zone_enabled"
    done

# Verify that the attribute was updated correctly
    for tg in $target_groups; do
        actual_value=$(aws elbv2 describe-target-group-attributes --target-group-arn "$tg" --query "Attributes[?Key=='load_balancing.cross_zone.enabled'].Value" --output text)
        if [ "$actual_value" != "$attribute_value" ]; then
            echo "Error: Cross-zone load balancing attribute for target group $tg was not updated correctly. Expected: $attribute_value, Actual: $actual_value"
            exit 1
        fi
    done
    echo "Cross-zone load balancing has been updated for all ALB target groups."
}


disable_enable_cross_zone_lb "false"

while true; do
json_data=$(aws fis list-experiments)


experiment=$(echo "$json_data" | jq -r '.experiments[] | select((.tags.Name // .tags.name) == "azpowerinterruption") | select(.state.status == "running") | .state.status')
echo $experiment

  if [ "$experiment" == "running" ]; then
    echo "Impact Detected!!!!! Disabling cross zone load balancing"
    echo "Enabling Zonal Shift"

   # Main script
   list_load_balancers
   load_balancer_arns=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[*].LoadBalancerArn' --output text)

    for load_balancer_arn in $load_balancer_arns; do
       start_zonal_shift "$load_balancer_arn" "$AZ"
    done

    sleep 10

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
            echo "All load balancers have been processed."
            echo "Re-enabling cross-zone load balancing"
            disable_enable_cross_zone_lb "true"
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
