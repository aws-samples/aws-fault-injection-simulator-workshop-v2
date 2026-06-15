#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR/iam/"
aws iam create-role --role-name fis-az-app-slowdown-role --assume-role-policy-document file://fis-az-app-slowdown-trust-policy.json
aws iam put-role-policy --role-name fis-az-app-slowdown-role --policy-name fis-az-app-slowdown-policy --policy-document file://fis-az-app-slowdown-task-policy.json
echo "IAM role fis-az-app-slowdown-role created and policy attached."

# Note: no instance tagging is needed here. The experiment template targets
# aws:ec2:instance with the workshop's standard AZ tag AzImpairmentPower=Ready,
# which the CDK already applies to the PetSearch ECS-EC2 nodes (and other AZ
# resources). The experiment then filters to a single AZ and injects network
# latency via SSM, which surfaces as a per-AZ p99 spike on the
# "petsearch - p99 latency by AZ" dashboard widget.
