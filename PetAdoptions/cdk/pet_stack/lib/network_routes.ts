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

        const ssmTGWId = new SSMParameterReader(this, 'ssmTGWId', {
            parameterName: "/petstore/tgwid",
            region: props.MainRegion
        });
        const mainTGWId = ssmTGWId.getParameterValue();

        const ssmVPCCIDRMain = new SSMParameterReader(this, 'ssmVPCCIDRMain', {
            parameterName: "/petstore/vpccidr",
            region: props.MainRegion
        });
        const mainVPCCIDRMain = ssmVPCCIDRMain.getParameterValue();

        const ssmtransitGatewayRouteTableMain = new SSMParameterReader(this, 'ssmtransitGatewayRouteTableMain', {
            parameterName: "/petstore/tgwroutetableid",
            region: props.MainRegion
        });
        const transitGatewayRouteTableIDMain = ssmtransitGatewayRouteTableMain.getParameterValue();

        const ssmVPCCIDRSecond = new SSMParameterReader(this, 'ssmVPCCIDRSecond', {
            parameterName: "/petstore/vpccidr",
            region: props.SecondaryRegion
        });
        const mainVPCCIDRSecond = ssmVPCCIDRSecond.getParameterValue();

        const ssmtransitGatewayRouteTableSecond = new SSMParameterReader(this, 'ssmtransitGatewayRouteTableSecond', {
            parameterName: "/petstore/tgwroutetableid",
            region: props.SecondaryRegion
        });
        const transitGatewayRouteTableIDSecond = ssmtransitGatewayRouteTableSecond.getParameterValue();

        if (props.DeploymentType == "primary") {
        const TransitGatewayRouteMain = new ec2.CfnTransitGatewayRoute(this, 'TransitGatewayRouteMain', {
            destinationCidrBlock: mainVPCCIDRSecond,
            transitGatewayRouteTableId: transitGatewayRouteTableIDMain,
            // the properties below are optional
            blackhole: false,
            transitGatewayAttachmentId: TransitGatewayAttachmentId.getAttachmentId(),
        });
        } else {
            
        }



        // const TransitGatewayRouteSecond = new ec2.CfnTransitGatewayRoute(this, 'TransitGatewayRouteSecond', {
        //     destinationCidrBlock: mainVPCCIDRSecond,
        //     transitGatewayRouteTableId: transitGatewayRouteTableIDMain,
        //     // the properties below are optional
        //     blackhole: false,
        //     transitGatewayAttachmentId: TransitGatewayAttachmentId.getAttachmentId(),
        // });

        // TransitGatewayRouteSecond.node.addDependency(TransitGatewayPeeringAttachmentAccepted)

    }
};