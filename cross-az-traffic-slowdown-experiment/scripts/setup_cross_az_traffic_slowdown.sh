#!/bin/bash
#
# Setup script for Cross-AZ Traffic Slowdown experiment
# This script creates the IAM role and attaches the required policies
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "Cross-AZ Traffic Slowdown Experiment Setup"
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
echo "Creating IAM role: fis-cross-az-traffic-slowdown-role..."
aws iam create-role \
    --role-name fis-cross-az-traffic-slowdown-role \
    --assume-role-policy-document file://${EXPERIMENT_DIR}/iam/fis-cross-az-traffic-slowdown-trust-policy.json \
    2>/dev/null || echo "Role already exists, continuing..."

# Attach the task policy
echo "Attaching task policy to role..."
aws iam put-role-policy \
    --role-name fis-cross-az-traffic-slowdown-role \
    --policy-name fis-cross-az-traffic-slowdown-task-policy \
    --policy-document file://${EXPERIMENT_DIR}/iam/fis-cross-az-traffic-slowdown-task-policy.json

echo ""
echo "=============================================="
echo "IAM Setup Complete!"
echo "=============================================="
echo ""
echo "Role ARN: arn:aws:iam::${ACCOUNT_ID}:role/fis-cross-az-traffic-slowdown-role"
echo ""
echo "Next steps:"
echo "1. Tag your resources for the experiment:"
echo "   - ECS tasks: CrossAZTrafficSlowdown=PacketLossForECS"
echo "   - EKS pods: CrossAZTrafficSlowdown=PacketLossForEKS (as label)"
echo "   - EC2 instances: CrossAZTrafficSlowdown=PacketLossForEC2"
echo ""
echo "2. Create the experiment template:"
echo "   ${SCRIPT_DIR}/create_experiment_template.sh"
echo ""
echo "3. Run the experiment:"
echo "   ${SCRIPT_DIR}/run_experiment.sh"
echo ""
