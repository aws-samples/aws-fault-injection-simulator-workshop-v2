#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR/iam/"
aws iam create-role --role-name fis-az-app-slowdown-role --assume-role-policy-document file://fis-az-app-slowdown-trust-policy.json
aws iam put-role-policy --role-name fis-az-app-slowdown-role --policy-name fis-az-app-slowdown-policy --policy-document file://fis-az-app-slowdown-task-policy.json
echo "IAM role fis-az-app-slowdown-role created and policy attached."
