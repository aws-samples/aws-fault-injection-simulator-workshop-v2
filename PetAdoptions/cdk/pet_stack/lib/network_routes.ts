import { TransitGatewayPeeringAcceptor, TransitGatewayPeeringIdentifier } from './common/tgw-connection-accepter';
import { Construct } from 'constructs'
import { RegionNetworkConnectProps } from './common/services-shared-properties';
import { SSMParameterReader } from './common/ssm-parameter-reader';
import { Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { createTGWRoutes } from './common/services-shared';

export class RegionNetworkRoutes extends Stack {
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

        const mainTGWRoutes =  createTGWRoutes({
            scope: this,
            isPrimaryRegionDeployment: isPrimaryRegionDeployment,
            mainRegion: props.MainRegion as string,
            secondaryRegion: props.SecondaryRegion as string,
        })
    }
};