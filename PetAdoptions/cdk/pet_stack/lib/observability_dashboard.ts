import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AZDashboard } from './dashboards/az_dashboard';
import { LatencyByAZDashboard } from './dashboards/latency_az_dashboard';

export class ObservabilityDashboard extends cdk.Stack {

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        new AZDashboard(this);
        new LatencyByAZDashboard(this);
    }
}
