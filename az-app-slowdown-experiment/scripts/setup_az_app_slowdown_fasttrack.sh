#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR/iam/"
aws iam create-role --role-name fis-az-app-slowdown-role --assume-role-policy-document file://fis-az-app-slowdown-trust-policy.json
aws iam put-role-policy --role-name fis-az-app-slowdown-role --policy-name fis-az-app-slowdown-policy --policy-document file://fis-az-app-slowdown-task-policy.json
echo "IAM role fis-az-app-slowdown-role created and policy attached."

# Note: the experiment template uses the aws:ecs:task-network-latency action,
# targeting the petsearch ECS tasks directly. petsearch runs in awsvpc network
# mode, so each task has its OWN ENI — host-level netem on ens5 does NOT affect
# task traffic. The aws:ecs:task action injects latency on the task's network
# path (via the FIS SSM-agent sidecar already in the petsearch task definition,
# which registers each task as an SSM Managed Instance tagged with
# ECS_TASK_AVAILABILITY_ZONE / ECS_TASK_ARN).
#
# To scope to a single AZ, set the target resourceArns to the petsearch task
# ARN running in the desired AZ, e.g.:
#   CLUSTER=<petsearch cluster name>
#   for t in $(aws ecs list-tasks --cluster "$CLUSTER" --query 'taskArns' --output text); do
#     az=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$t" --query 'tasks[0].availabilityZone' --output text)
#     echo "$az $t"
#   done
# then substitute the us-east-1a task ARN into the template's resourceArns.
#
# The injected latency surfaces as a per-AZ p99 spike on the petsearch
# "request latency by AZ" widget of the PetAdoptions-Latency-by-AZ dashboard,
# and ranks the impaired task in the ECS Contributor Insights "top instances by
# latency" view.
