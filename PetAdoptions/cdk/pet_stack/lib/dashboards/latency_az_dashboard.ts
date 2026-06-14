import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

/**
 * Latency-by-Availability-Zone dashboard.
 *
 * Built from CloudWatch Logs Insights queries over the structured per-request
 * log lines that every PetAdoptions service now emits (service / az / instance /
 * node / latency_ms). Its purpose is to pinpoint slowness during FIS experiments:
 * when latency is injected or an AZ/instance is disrupted, the per-AZ p99 lines
 * make it obvious which Availability Zone (or node) is degrading while the others
 * stay flat.
 *
 * Notes on signal availability:
 *  - ECS services (payforadoption, petlistadoptions, petsearch) resolve the AZ at
 *    runtime from the ECS Task Metadata v4 endpoint, so they split cleanly by `az`.
 *  - petsite/pethistory run on EKS where the AZ is not exposed to pods; they report
 *    the `node` (EC2 instance DNS) instead, which maps to an AZ/instance.
 */
export class LatencyByAZDashboard extends Construct {
    constructor(scope: Construct) {
        super(scope, 'LatencyByAZDashboard');

        const region = cdk.Stack.of(this).region;

        const logWidget = (title: string, query: string,
                           x: number, y: number, w: number, h: number, view = 'timeSeries') => ({
            type: 'log',
            x, y, width: w, height: h,
            properties: { title, region, view, stacked: false, query }
        });

        const body = {
            widgets: [
                {
                    type: 'text', x: 0, y: 0, width: 24, height: 2,
                    properties: {
                        markdown: '# PetAdoptions — Latency by Availability Zone\n' +
                            'Pinpoint slowness during FIS experiments. ECS services (payforadoption, ' +
                            'petlistadoptions, petsearch) report **az**; EKS petsite reports **node** ' +
                            '(AZ is not exposed to pods). When a fault is injected, watch which AZ / node ' +
                            'p99 latency climbs while the others stay flat.'
                    }
                },
                logWidget('payforadoption — p99 latency by AZ',
                    "SOURCE '/ecs/PayForAdoption' | fields az, latency_ms | filter ispresent(latency_ms) | stats pct(latency_ms,99) as p99_ms by az, bin(1m)",
                    0, 2, 12, 6),
                logWidget('petlistadoptions — p99 latency by AZ',
                    "SOURCE '/ecs/PetListAdoptions' | fields az, latency_ms | filter ispresent(latency_ms) | stats pct(latency_ms,99) as p99_ms by az, bin(1m)",
                    12, 2, 12, 6),
                logWidget('petsearch — p99 latency',
                    "SOURCE '/ecs/PetSearchEc2' | parse @message /latency_ms=(?<lat>\\d+)/ | filter ispresent(lat) | stats pct(lat,99) as p99_ms, avg(lat) as avg_ms by bin(1m)",
                    0, 8, 12, 6),
                logWidget('petsite — p99 latency by node (EKS)',
                    "SOURCE '/aws/containerinsights/PetSite/application' | filter ispresent(log_processed.State.LatencyMs) | stats pct(log_processed.State.LatencyMs,99) as p99_ms by log_processed.State.Node, bin(1m)",
                    12, 8, 12, 6),
                logWidget('Latency + error summary by service / AZ',
                    "SOURCE '/ecs/PayForAdoption' | SOURCE '/ecs/PetListAdoptions' | fields service, az, latency_ms, err | filter ispresent(latency_ms) | stats count(*) as reqs, avg(latency_ms) as avg_ms, pct(latency_ms,99) as p99_ms, sum(err!='') as errors by service, az | sort p99_ms desc",
                    0, 14, 24, 6, 'table'),
            ]
        };

        new cloudwatch.CfnDashboard(this, 'Resource', {
            dashboardName: 'PetAdoptions-Latency-by-AZ',
            dashboardBody: JSON.stringify(body),
        });
    }
}
