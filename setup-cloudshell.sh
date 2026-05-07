#!/usr/bin/env bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# Setup script for AWS FIS Workshop participants using CloudShell or local terminal.
# Installs required CLI tools and configures access to the workshop EKS cluster.

set -e

if [ -z "$AWS_REGION" ]; then
	echo "error: AWS_REGION not set. Run: export AWS_REGION=us-east-1"
	exit 1
fi

echo "=== AWS FIS Workshop Environment Setup ==="
echo "Region: $AWS_REGION"

mkdir -p $HOME/.local/bin
export PATH="$HOME/.local/bin:$PATH"

# Install kubectl if not present
if ! command -v kubectl &>/dev/null; then
	echo "Installing kubectl..."
	curl -sLO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
	chmod +x kubectl
	mv kubectl $HOME/.local/bin/
fi

# Install helm if not present
if ! command -v helm &>/dev/null; then
	echo "Installing helm..."
	curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
	chmod 700 get_helm.sh
	HELM_INSTALL_DIR=$HOME/.local/bin USE_SUDO=false ./get_helm.sh
	rm get_helm.sh
fi

# Install eksctl if not present
if ! command -v eksctl &>/dev/null; then
	echo "Installing eksctl..."
	ARCH=amd64
	PLATFORM=$(uname -s)_$ARCH
	curl -sLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_$PLATFORM.tar.gz"
	tar -xzf eksctl_$PLATFORM.tar.gz -C $HOME/.local/bin/
	rm eksctl_$PLATFORM.tar.gz
fi

# Configure kubectl for the PetSite EKS cluster
echo "Configuring kubectl for PetSite EKS cluster..."
CLUSTER_NAME="PetSite"
ADMIN_ROLE=$(aws ssm get-parameter --name '/eks/petsite/EKSMasterRoleArn' --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -n "$ADMIN_ROLE" ]; then
	aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION --role-arn $ADMIN_ROLE
else
	aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION
fi

# Verify access
echo ""
echo "=== Verification ==="
echo "kubectl:  $(kubectl version --client --short 2>/dev/null || kubectl version --client 2>&1 | head -1)"
echo "helm:     $(helm version --short 2>/dev/null)"
echo "eksctl:   $(eksctl version 2>/dev/null)"
echo "EKS:      $(kubectl get nodes --no-headers 2>/dev/null | wc -l) nodes"
echo ""

# Print workshop URLs
PETSITE_URL=$(aws ssm get-parameter --name '/petstore/petsiteurl' --query 'Parameter.Value' --output text 2>/dev/null || echo "not found")
echo "=== Workshop URLs ==="
echo "PetSite:  $PETSITE_URL"
echo ""
echo "Setup complete! You can now run FIS experiments."
