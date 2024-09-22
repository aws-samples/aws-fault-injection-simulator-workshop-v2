import { TransitGatewayPeeringAcceptor, TransitGatewayPeeringAttachmentWaiter, TransitGatewayPeeringIdentifier } from './common/tgw-connection-accepter';
import { Construct } from 'constructs'
import { RegionNetworkConnectProps } from './common/services-shared-properties';
import { SSMParameterReader } from './common/ssm-parameter-reader';
import { Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { createTGWRoutes } from './common/services-shared';

export class RegionNetworkConnect extends Stack {
    constructor(scope: Construct, id: string, props: RegionNetworkConnectProps) {
        super(scope, id, props);
        const stack = Stack.of(this);
        const region = stack.region;
        
        let isPrimaryRegionDeployment
        if (props.DeploymentType as string == 'primary') {
            isPrimaryRegionDeployment = true
        } else {
            isPrimaryRegionDeployment = false
        }

        const transitGatewayAttachmentId = new TransitGatewayPeeringIdentifier(this, 'TransitGatewayAttachmentId', {
            region: props.MainRegion as string
        });

        this.createSsmParameters(new Map(Object.entries({
            '/petstore/tgwattachmentid': transitGatewayAttachmentId.getAttachmentId()
         })));

        const transitGatewayPeeringAttachmentAccepted = new TransitGatewayPeeringAcceptor(this, 'TransitGatewayPeeringAttachmentAccepted', {
            region: props.MainRegion as string,
            TransitGatewayAttachmentId: transitGatewayAttachmentId.getAttachmentId()
        });

        const transitGatewayPeeringAttachmentWaiter = new TransitGatewayPeeringAttachmentWaiter(this, 'TgwPeeringAttachmentWaiter');
        transitGatewayPeeringAttachmentWaiter.node.addDependency(transitGatewayPeeringAttachmentAccepted);
 
    }

private createSsmParameters(params: Map<string, string>) {
            params.forEach((value, key) => {
                //const id = key.replace('/', '_');
                new ssm.StringParameter(this, key, { parameterName: key, stringValue: value });
            });
        }

            
        
};