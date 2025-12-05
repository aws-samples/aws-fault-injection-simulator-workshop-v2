# Cross-AZ Traffic Slowdown Experiment

## Overview

This experiment injects **packet loss** on network traffic between Availability Zones to simulate **gray failures** that impair cross-AZ communication. Unlike complete AZ failures, gray failures cause degraded performance through increased retransmissions and timeouts that can be harder to detect and diagnose.

### Cross-AZ Traffic Slowdown vs AZ Application Slowdown

| Aspect | AZ Application Slowdown | Cross-AZ Traffic Slowdown |
|--------|------------------------|---------------------------|
| **Fault Type** | Network latency | Packet loss |
| **Scope** | Within single AZ | Between AZs |
| **Effect** | Adds delay to all traffic | Drops packets causing retransmissions |
| **Use Case** | Simulate slow resources in an AZ | Simulate degraded cross-AZ network |
| **Actions** | `task-network-latency`, `pod-network-latency` | `task-network-packet-loss`, `pod-network-packet-loss` |
| **SSM Document** | `AWSFIS-Run-Network-Latency-Sources` | `AWSFIS-Run-Network-Packet-Loss-Sources` |
| **Default Tag** | `AZApplicationSlowdown` | `CrossAZTrafficSlowdown` |

The experiment targets three resource types in parallel:
- **ECS Tasks** - Using `aws:ecs:task-network-packet-loss`
- **EKS Pods** - Using `aws:eks:pod-network-packet-loss`
- **EC2 Instances** - Using `aws:ssm:send-command` with the `AWSFIS-Run-Network-Packet-Loss-Sources` document

## Prerequisites

### General Requirements
- AWS FIS service access in your account
- IAM role with the required permissions (see [IAM Setup](#iam-setup))
- Resources tagged appropriately for targeting (see [Tagging Requirements](#tagging-requirements))
- At least 2 Availability Zones in your region

### For ECS Targets
- ECS tasks running in the target Availability Zone
- Tasks tagged with `CrossAZTrafficSlowdown=PacketLossForECS`

### For EKS Targets
- EKS cluster with the FIS experiment service account configured (`fis-experiment-sa`)
- Pods labeled with `CrossAZTrafficSlowdown=PacketLossForEKS`
- Kubernetes RBAC configured for FIS access

### For EC2 Targets
- EC2 instances with SSM Agent installed and running
- Instances tagged with `CrossAZTrafficSlowdown=PacketLossForEC2`
- SSM managed instance registration

## Tagging Requirements

### ECS Tasks
Add the following tag to your ECS task definitions or services:
```
CrossAZTrafficSlowdown=PacketLossForECS
```

### EKS Pods
Add the following label to your Kubernetes deployments:
```yaml
metadata:
  labels:
    CrossAZTrafficSlowdown: PacketLossForEKS
```

### EC2 Instances
Add the following tag to your EC2 instances:
```
CrossAZTrafficSlowdown=PacketLossForEC2
```

## Quick Start

The fastest way to set up and run this experiment is using the provided scripts:

```bash
# 1. Set up IAM role and policies
./scripts/setup_cross_az_traffic_slowdown.sh

# 2. Create the experiment template (interactive)
./scripts/create_experiment_template.sh

# 3. Run the experiment
./scripts/run_experiment.sh
```

## IAM Setup

### Option 1: Use the Setup Script (Recommended)

```bash
cd cross-az-traffic-slowdown-experiment
./scripts/setup_cross_az_traffic_slowdown.sh
```

### Option 2: Manual Setup

#### Create the IAM Role

Create an IAM role named `fis-cross-az-traffic-slowdown-role` with the trust policy:

```bash
aws iam create-role \
  --role-name fis-cross-az-traffic-slowdown-role \
  --assume-role-policy-document file://iam/fis-cross-az-traffic-slowdown-trust-policy.json
```

#### Attach the Task Policy

Attach the permissions policy to the role:

```bash
aws iam put-role-policy \
  --role-name fis-cross-az-traffic-slowdown-role \
  --policy-name fis-cross-az-traffic-slowdown-task-policy \
  --policy-document file://iam/fis-cross-az-traffic-slowdown-task-policy.json
```

## Running the Experiment

### Step 1: Create the Experiment Template

The `create_experiment_template.sh` script will:
- Prompt for the target Availability Zone
- Auto-discover other AZs in the region for packet loss destinations
- Prompt for EKS cluster configuration (optional)
- Create the experiment template with all placeholders substituted

```bash
./scripts/create_experiment_template.sh
```

### Step 2: Run the Experiment

```bash
./scripts/run_experiment.sh
```

Or manually:

```bash
aws fis start-experiment \
  --experiment-template-id <template-id>
```

### Step 3: Monitor the Experiment

Monitor the experiment status:

```bash
aws fis get-experiment --id <experiment-id>
```

Watch the experiment state:

```bash
watch -n 5 'aws fis get-experiment --id <experiment-id> --query "experiment.state" --output text'
```

## Experiment Parameters

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `duration` | PT30M (30 minutes) | How long packet loss is injected |
| `lossPercent` | 15 | Percentage of packets to drop |
| `flowsPercent` | 100 | Percentage of network flows affected |
| `sources` | Other AZs in region | Destination AZs for packet loss (auto-discovered) |
| `interface` | DEFAULT | Network interface to target |

### Customizing Parameters

To customize parameters, modify the template file before creating the experiment or edit the values in `templates/fis-cross-az-traffic-slowdown-template.json`:

```json
{
  "parameters": {
    "duration": "PT30M",
    "lossPercent": "15",
    "flowsPercent": "100"
  }
}
```

## Expected Behavior

When the experiment runs:

1. **ECS Tasks**: Tasks in the target AZ will experience 15% packet loss on outbound traffic to other AZs
2. **EKS Pods**: Pods matching the label selector will experience 15% packet loss on cross-AZ traffic
3. **EC2 Instances**: Instances in the target AZ will have packet loss injected via SSM for traffic to other AZs

The `emptyTargetResolutionMode: skip` setting ensures that if no resources match a particular target (e.g., no EKS pods), that action is skipped rather than failing the experiment.

### What to Expect

- **Increased latency**: Packet loss causes TCP retransmissions, increasing effective latency
- **Timeout errors**: Some requests may timeout due to dropped packets
- **Degraded throughput**: Overall network throughput between AZs will decrease
- **Intermittent failures**: Unlike complete outages, failures will be sporadic

## Observing Results

Use the following to observe the impact:

- **CloudWatch Metrics**: Monitor latency and error rate metrics for your services
- **X-Ray Traces**: Observe increased trace durations and error rates
- **Application Logs**: Check for timeout errors, connection resets, or slow response warnings
- **CloudWatch Dashboards**: Use the Pet Adoptions dashboard to visualize impact
- **Network Metrics**: Monitor TCP retransmission rates

### Key Metrics to Watch

- Service response times (P50, P95, P99)
- Error rates (5xx responses)
- TCP retransmission counts
- Connection timeout rates
- Cross-AZ data transfer metrics

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
cross-az-traffic-slowdown-experiment/
├── iam/
│   ├── fis-cross-az-traffic-slowdown-trust-policy.json  # Trust policy for FIS service
│   └── fis-cross-az-traffic-slowdown-task-policy.json   # Permissions for experiment actions
├── scripts/
│   ├── setup_cross_az_traffic_slowdown.sh               # IAM setup script
│   ├── create_experiment_template.sh                    # Create experiment template
│   └── run_experiment.sh                                # Run the experiment
├── templates/
│   └── fis-cross-az-traffic-slowdown-template.json      # FIS experiment template
└── README.md                                             # This file
```

## Related Documentation

- [AWS FIS User Guide](https://docs.aws.amazon.com/fis/latest/userguide/)
- [FIS Action Reference](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html)
- [ECS Task Network Packet Loss Action](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#ecs-actions)
- [EKS Pod Network Packet Loss Action](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#eks-actions)
- [SSM Send Command Action](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#ssm-actions)
- [Gray Failures in AWS](https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/)

## Troubleshooting

### No Templates Found
- Run `./scripts/create_experiment_template.sh` to create a template first
- Verify the template was created successfully by checking the AWS FIS console

### ECS Action Fails
- Verify tasks are tagged with `CrossAZTrafficSlowdown=PacketLossForECS`
- Confirm tasks are running in the specified Availability Zone
- Check IAM role has `ecs:DescribeTasks` and `ecs:DescribeContainerInstances` permissions

### EKS Action Fails
- Verify pods have the label `CrossAZTrafficSlowdown=PacketLossForEKS`
- Confirm the cluster identifier and namespace are correct
- Check the FIS service account (`fis-experiment-sa`) is configured in the cluster
- Verify RBAC permissions for the service account

### EC2 Action Fails
- Verify SSM Agent is installed and running on target instances
- Confirm instances are tagged with `CrossAZTrafficSlowdown=PacketLossForEC2`
- Check instances appear in SSM Fleet Manager
- Verify IAM role has SSM permissions (`ssm:SendCommand`, `ssm:ListCommands`, `ssm:CancelCommand`)

### Experiment Skips All Actions
- Verify resources exist in the target Availability Zone
- Check that resources have the correct tags/labels
- Confirm the target AZ specified matches where your resources are deployed

### IAM Permission Errors
- Re-run `./scripts/setup_cross_az_traffic_slowdown.sh` to ensure role and policies are created
- Verify the role ARN in the template matches the created role
- Check CloudTrail for specific permission denied errors

### CloudWatch Logs Not Appearing
- Ensure the `FISExperiments` log group exists in your account
- Verify the IAM role has `logs:CreateLogDelivery` and `logs:PutLogEvents` permissions
