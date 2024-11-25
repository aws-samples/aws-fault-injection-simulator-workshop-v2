#!/bin/bash

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo "${color}${message}${NC}"
}

# Function to get SSM parameter value
get_ssm_parameter() {
    local parameter_name=$1
    aws ssm get-parameter --name "$parameter_name" --region us-east-1 --query "Parameter.Value" --output text
}

# Function to copy images to S3
copy_images_to_s3() {
    local bucket_arn=$1
    local source_path=$2
    local destination_prefix=$3

    # Extract bucket name from ARN
    local bucket_name=$(echo $bucket_arn | awk -F':' '{print $NF}')

    print_color $YELLOW "Copying images from $source_path to s3://$bucket_name/$destination_prefix"
    aws s3 sync $source_path s3://$bucket_name/$destination_prefix
    
    if [ $? -eq 0 ]; then
        print_color $GREEN "Copy operation completed successfully."
    else
        print_color $RED "Copy operation failed."
    fi
}

# Main script

print_color $BLUE "Starting the image copy process..."

# Get S3 bucket ARN from SSM Parameter
s3_bucket_arn=$(get_ssm_parameter "/petstore/s3bucketarn")

if [ -z "$s3_bucket_arn" ]; then
    print_color $RED "Failed to retrieve S3 bucket ARN from SSM Parameter."
    exit 1
fi

print_color $GREEN "Retrieved S3 bucket ARN: $s3_bucket_arn"

# Source and destination paths
source_path="../experiment/images/bunnies/"
destination_prefix="bunnies/"

# Perform copy operation
print_color $BLUE "Attempting upload"
copy_images_to_s3 "$s3_bucket_arn" "$source_path" "$destination_prefix"
    

print_color $BLUE "Image copy process completed."
