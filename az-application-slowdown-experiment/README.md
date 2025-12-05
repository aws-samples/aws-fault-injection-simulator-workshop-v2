# AZ: Application Slowdown Experiment

## Overview

This experiment introduces network latency between resources within a single Availability Zone to simulate **gray failures** (partial disruptions). Unlike complete AZ failures, gray failures cause degraded performance that can be harder to detect and diagnose.

The experiment targets three resource types in parallel:
- **ECS Tasks** - Using `aws:ecs:task-network-latency`
- **EKS Pods** - Using `aws:eks:pod-network-latency`
- **EC2 Instances** - Using `aws:ssm:send-command` with the `AWSFIS-Run-Network-Latency-Sources` document

## Prerequisites

### General Requirements
- AWS FIS service access in your account
- IAM role with the required permissions (see [IAM Setup](#iam-setup))
- Resources tagged appropriately for targeting (see [Tagging Requirements](#tagging-requirements))

### For ECS Targets
- ECS tasks running in the target Availability Zone
- Tasks tagged with `AZApplicationSlowdown=LatencyForECS`

### For EKS Targets
- EKS cluster with the FIS experiment service account configured
- Pods labeled with `AZApplicationSlowdown=LatencyForEKS`
- Kubernetes RBAC configured for FIS access

### For EC2 Targets
- EC2 instances with SSM Agent installed and running
- Instances tagged with `AZApplicationSlowdown=LatencyForEC2`
- SSM managed instance registration

## Tagging Requirements

### ECS Tasks
Add the following tag to your ECS task definitions or services:
```
AZApplicationSlowdown=LatencyForECS
```

### EKS Pods
Add the following label to your Kubernetes deployments:
```yaml
metadata:
  labels:
    AZApplicationSlowdown: LatencyForEKS
```

### EC2 Instances
Add the following tag to your EC2 instances:
```
AZApplicationSlowdown=LatencyForEC2
```

## Quick Start

The fastest way to set up and run this experiment is using the provided scripts:

```bash
# 1. Set up IAM role and policies
./scripts/setup_az_app_slowdown.sh

# 2. Create the experiment template (interactive)
./scripts/create_experiment_template.sh

# 3. Run the experiment
./scripts/run_experiment.sh
```

## IAM Setup

### Option 1: Use the Setup Script (Recommended)

```bash
cd az-application-slowdown-experiment
./scripts/setup_az_app_slowdown.sh
```

### Option 2: Manual Setup

#### Create the IAM Role

Create an IAM role named `fis-az-app-slowdown-role` with the trust policy:

```bash
aws iam create-role \
  --role-name fis-az-app-slowdown-role \
  --assume-role-policy-document file://iam/fis-az-app-slowdown-trust-policy.json
```

#### Attach the Task Policy

Attach the permissions policy to the role:

```bash
aws iam put-role-policy \
  --role-name fis-az-app-slowdown-role \
  --policy-name fis-az-app-slowdown-task-policy \
  --policy-document file://iam/fis-az-app-slowdown-task-policy.json
```

## Running the Experiment

### Step 1: Update the Template

Before creating the experiment, update the template placeholders in `templates/fis-az-app-slowdown-template.json`:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `your_availability_zone_identifier` | Target AZ for latency injection | `us-east-1a` |
| `your_aws_account` | Your AWS account ID | `123456789012` |
| `your_region` | AWS region | `us-east-1` |
| `your_eks_cluster_identifier` | EKS cluster name (if using EKS) | `PetSite` |

### Step 2: Create the Experiment Template

```bash
aws fis create-experiment-template \
  --cli-input-json file://templates/fis-az-app-slowdown-template.json
```

### Step 3: Run the Experiment

```bash
aws fis start-experiment \
  --experiment-template-id <template-id>
```

### Step 4: Monitor the Experiment

Monitor the experiment status:

```bash
aws fis get-experiment --id <experiment-id>
```

## Experiment Parameters

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| Duration | 30 minutes | How long latency is injected |
| Latency | 200ms | Additional network delay |
| Traffic Type | all | Affects all network traffic |
| Sources | 0.0.0.0/0 | All source IP addresses |

## Expected Behavior

When the experiment runs:

1. **ECS Tasks**: Tasks in the target AZ will experience 200ms additional latency on all network traffic
2. **EKS Pods**: Pods matching the label selector will experience 200ms additional latency
3. **EC2 Instances**: Instances in the target AZ will have latency injected via SSM

The `emptyTargetResolutionMode: skip` setting ensures that if no resources match a particular target (e.g., no EKS pods), that action is skipped rather than failing the experiment.

## Observing Results

Use the following to observe the impact:

- **CloudWatch Metrics**: Monitor latency metrics for your services
- **X-Ray Traces**: Observe increased trace durations
- **Application Logs**: Check for timeout errors or slow response warnings
- **CloudWatch Dashboards**: Use the Pet Adoptions dashboard to visualize impact

## Cleanup

To stop a running experiment:

```bash
aws fis stop-experiment --id <experiment-id>
```

To delete the experiment template:

```bash
aws fis delete-experiment-template --id <template-id>
```

## File Structure

```
az-application-slowdown-experiment/
├── iam/
│   ├── fis-az-app-slowdown-trust-policy.json  # Trust policy for FIS service
│   └── fis-az-app-slowdown-task-policy.json   # Permissions for experiment actions
├── scripts/
│   ├── setup_az_app_slowdown.sh               # IAM setup script
│   ├── create_experiment_template.sh          # Create experiment template
│   └── run_experiment.sh                      # Run the experiment
├── templates/
│   └── fis-az-app-slowdown-template.json      # FIS experiment template
└── README.md                                   # This file
```

## Related Documentation

- [AWS FIS User Guide](https://docs.aws.amazon.com/fis/latest/userguide/)
- [FIS Action Reference](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html)
- [ECS Task Network Latency Action](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#ecs-actions)
- [EKS Pod Network Latency Action](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#eks-actions)
- [SSM Send Command Action](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#ssm-actions)
- [Gray Failures in AWS](https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/)

## Troubleshooting

### ECS Action Fails
- Verify tasks are tagged with `AZApplicationSlowdown=LatencyForECS`
- Confirm tasks are running in the specified Availability Zone
- Check IAM role has `ecs:DescribeTasks` and `ecs:DescribeContainerInstances` permissions

### EKS Action Fails
- Verify pods have the label `AZApplicationSlowdown=LatencyForEKS`
- Confirm the cluster identifier and namespace are correct
- Check the FIS service account is configured in the cluster

### EC2 Action Fails
- Verify SSM Agent is installed and running on target instances
- Confirm instances are tagged with `AZApplicationSlowdown=LatencyForEC2`
- Check instances appear in SSM Fleet Manager
- Verify IAM role has SSM permissions
