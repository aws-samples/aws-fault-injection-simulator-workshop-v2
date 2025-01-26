# AWS Fault Injection Simulator Workshop - Bring Your Own Account Setup

This guide helps you set up the AWS Fault Injection Simulator Workshop in your own AWS account using AWS CDK.

## Prerequisites

Before you begin, ensure you have the following:

### AWS Account Requirements
- An AWS account with AdministratorAccess permissions
- Access to regions: us-east-1 (primary) and us-west-2 (secondary)
- Ability to create and manage AWS resources including IAM roles, S3 buckets, CodePipeline, CodeBuild, etc.

### Local Development Environment
- Node.js (version 16.x or later)
- AWS CLI v2 configured with your credentials
- AWS CDK CLI (v2.x)
- Git
- Docker Desktop (latest stable version)

### Environment Variables
- `eeTeamRoleArn`: The ARN of the your role in AWS.

#### Optional Parameters
- `environmentName`: Name prefix for resources (default: "EEPipeline")
- `gitBranch`: Git branch to check out (default: empty string for main branch)
- `isEventEngine`: Variable that define if defines it is your own account ('false') or AWS provided environment ('true'). Default: 'false'



## Installation Steps

1. Clone the workshop repository:
```bash
git clone https://github.com/aws-samples/aws-fault-injection-simulator-workshop-v2.git
cd aws-fault-injection-simulator-workshop-v2/bring-your-own-account [[2]](https://docs.aws.amazon.com/fis/latest/userguide/update.html)
```

2. Install dependencies:

```bash
npm install
```

3. Set Environment Variables:
```bash
export eeTeamRoleArn=<your-team-role-arn> # for example arn:aws:iam::123456789012:role/TeamRole
```

3. Bootstrap CDK in both regions:

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/us-east-1
cdk bootstrap aws://ACCOUNT-NUMBER/us-west-2
```
4. Deploy the workshop infrastructure:

```bash
cdk deploy --all
```
// --context eeTeamRoleArn=arn:aws:iam::123456789012:role/TeamRole

##  Stack Resources
The CDK stack creates the following resources:
+ S3 Bucket for workshop assets
+ CodeBuild projects for build and destroy operations
+ CodePipeline for automated deployment
+ IAM roles and policies
+ Build and destroy specifications

## Workshop Deployment

To trigger builds:

### Start workshop deployment

```bash
aws codebuild start-build --project-name FIS-Workshop-Build
```
### Clean up workshop resources

```bash
aws codebuild start-build --project-name FIS-Workshop-Destroy
```

### Monitoring Deployment
You can monitor the deployment progress through:
+ CodePipeline console
+ CodeBuild console
+  CloudWatch Logs
+  CloudFormation console

## Workshop Components
The deployment will create:
+ VPC and networking components in both regions
+ Pet Adoption application infrastructure
+ FIS experiment templates and resources
+ Observability components
+ User simulation resources

## Clean Up
To remove all workshop resources:
+ Trigger the destroy project:
```bash
aws codebuild start-build --project-name FIS-Workshop-Destroy
```

After the destroy project completes, remove the CDK stack:
```bash
cdk destroy --all
```

## Troubleshooting
Common issues and solutions:
+ Deployment Failures
+ Check CloudWatch Logs for detailed error messages
+ Ensure you have sufficient IAM permissions
+ Verify AWS CLI configuration
+ Region Issues
- Ensure both us-east-1 and us-west-2 are bootstrapped
- Check region-specific service quotas

## Resource Limits

+ Verify service quotas for EC2, VPC, and other services
+ Request quota increases if needed

## Useful Commands

1. Compile TypeScript to JS
```bash
npm run build
```

2. Watch for changes and compile
```bash
npm run watch
```

3. Run unit tests
```bash
npm run test
```

4. Compare deployed stack with current state
```bash
cdk diff
```

5. Generate CloudFormation template
```bash
cdk synth
```

## Security
All sensitive credentials are stored in AWS Secrets Manager
IAM roles follow least privilege principle
VPC endpoints used for enhanced security
All data in transit is encrypted

## Support
For issues related to:

CDK deployment: Open an issue in this repository

Workshop content: Refer to the main workshop documentation

AWS services: Contact AWS Support

License
This project is licensed under the Apache-2.0 License.