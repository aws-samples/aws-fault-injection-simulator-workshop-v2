import { Construct } from 'constructs';
import * as CustomResource from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';

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
    }
  
    public getAttachmentId(): string {
      return this.getResponseField('');
    }
  }
  