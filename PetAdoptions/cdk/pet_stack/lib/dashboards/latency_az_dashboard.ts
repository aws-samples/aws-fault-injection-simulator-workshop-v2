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

        // X-Ray downstream-edge latency widget for petsearch. The az-app-slowdown
        // experiment injects egress (outbound) network latency, which compounds on
        // petsearch's downstream calls (S3, DynamoDB) rather than on its own
        // server-side request timing — so it shows here, not in per-request
        // latency. Uses the X-Ray ResponseTime metric for the PetSearch service.
        // Full-width so the avg/p90 lines are easy to read.
        const xrayEdgeWidget = {
            type: 'metric',
            x: 0, y: 28, width: 24, height: 7,
            properties: {
                title: 'petsearch — X-Ray response time (catches downstream/egress latency, e.g. az-app-slowdown)',
                region,
                view: 'timeSeries',
                stat: 'Average',
                period: 60,
                yAxis: { left: { min: 0, label: 'Seconds' } },
                metrics: [
                    ['AWS/X-Ray', 'ResponseTime', 'ServiceName', 'PetSearch', { stat: 'Average', label: 'avg' }],
                    ['AWS/X-Ray', 'ResponseTime', 'ServiceName', 'PetSearch', { stat: 'p90', label: 'p90' }],
                ],
            },
        };

        // One full-width graph per service, plotting avg + p90 latency per AZ.
        // Full width (24) + only two statistics keeps each graph readable — the
        // earlier half-width avg/p90/p99-per-AZ layout produced too many lines in
        // too small a box. avg shows a steady latency shift; p90 shows the tail.
        const body = {
            widgets: [
                {
                    type: 'text', x: 0, y: 0, width: 24, height: 3,
                    properties: {
                        markdown: '# PetAdoptions — Latency by Availability Zone\n' +
                            'Pinpoint slowness during FIS experiments. ECS services (payforadoption, ' +
                            'petlistadoptions, petsearch) report **az**; EKS petsite reports **node** ' +
                            '(AZ is not exposed to pods). Each graph is full-width and shows **avg** (solid ' +
                            'latency shift) and **p90** (tail) per AZ — watch which **AZ / node diverges** ' +
                            'while the others stay flat.\n\n' +
                            '> Note: egress-latency faults (e.g. az-app-slowdown) compound on **downstream** ' +
                            'calls (S3/DynamoDB), not on a service\'s own request timing — the petsearch ' +
                            'X-Ray response-time graph at the bottom captures that, as does the ALB ' +
                            '"Target Response Time by AZ" widget on the AvailabilityZonePowerImpairment dashboard.'
                    }
                },
                logWidget('payforadoption — latency by AZ (avg / p90, ms)',
                    "SOURCE '/ecs/PayForAdoption' | fields az, latency_ms | filter ispresent(latency_ms) | stats avg(latency_ms) as avg_ms, pct(latency_ms,90) as p90_ms by az, bin(1m)",
                    0, 3, 24, 6),
                logWidget('petlistadoptions — latency by AZ (avg / p90, ms)',
                    "SOURCE '/ecs/PetListAdoptions' | fields az, latency_ms | filter ispresent(latency_ms) | stats avg(latency_ms) as avg_ms, pct(latency_ms,90) as p90_ms by az, bin(1m)",
                    0, 9, 24, 6),
                // Glob parse (not regex) to avoid backslash-escaping ambiguity
                // through the TS-string -> JSON.stringify -> CfnDashboard path,
                // which previously double-escaped \d+ and silently emptied this
                // widget. petsearch logs az/latency_ms inside the @message string
                // (the other ECS services expose them as native JSON fields).
                logWidget('petsearch — request latency by AZ (avg / p90, ms)',
                    "SOURCE '/ecs/PetSearchEc2' | parse @message \"az=* instance=* path=* status=* latency_ms=* bytes=*\" as az, p_instance, p_path, p_status, lat, p_bytes | filter ispresent(lat) | stats avg(lat) as avg_ms, pct(lat,90) as p90_ms by az, bin(1m)",
                    0, 15, 24, 6),
                logWidget('petsite — latency by node (avg / p90, ms, EKS)',
                    "SOURCE '/aws/containerinsights/PetSite/application' | filter ispresent(log_processed.State.LatencyMs) | stats avg(log_processed.State.LatencyMs) as avg_ms, pct(log_processed.State.LatencyMs,90) as p90_ms by log_processed.State.Node, bin(1m)",
                    0, 21, 24, 7),
                xrayEdgeWidget,
                logWidget('Latency + error summary by service / AZ (sorted slowest first)',
                    "SOURCE '/ecs/PayForAdoption' | SOURCE '/ecs/PetListAdoptions' | fields service, az, latency_ms, err | filter ispresent(latency_ms) | stats count(*) as reqs, avg(latency_ms) as avg_ms, pct(latency_ms,90) as p90_ms, pct(latency_ms,99) as p99_ms, sum(err!='') as errors by service, az | sort avg_ms desc",
                    0, 35, 24, 6, 'table'),
            ]
        };

        new cloudwatch.CfnDashboard(this, 'Resource', {
            dashboardName: 'PetAdoptions-Latency-by-AZ',
            dashboardBody: JSON.stringify(body),
        });
    }
}
