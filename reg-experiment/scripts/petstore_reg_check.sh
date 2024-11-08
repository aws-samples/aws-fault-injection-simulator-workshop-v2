#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to get SSM parameter value
get_ssm_parameter() {
    local region=$1
    local parameter_name=$2
    aws ssm get-parameter --name "$parameter_name" --region "$region" --query "Parameter.Value" --output text
}

# Function to check RDS instance role and perform failover if needed
check_and_failover_rds() {
    local cluster_id=$1
    local writer_id=$2
    local reader_id=$3

    # Get current writer instance
    current_writer=$(aws rds describe-db-clusters --db-cluster-identifier "$cluster_id" --region us-east-1 --query "DBClusters[0].DBClusterMembers[?IsClusterWriter==\`true\`].DBInstanceIdentifier" --output text)

    if [ "$current_writer" != "$writer_id" ]; then
        echo "Performing failover: Current writer is $current_writer, expected writer is $writer_id"
        aws rds failover-db-cluster --db-cluster-identifier "$cluster_id" --target-db-instance-identifier "$writer_id" --region us-east-1
        echo "Failover initiated. Please check the RDS console for status."
    else
        echo "RDS cluster roles are correct. No failover needed."
    fi
}

# Function to print a green cell with blue text
print_green_cell() {
    local text="$1"
    echo "${GREEN}╔═══════════════════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo "${GREEN}║${BLUE}  $text${NC}"
    echo "${GREEN}╚═══════════════════════════════════════════════════════════════════════════════════════════════╝${NC}"
}

# 1. Read SSM parameter values for both regions
us_east_1_url=$(get_ssm_parameter "us-east-1" "/petstore/petsiteurl")
us_west_2_url=$(get_ssm_parameter "us-west-2" "/petstore/petsiteurl")

# 2. Output the values in a green cell with color-coded URLs
print_green_cell "PetSite application website URLs:"
echo "${GREEN}║${NC}  Region us-east-1: ${BLUE}$us_east_1_url${NC}"
echo "${GREEN}║${NC}  Region us-west-2: ${BLUE}$us_west_2_url${NC}"
echo "${GREEN}╚═══════════════════════════════════════════════════════════════════════════════════════════════╝${NC}"

# 3. Read SSM parameter values for RDS in us-east-1
rds_writer_id=$(get_ssm_parameter "us-east-1" "/petstore/rdsinstanceIdentifierWriter")
rds_reader_id=$(get_ssm_parameter "us-east-1" "/petstore/rdsinstanceIdentifierReader")
rds_cluster_id=$(get_ssm_parameter "us-east-1" "/petstore/rdsclusterIdentifier")

# 4. Validate RDS instance roles and perform failover if needed
check_and_failover_rds "$rds_cluster_id" "$rds_writer_id" "$rds_reader_id"

# 5. Execute additional commands
echo "Executing additional commands..."
current_dir=$(pwd)
cd ../../ecs-experiment/
sh updatetaskdef.sh
cd "$current_dir"

echo "Script execution completed."
