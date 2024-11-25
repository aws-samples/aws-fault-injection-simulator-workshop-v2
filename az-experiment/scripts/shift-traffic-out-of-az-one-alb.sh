#!/bin/bash

# Function to list all load balancers
function list_load_balancers() {
    echo "Load Balancers:"
    aws elbv2 describe-load-balancers --query 'LoadBalancers[*].{Name:LoadBalancerName,Type:Type}' --output table
}

# Function to get user input for the load balancer to be shifted
function get_user_input() {
    read -p "Enter the name of the load balancer you want to perform the Zonal Shift on: " load_balancer_name
    load_balancer_arn=$(aws elbv2 describe-load-balancers --query "LoadBalancers[?LoadBalancerName=='$load_balancer_name'].LoadBalancerArn" --output text)
    if [ -z "$load_balancer_arn" ]; then
        echo "Error: Load balancer '$load_balancer_name' not found."
        get_user_input
    fi
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
    echo "The Availability Zone ID for us-east-1a is: $AZ_ID"
    aws arc-zonal-shift start-zonal-shift --away-from "$AZ_ID" --expires-in 5m --resource-identifier "$load_balancer_arn" --comment "shift away from AZ us-east-1a"
}

# Function to monitor the progress of the Zonal Shift
function monitor_zonal_shift() {
    local load_balancer_arn=$1
    while true; do
        zonal_shift_status=$(aws arc-zonal-shift list-zonal-shifts --resource-identifier $load_balancer_arn --query 'items[0].status' --output text)
        echo "Zonal Shift status: $zonal_shift_status"
        if [ "$zonal_shift_status" != "ACTIVE" ]; then
            echo "Shift out of AZ $AZ_ID is INACTIVE!"
            break
        fi
        sleep 10
    done
}

# Main script
list_load_balancers
get_user_input
start_zonal_shift "$load_balancer_arn"
monitor_zonal_shift "$load_balancer_arn"
