#!/bin/sh
# Creates the SHARED FIS role used by BOTH AZ-slowdown labs:
#   - AZ: Application Slowdown  (013scenarious/az-app-slowdown)
#   - Cross-AZ: Traffic Slowdown (013scenarious/cross-az-traffic-slowdown)
# Both scenarios need identical FIS permissions, and this role is mapped into the
# PetSite EKS cluster's aws-auth by the CDK, so it authorizes ECS + EKS + EC2 actions.
# Safe to run more than once and from either lab (idempotent).
ROLE=fis-az-app-slowdown-role
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR/iam/" || { echo "ERROR: cannot cd to $REPO_DIR/iam/ — run this from the az-app-slowdown-experiment dir." >&2; exit 1; }

if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "Role $ROLE already exists — reusing it (expected if you already did the other AZ-slowdown lab). Skipping create."
else
  if ! aws iam create-role --role-name "$ROLE" \
        --assume-role-policy-document file://fis-az-app-slowdown-trust-policy.json >/dev/null; then
    echo "ERROR: failed to create IAM role $ROLE. Check your permissions and that fis-az-app-slowdown-trust-policy.json exists in $(pwd)." >&2
    exit 1
  fi
  echo "Created IAM role $ROLE."
fi

if ! aws iam put-role-policy --role-name "$ROLE" \
      --policy-name fis-az-app-slowdown-policy \
      --policy-document file://fis-az-app-slowdown-task-policy.json; then
  echo "ERROR: failed to attach policy to $ROLE. The role may exist without its permissions — re-run after fixing access, or check fis-az-app-slowdown-task-policy.json is present in $(pwd)." >&2
  exit 1
fi
echo "IAM role $ROLE is ready (trust + permissions policy attached)."

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
