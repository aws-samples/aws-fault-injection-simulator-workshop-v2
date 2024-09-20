import { TransitGatewayPeeringAcceptor, TransitGatewayPeeringIdentifier } from './common/tgw-connection-accepter';
import { Construct } from 'constructs'
import { RegionNetworkConnectProps } from './common/services-shared-properties';
import { SSMParameterReader } from './common/ssm-parameter-reader';
import { Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class RegionNetworkConnect extends Stack {
    constructor(scope: Construct, id: string, props: RegionNetworkConnectProps) {
        super(scope, id, props);
        const stack = Stack.of(this);
        const region = stack.region;

        const TransitGatewayAttachmentId = new TransitGatewayPeeringIdentifier(this, 'TransitGatewayAttachmentId', {
            region: props.MainRegion as string
        });

        const TransitGatewayPeeringAttachmentAccepted = new TransitGatewayPeeringAcceptor(this, 'TransitGatewayPeeringAttachmentAccepted', {
            region: props.MainRegion as string,
            TransitGatewayAttachmentId: TransitGatewayAttachmentId.getAttachmentId()
        });
        
    }

    private createSsmParameters(params: Map<string, string>) {
            params.forEach((value, key) => {
                //const id = key.replace('/', '_');
                new ssm.StringParameter(this, key, { parameterName: key, stringValue: value });
            });

            this.createSsmParameters(new Map(Object.entries({
               '/petstore/errormode1': "false"
            })));
    
        }
};