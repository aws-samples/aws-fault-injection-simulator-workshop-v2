#!/bin/bash

# Function to display the menu and get user input
function get_user_input() {
    echo "Select the cross-zone load balancing attribute:"
    echo "1. true"
    echo "2. false"
    echo "3. use_load_balancer_configuration"
    read -p "Enter your choice (1-3): " choice

    case $choice in
        1)
            attribute_value="true"
            ;;
        2)
            attribute_value="false"
            ;;
        3)
            attribute_value="use_load_balancer_configuration"
            ;;
        *)
            echo "Invalid choice. Please try again."
            get_user_input
            return
    esac
}

# Get the list of load balancers and their types
echo "Load Balancers:"
aws elbv2 describe-load-balancers --query 'LoadBalancers[*].{Name:LoadBalancerName,Type:Type}' --output table

# Get the list of target groups
target_groups=$(aws elbv2 describe-target-groups --query "TargetGroups[].TargetGroupArn" --output text)

# Get user input for the cross-zone load balancing attribute
get_user_input

# Loop through each target group and update the cross-zone load balancing attribute
for tg in $target_groups; do
    echo "Updating cross-zone load balancing for target group: $tg"
    aws elbv2 modify-target-group-attributes \
        --target-group-arn "$tg" \
        --attributes Key=load_balancing.cross_zone.enabled,Value="$attribute_value" > /dev/null 2>&1
     json_data=$(aws elbv2 describe-target-group-attributes --target-group-arn "$tg" )
     cross_zone_enabled=$(echo $json_data | jq -r '.Attributes[] | select(.Key == "load_balancing.cross_zone.enabled") | .Value')
     echo "The value for $tg of 'load_balancing.cross_zone.enabled' is: $cross_zone_enabled"
done
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
