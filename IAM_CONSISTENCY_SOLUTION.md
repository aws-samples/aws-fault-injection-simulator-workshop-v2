# IAM Role Eventual Consistency Solution

## Problem
AWS IAM roles experience eventual consistency issues where a role is created but not immediately available for use across all AWS services. This causes deployment failures when CDK stacks create IAM roles and immediately try to use them in resources like EC2 launch templates, EKS node groups, or Kubernetes service accounts.

## Solution
Implemented `IamRoleWaiter` constructs that use AWS Lambda custom resources to verify IAM role propagation before dependent resources are created.

## Implementation

### Files Added/Modified

1. **PetAdoptions/cdk/pet_stack/lib/common/iam-role-waiter.ts** - Main IAM role waiter construct
2. **bring-your-own-account/cdk/lib/constructs/iam-role-waiter.ts** - Copy for fis-workshop-stack
3. **PetAdoptions/cdk/pet_stack/lib/services.ts** - Updated to use IAM role waiters
4. **bring-your-own-account/cdk/lib/fis-workshop-stack.ts** - Updated to use IAM role waiters

### How It Works

The `IamRoleWaiter` construct:
1. Creates a Lambda function that attempts to assume the target IAM role
2. Retries up to 30 times with 10-second delays (configurable)
3. Uses CloudFormation custom resources to block dependent resource creation
4. Only proceeds when the role can be successfully assumed

### Usage Example

```typescript
import { IamRoleWaiter } from './common/iam-role-waiter';

// Create IAM role
const myRole = new iam.Role(this, 'MyRole', {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
});

// Wait for eventual consistency
const roleWaiter = new IamRoleWaiter(this, 'MyRoleWaiter', {
    role: myRole,
    timeout: Duration.minutes(5), // optional
});

// Create dependent resource
const launchTemplate = new ec2.LaunchTemplate(this, 'MyLaunchTemplate', {
    role: myRole,
});
launchTemplate.node.addDependency(roleWaiter);
```

### Applied To

**Services Stack:**
- `ecsEc2PetSearchRole` - Used in EC2 launch templates
- `eksPetsiteASGClusterNodeGroupRole` - Used in EKS node groups
- `cwserviceaccount` - Used in Kubernetes manifests
- `xrayserviceaccount` - Used in Kubernetes manifests
- `loadBalancerserviceaccount` - Used in Kubernetes manifests

**FIS Workshop Stack:**
- `codeBuildServiceRole` - Used in CodeBuild projects
- `codePipelineServiceRole` - Used in CodePipeline

### Benefits

1. **Eliminates deployment failures** caused by IAM eventual consistency
2. **Minimal code changes** - just add waiter and dependency
3. **Configurable timeouts** and retry intervals
4. **Reusable construct** across multiple stacks
5. **No impact on successful deployments** - only adds delay when needed

### Configuration

The waiter can be configured with:
- `timeout`: Maximum time to wait (default: 5 minutes)
- `MaxAttempts`: Number of retry attempts (default: 30)
- `DelaySeconds`: Delay between attempts (default: 10 seconds)

This solution ensures reliable deployments by handling AWS IAM's eventual consistency model gracefully.