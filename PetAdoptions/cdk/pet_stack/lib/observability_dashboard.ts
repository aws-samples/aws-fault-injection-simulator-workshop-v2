import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ServiceStackProps } from './common/services-shared-properties';
import { MultiRegionDashboard } from './dashboards/multi_region_dashboard';
import { AZDashboard } from './dashboards/az_dashboard';

export class ObservabilityDashboard extends cdk.Stack {

    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        new MultiRegionDashboard(this, props);

        new AZDashboard(this, props);
        
    }
}

