import { Arn, Stack } from 'aws-cdk-lib';
import * as CustomResource from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface SSMParameterReaderProps {
  parameterName: string;
  region: string;
}

function removeLeadingSlash(value: string): string {
  return value.slice(0, 1) == '/' ? value.slice(1) : value;
}
export class SSMParameterReader extends CustomResource.AwsCustomResource {
  constructor(scope: Construct, name: string, props: SSMParameterReaderProps) {
    const { parameterName, region } = props;

    const ssmAwsSdkCall: CustomResource.AwsSdkCall = {
      service: 'SSM',
      action: 'getParameter',
      parameters: {
        Name: parameterName,
      },
      region,
      physicalResourceId: CustomResource.PhysicalResourceId.of(Date.now().toString()),

    };

    const ssmCrPolicy = CustomResource.AwsCustomResourcePolicy.fromSdkCalls({
      resources: [
        Arn.format(
          {
            service: 'ssm',
            region: props.region,
            resource: 'parameter',
            resourceName: removeLeadingSlash(parameterName),
          },
          Stack.of(scope),
        ),
      ],
    });

    super(scope, name, { onUpdate: ssmAwsSdkCall, policy: ssmCrPolicy });
    
    // Fix IAM eventual consistency - ensure role is created before Lambda
    const role = this.node.findChild('CustomResourcePolicy').node.defaultChild;
    const lambda = this.node.findChild('Resource').node.defaultChild;
    if (role && lambda) {
      lambda.node.addDependency(role);
    }
  }

  public getParameterValue(): string {
    return this.getResponseField('Parameter.Value').toString();
  }
}