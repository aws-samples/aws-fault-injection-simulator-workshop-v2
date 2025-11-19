import { Construct } from 'constructs';
import * as CustomResource from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from "aws-cdk-lib";
import * as cr from 'aws-cdk-lib/custom-resources';

interface TransitGatewayPeeringIdentifierProps {
  region: string;
}

interface TransitGatewayPeeringAcceptorProps {
  region: string;
  TransitGatewayAttachmentId: string;
}

export class TransitGatewayPeeringIdentifier extends CustomResource.AwsCustomResource {
  constructor(scope: Construct, name: string, props: TransitGatewayPeeringIdentifierProps) {
    const { region } = props;

    const describeAttachmentsSdkCall: CustomResource.AwsSdkCall = {
      service: 'EC2',
      action: 'describeTransitGatewayPeeringAttachments',
      parameters: {
        Filters: [
          {
            Name: 'state',
            Values: ['pendingAcceptance'],
          },
        ],
      },
      region,
      physicalResourceId: CustomResource.PhysicalResourceId.of(Date.now().toString()),
      //outputPaths: ['TransitGatewayPeeringAttachments.0.TransitGatewayAttachmentId'],
    };

    const ec2CrPolicy = CustomResource.AwsCustomResourcePolicy.fromStatements([
      new iam.PolicyStatement({
        actions: [
          'ec2:DescribeTransitGatewayPeeringAttachments',
        ],
        resources: ['*'],
      }),
    ]);

    super(scope, name, {
      onUpdate: describeAttachmentsSdkCall,
      policy: ec2CrPolicy,
    });
    
    // Fix IAM eventual consistency - ensure role is created before Lambda
    const role = this.node.findChild('CustomResourcePolicy').node.defaultChild;
    const lambdaResource = this.node.findChild('Resource').node.defaultChild;
    if (role && lambdaResource) {
      lambdaResource.node.addDependency(role);
    }
  }

  public getAttachmentId(): string {
    return this.getResponseField('TransitGatewayPeeringAttachments.0.TransitGatewayAttachmentId').toString();
  }
}

export class TransitGatewayPeeringAcceptor extends CustomResource.AwsCustomResource {
  constructor(scope: Construct, name: string, props: TransitGatewayPeeringAcceptorProps) {
    const { region, TransitGatewayAttachmentId } = props;

    const acceptAttachmentSdkCall: CustomResource.AwsSdkCall = {
      service: 'EC2',
      action: 'acceptTransitGatewayPeeringAttachment',
      parameters: {
        TransitGatewayAttachmentId: TransitGatewayAttachmentId,
      },
      region,
      physicalResourceId: CustomResource.PhysicalResourceId.of(Date.now().toString()),
    };

    const ec2CrPolicy = CustomResource.AwsCustomResourcePolicy.fromStatements([
      new iam.PolicyStatement({
        actions: [
          'ec2:DescribeTransitGatewayPeeringAttachments',
          'ec2:AcceptTransitGatewayPeeringAttachment',
        ],
        resources: ['*'],
      }),
    ]);

    super(scope, name, {
      onUpdate: acceptAttachmentSdkCall,
      policy: ec2CrPolicy,
    });
    
    // Fix IAM eventual consistency - ensure role is created before Lambda
    const role = this.node.findChild('CustomResourcePolicy').node.defaultChild;
    const lambdaResource = this.node.findChild('Resource').node.defaultChild;
    if (role && lambdaResource) {
      lambdaResource.node.addDependency(role);
    }
  }

  public getAttachmentId(): string {
    return this.getResponseField('');
  }
}

export class TransitGatewayPeeringAttachmentWaiter extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create the Lambda function
    const lambdaFunction = new lambda.Function(this, 'TransitGatewayPeeringAttachmentWaiterFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(15),
      code: lambda.Code.fromAsset('lib/lambda/tgwpeeringconfirm'),
      environment: {
        PYTHONPATH: '/var/task/lib'
      }
    });

    // Grant the Lambda function permission to describe transit gateway peering attachments
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ec2:DescribeTransitGatewayPeeringAttachments'],
        resources: ['*']
      })
    );

    // Create the custom resource
    const tgwWaiterResource = new cr.AwsCustomResource(this, 'TransitGatewayPeeringAttachmentWaiterResource', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: lambdaFunction.functionName,
          InvocationType: 'RequestResponse'
        },
        physicalResourceId: cr.PhysicalResourceId.of('TransitGatewayPeeringAttachmentWaiter')
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["lambda:InvokeFunction"],
          resources: ["*"],
        }),
      ])
    });
    
    // Fix IAM eventual consistency - ensure role is created before Lambda
    const role = tgwWaiterResource.node.findChild('CustomResourcePolicy').node.defaultChild;
    const lambdaResource = tgwWaiterResource.node.findChild('Resource').node.defaultChild;
    if (role && lambdaResource) {
      lambdaResource.node.addDependency(role);
    }
  }
}
