import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ServiceStackProps } from './common/services-shared-properties';
import { MultiRegionDashboard } from './dashboards/multi_region_dashboard';
import { AZDashboard } from './dashboards/az_dashboard';
import { getDeploymentConfig } from './common/deployment-config';

export class ObservabilityDashboard extends cdk.Stack {

    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        const deploymentConfig = getDeploymentConfig();
        
        // Only create multi-region dashboard if multi-region is enabled
        if (deploymentConfig.enableMultiRegion) {
            new MultiRegionDashboard(this, props);
        }

        new AZDashboard(this, props);
        
    }
}

