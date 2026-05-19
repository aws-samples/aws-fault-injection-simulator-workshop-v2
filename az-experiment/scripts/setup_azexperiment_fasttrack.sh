#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR/iam/"
aws iam create-role --role-name fis-az-role --assume-role-policy-document file://fis-az-experiment-policy.json
aws iam put-role-policy --role-name fis-az-role --policy-name fis-az-policy --policy-document file://fis-az-task-policy.json
cd "$REPO_DIR/scripts/"
cd "$REPO_DIR/../ecs-experiment/"
sh updatetaskdef.sh
cd -
