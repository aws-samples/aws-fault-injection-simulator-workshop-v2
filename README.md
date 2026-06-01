## AWS Fault Injection Simulator Workshop

This repo contains a sample application which is used in the AWS Fault Injection Simulator Workshop.

## Participant Access

Workshop participants use **AWS CloudShell** or their local terminal. No IDE infrastructure (Cloud9/VSCode Server) is required.

### Quick Start (CloudShell)

Open [AWS CloudShell](https://console.aws.amazon.com/cloudshell/) in the workshop account and run:

```bash
export AWS_REGION=us-east-1
curl -sSL https://raw.githubusercontent.com/aws-samples/aws-fault-injection-simulator-workshop-v2/main/setup-cloudshell.sh | bash
```

This installs `kubectl`, `helm`, and `eksctl`, configures EKS access, and prints the PetSite URL.

### Bring Your Own Account

See [bring-your-own-account/cdk/README.md](bring-your-own-account/cdk/README.md) for deploying the workshop in your own AWS account.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

