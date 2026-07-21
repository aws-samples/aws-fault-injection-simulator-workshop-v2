import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AZDashboard } from './dashboards/az_dashboard';
import { LatencyByAZDashboard } from './dashboards/latency_az_dashboard';
import { ContributorInsights } from './dashboards/contributor_insights';
import { OpsAlarms } from './dashboards/ops_alarms';

export class ObservabilityDashboard extends cdk.Stack {

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        new AZDashboard(this);
        new LatencyByAZDashboard(this);
        // Contributor Insights rules ranking top instance/AZ/node by errors or
        // latency. The latency dashboard renders the matching insightRule widgets.
        new ContributorInsights(this);
        // Golden-signal CloudWatch alarms + SNS topic for on-call paging.
        new OpsAlarms(this);
    }
}
