#!/bin/bash

# Function to list all load balancers
function list_load_balancers() {
    echo "Load Balancers:"
    aws elbv2 describe-load-balancers --query 'LoadBalancers[*].{Name:LoadBalancerName,Type:Type}' --output table
}

# Function to start the Zonal Shift
function start_zonal_shift() {
    local load_balancer_arn=$1
    echo "Starting Zonal Shift for load balancer: $load_balancer_arn"
    # Set the AWS region
    AWS_REGION="us-east-1"

    # Get the Availability Zone information
    AZ_INFO=$(aws ec2 describe-availability-zones --region $AWS_REGION --output json)

    # Extract the Availability Zone ID for us-east-1a
    AZ_ID=$(echo $AZ_INFO | jq -r '.AvailabilityZones[] | select(.ZoneName == "us-east-1a") | .ZoneId')

    # Print the Availability Zone ID
    echo "Failing away from:  $AZ_ID"
    aws arc-zonal-shift start-zonal-shift --away-from "$AZ_ID" --expires-in 1m --resource-identifier "$load_balancer_arn" --comment "shift away from AZ us-east-1a"
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

# Main script
list_load_balancers
load_balancer_arns=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[*].LoadBalancerArn' --output text)

for load_balancer_arn in $load_balancer_arns; do
    start_zonal_shift "$load_balancer_arn"
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
        break
    fi

    # Sleep for 5 seconds before the next iteration
    sleep 5
done
