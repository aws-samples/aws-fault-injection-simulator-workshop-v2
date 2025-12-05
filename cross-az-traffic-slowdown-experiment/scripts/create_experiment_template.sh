#!/bin/bash
#
# Create the FIS experiment template for Cross-AZ Traffic Slowdown
# This script updates placeholders and creates the experiment template
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_FILE="${EXPERIMENT_DIR}/templates/fis-cross-az-traffic-slowdown-template.json"

echo "=============================================="
echo "Create Cross-AZ Traffic Slowdown Experiment"
echo "=============================================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "ERROR: AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

# Get all AZs in the region
ALL_AZS=$(aws ec2 describe-availability-zones --region $REGION --query 'AvailabilityZones[*].ZoneName' --output text)
AZ_ARRAY=($ALL_AZS)

if [ ${#AZ_ARRAY[@]} -lt 2 ]; then
    echo "ERROR: Region $REGION has fewer than 2 Availability Zones. Cross-AZ experiment requires at least 2 AZs."
    exit 1
fi

# Get the first AZ as default target
DEFAULT_AZ=${AZ_ARRAY[0]}

echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo "Available AZs: ${ALL_AZS}"
echo ""

# Prompt for target AZ
read -p "Enter target Availability Zone [$DEFAULT_AZ]: " TARGET_AZ
TARGET_AZ=${TARGET_AZ:-$DEFAULT_AZ}

# Validate target AZ
if [[ ! " ${AZ_ARRAY[*]} " =~ " ${TARGET_AZ} " ]]; then
    echo "ERROR: Invalid AZ '$TARGET_AZ'. Must be one of: ${ALL_AZS}"
    exit 1
fi

# Auto-discover other AZs (all AZs except the target)
OTHER_AZS=""
for az in "${AZ_ARRAY[@]}"; do
    if [ "$az" != "$TARGET_AZ" ]; then
        if [ -n "$OTHER_AZS" ]; then
            OTHER_AZS="${OTHER_AZS},${az}"
        else
            OTHER_AZS="${az}"
        fi
    fi
done

echo ""
echo "Target AZ: $TARGET_AZ"
echo "Other AZs (packet loss destinations): $OTHER_AZS"
echo ""

# Prompt for EKS configuration
read -p "Enter EKS cluster identifier (leave empty to skip EKS): " EKS_CLUSTER
EKS_CLUSTER=${EKS_CLUSTER:-"your_eks_cluster_identifier"}

read -p "Enter EKS namespace [default]: " EKS_NAMESPACE
EKS_NAMESPACE=${EKS_NAMESPACE:-"default"}

echo ""
echo "Creating experiment template with:"
echo "  - Target AZ: $TARGET_AZ"
echo "  - Other AZs: $OTHER_AZS"
echo "  - Account: $ACCOUNT_ID"
echo "  - Region: $REGION"
echo "  - EKS Cluster: $EKS_CLUSTER"
echo "  - EKS Namespace: $EKS_NAMESPACE"
echo ""

# Create a temporary file with substituted values
TEMP_TEMPLATE=$(mktemp)
sed -e "s/{{TARGET_AZ}}/${TARGET_AZ}/g" \
    -e "s/{{ACCOUNT_ID}}/${ACCOUNT_ID}/g" \
    -e "s/{{REGION}}/${REGION}/g" \
    -e "s/{{EKS_CLUSTER}}/${EKS_CLUSTER}/g" \
    -e "s/{{EKS_NAMESPACE}}/${EKS_NAMESPACE}/g" \
    -e "s/{{OTHER_AZS}}/${OTHER_AZS}/g" \
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
echo "Or use the run script:"
echo "  ${SCRIPT_DIR}/run_experiment.sh"
echo ""
echo "View in console:"
echo "  https://${REGION}.console.aws.amazon.com/fis/home?region=${REGION}#ExperimentTemplates/${TEMPLATE_ID}"
echo ""
