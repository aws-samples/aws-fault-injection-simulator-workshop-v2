#!/bin/bash
#
# Run the AZ Application Slowdown experiment
#

set -e

echo "=============================================="
echo "Run AZ Application Slowdown Experiment"
echo "=============================================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "ERROR: AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

REGION=$(aws configure get region)

# List available experiment templates
echo "Available AZ Application Slowdown templates:"
aws fis list-experiment-templates \
    --query "experimentTemplates[?contains(tags.Name, 'Application Slowdown')].{ID:id,Name:tags.Name}" \
    --output table

echo ""
read -p "Enter the experiment template ID: " TEMPLATE_ID

if [ -z "$TEMPLATE_ID" ]; then
    echo "ERROR: Template ID is required"
    exit 1
fi

echo ""
echo "Starting experiment with template: $TEMPLATE_ID"
echo ""

# Start the experiment
EXPERIMENT_ID=$(aws fis start-experiment \
    --experiment-template-id "$TEMPLATE_ID" \
    --query 'experiment.id' \
    --output text)

echo "=============================================="
echo "Experiment Started!"
echo "=============================================="
echo ""
echo "Experiment ID: $EXPERIMENT_ID"
echo ""
echo "Monitor the experiment:"
echo "  aws fis get-experiment --id $EXPERIMENT_ID"
echo ""
echo "View in console:"
echo "  https://${REGION}.console.aws.amazon.com/fis/home?region=${REGION}#Experiments/${EXPERIMENT_ID}"
echo ""
echo "To stop the experiment:"
echo "  aws fis stop-experiment --id $EXPERIMENT_ID"
echo ""
