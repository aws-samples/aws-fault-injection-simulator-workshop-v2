#!/bin/bash
#
# Setup script for AZ Application Slowdown experiment
# This script creates the IAM role and attaches the required policies
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "AZ Application Slowdown Experiment Setup"
echo "=============================================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "ERROR: AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo ""

# Create the IAM role
echo "Creating IAM role: fis-az-app-slowdown-role..."
aws iam create-role \
    --role-name fis-az-app-slowdown-role \
    --assume-role-policy-document file://${EXPERIMENT_DIR}/iam/fis-az-app-slowdown-trust-policy.json \
    2>/dev/null || echo "Role already exists, continuing..."

# Attach the task policy
echo "Attaching task policy to role..."
aws iam put-role-policy \
    --role-name fis-az-app-slowdown-role \
    --policy-name fis-az-app-slowdown-task-policy \
    --policy-document file://${EXPERIMENT_DIR}/iam/fis-az-app-slowdown-task-policy.json

echo ""
echo "=============================================="
echo "IAM Setup Complete!"
echo "=============================================="
echo ""
echo "Role ARN: arn:aws:iam::${ACCOUNT_ID}:role/fis-az-app-slowdown-role"
echo ""
echo "Next steps:"
echo "1. Update the experiment template with your values:"
echo "   - Replace 'your_availability_zone_identifier' with your target AZ (e.g., ${REGION}a)"
echo "   - Replace 'your_aws_account' with: ${ACCOUNT_ID}"
echo "   - Replace 'your_region' with: ${REGION}"
echo "   - Replace 'your_eks_cluster_identifier' with your EKS cluster name (if using EKS)"
echo ""
echo "2. Tag your resources:"
echo "   - ECS tasks: AZApplicationSlowdown=LatencyForECS"
echo "   - EKS pods: AZApplicationSlowdown=LatencyForEKS (as label)"
echo "   - EC2 instances: AZApplicationSlowdown=LatencyForEC2"
echo ""
echo "3. Create the experiment template:"
echo "   aws fis create-experiment-template --cli-input-json file://${EXPERIMENT_DIR}/templates/fis-az-app-slowdown-template.json"
echo ""
