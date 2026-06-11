#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR/iam/"
aws iam create-role --role-name fis-cross-az-slowdown-role --assume-role-policy-document file://fis-cross-az-slowdown-trust-policy.json
aws iam put-role-policy --role-name fis-cross-az-slowdown-role --policy-name fis-cross-az-slowdown-policy --policy-document file://fis-cross-az-slowdown-task-policy.json
echo "IAM role fis-cross-az-slowdown-role created and policy attached."
