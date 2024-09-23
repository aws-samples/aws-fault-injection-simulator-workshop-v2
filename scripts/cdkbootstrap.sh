#!/bin/bash

# Function to bootstrap a specific region
bootstrap_region() {
    local region=$1
    echo "Bootstrapping region: $region"
    cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT:-$(aws sts get-caller-identity --query Account --output text)}/$region
}

# Check if CDK_STACK is set
if [ -z "$CDK_STACK" ] ; then
    # Get the current region, default to us-east-1 if not set
    CURRENT_REGION=${CDK_DEFAULT_REGION:-us-east-1}

    # Bootstrap current region
    bootstrap_region $CURRENT_REGION

    # Bootstrap us-west-2
    bootstrap_region us-west-2
else
    echo "Already bootstrapped"
fi
