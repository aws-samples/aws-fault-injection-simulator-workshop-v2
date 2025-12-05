#!/bin/bash
#
# Create the FIS experiment template for AZ Application Slowdown
# This script updates placeholders and creates the experiment template
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_FILE="${EXPERIMENT_DIR}/templates/fis-az-app-slowdown-template.json"

echo "=============================================="
echo "Create AZ Application Slowdown Experiment"
echo "=============================================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "ERROR: AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

# Get the first AZ in the region as default
DEFAULT_AZ=$(aws ec2 describe-availability-zones --region $REGION --query 'AvailabilityZones[0].ZoneName' --output text)

echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo "Default AZ: $DEFAULT_AZ"
echo ""

# Prompt for values or use defaults
read -p "Enter target Availability Zone [$DEFAULT_AZ]: " TARGET_AZ
TARGET_AZ=${TARGET_AZ:-$DEFAULT_AZ}

read -p "Enter EKS cluster identifier (leave empty to skip EKS): " EKS_CLUSTER
EKS_CLUSTER=${EKS_CLUSTER:-"your_eks_cluster_identifier"}

read -p "Enter EKS namespace [default]: " EKS_NAMESPACE
EKS_NAMESPACE=${EKS_NAMESPACE:-"default"}

echo ""
echo "Creating experiment template with:"
echo "  - Target AZ: $TARGET_AZ"
echo "  - Account: $ACCOUNT_ID"
echo "  - Region: $REGION"
echo "  - EKS Cluster: $EKS_CLUSTER"
echo "  - EKS Namespace: $EKS_NAMESPACE"
echo ""

# Create a temporary file with substituted values
TEMP_TEMPLATE=$(mktemp)
sed -e "s/your_availability_zone_identifier/${TARGET_AZ}/g" \
    -e "s/your_aws_account/${ACCOUNT_ID}/g" \
    -e "s/your_region/${REGION}/g" \
    -e "s/your_eks_cluster_identifier/${EKS_CLUSTER}/g" \
    -e "s/\"namespace\": \"default\"/\"namespace\": \"${EKS_NAMESPACE}\"/g" \
    "$TEMPLATE_FILE" > "$TEMP_TEMPLATE"

# Create the experiment template
echo "Creating FIS experiment template..."
TEMPLATE_ID=$(aws fis create-experiment-template \
    --cli-input-json file://"$TEMP_TEMPLATE" \
    --query 'experimentTemplate.id' \
    --output text)

rm -f "$TEMP_TEMPLATE"

echo ""
echo "=============================================="
echo "Experiment Template Created!"
echo "=============================================="
echo ""
echo "Template ID: $TEMPLATE_ID"
echo ""
echo "To run the experiment:"
echo "  aws fis start-experiment --experiment-template-id $TEMPLATE_ID"
echo ""
echo "To view in console:"
echo "  https://${REGION}.console.aws.amazon.com/fis/home?region=${REGION}#ExperimentTemplates/${TEMPLATE_ID}"
echo ""
