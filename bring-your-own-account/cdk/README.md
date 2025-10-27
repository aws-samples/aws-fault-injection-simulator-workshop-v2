# AWS Fault Injection Simulator Workshop - Bring Your Own Account Setup

This guide helps you set up the AWS Fault Injection Simulator Workshop in your own AWS account using the AWS Cloud Development Kit (CDK). See the [Bring your own AWS account](https://catalog.workshops.aws/fis-v2/en-US/environment/bring-your-own) page in the Chaos Engineering Workshop V2 for more details.

## Prerequisites
Before you begin, ensure you have satisfied the following prerequisites.

### Local Development Environment
- Node.js (version 18 or later) and Node Package Manager (npm)
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) configured with your credentials
- [AWS CDK v2](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- Git
- Docker

### AWS Account Requirements
- An AWS account [bootstrapped](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-bootstrap.html) for the AWS CDK in both the us-east-1 and us-west-2 Regions
```bash
cdk bootstrap aws://{account-id}/us-east-1 aws://{account-id}/us-west-2
```
- If not using the default IAM service roles created by the bootstrapping process, an IAM role with sufficient permissions to deploy all of the workshop stacks. See [Customize bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-customizing.html) and [Secure CDK deployments with IAM permission boundaries](https://aws.amazon.com/blogs/devops/secure-cdk-deployments-with-iam-permission-boundaries/) for more details.

### Environment Variables
- `eeTeamRoleArn`: The ARN of the IAM role you will be using to execute the workshop. This role can be different than the role with AdministratorAccess permissions used to created the workshop infrastructure via CDK, but should have the same permissions.

#### Optional Parameters
- `environmentName`: A prefix to apply to resource names (default: `EEPipeline`).
- `gitRepoUrl`: URL of the project repo to pull for the CodeBuild job, e.g. a fork for working on feature branches. Default is the [upstream project repo]('https://github.com/aws-samples/aws-fault-injection-simulator-workshop-v2.git').
- `gitBranch`: Git branch to pull for the CodeBuild job. The default is an empty string (`""`) for `main`.
- `isEventEngine`: Set to `false` (default) if deploying in your own account or `true` if deploying in an AWS provided environment, e.g. workshop.

## Installation Steps
- Clone the workshop repository:
```bash
git clone https://github.com/aws-samples/aws-fault-injection-simulator-workshop-v2.git
cd aws-fault-injection-simulator-workshop-v2/bring-your-own-account/cdk
```
- Install dependencies:
```bash
npm install
```
- Set Environment Variables:
```bash
export eeTeamRoleArn=<your-team-role-arn> # for example arn:aws:iam::123456789012:role/TeamRole
```
- Deploy the workshop supporting infrastructure in FisWorkshopStack. The CodePipeline pipeline that launches the PetAdoptions application should start automatically.

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
The workshop deployment should start automatically when the `build.zip` is uploaded to the S3 bucket, which triggers the CodePipeline job. If it does not, you can start the job directly in CodeBuild using
```bash
aws codebuild start-build --project-name FIS-Workshop-Build
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