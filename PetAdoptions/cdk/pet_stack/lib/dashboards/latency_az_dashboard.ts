import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { contributorInsightWidgets } from './contributor_insights';

/**
 * PetAdoptions operational dashboard — "PetAdoptions-Latency-by-AZ".
 *
 * Structured as a production on-call dashboard around the four golden signals
 * (traffic, errors, latency, saturation), top-down by the questions an operator
 * asks during an incident:
 *   1. Is something wrong right now?  -> Service health table + fleet error/latency
 *   2. Where is it (blast radius)?    -> per-AZ latency, who+where tables (CI-backed)
 *   3. Is it spreading / recovering?  -> per-service latency-by-AZ trend lines
 *   4. Is it downstream?              -> ALB target response time + ALB 5xx
 *      (X-Ray ResponseTime is NOT used: this account publishes no AWS/X-Ray
 *      CloudWatch metrics, so an X-Ray widget renders empty.)
 *
 * All request metrics are derived from the uniform structured per-request log
 * line every service emits (service/az/instance/node/path/status/latency_ms/err).
 * ECS services (petsearch, payforadoption, petlistadoptions) log top-level to
 * /ecs/*; EKS services (petsite, pethistory, petfood, petfood-metric) share
 * /aws/containerinsights/PetSite/application with fields under log_processed.*,
 * so cross-platform widgets coalesce(service, log_processed.service) etc.
 * Saturation (CPU/mem/tasks) is from ECS/ContainerInsights (per-cluster ≈
 * per-service) and, for EKS, the ContainerInsights namespace populated by the
 * managed amazon-cloudwatch-observability add-on (pod CPU/mem in the default ns).
 */
export class LatencyByAZDashboard extends Construct {
    constructor(scope: Construct) {
        super(scope, 'LatencyByAZDashboard');

        const region = cdk.Stack.of(this).region;

        const ECS_GROUPS = ['/ecs/PetSearchEc2', '/ecs/PayForAdoption', '/ecs/PetListAdoptions'];
        const EKS_GROUP = '/aws/containerinsights/PetSite/application';
        const ALL_GROUPS = [...ECS_GROUPS, EKS_GROUP];
        const src = (groups: string[]) => groups.map(g => `SOURCE '${g}'`).join(' | ');
        // coalesce ECS top-level fields with EKS log_processed.* so one query spans both.
        const C = {
            svc: 'coalesce(service, log_processed.service)',
            az: 'coalesce(az, log_processed.az)',
            node: 'coalesce(node, log_processed.node)',
            inst: 'coalesce(instance, log_processed.instance)',
            lat: 'coalesce(latency_ms, log_processed.latency_ms)',
            st: 'coalesce(status, log_processed.status)',
            err: 'coalesce(err, log_processed.err)',
        };

        const logWidget = (title: string, query: string,
                           x: number, y: number, w: number, h: number, view = 'timeSeries') => ({
            type: 'log',
            x, y, width: w, height: h,
            properties: { title, region, view, stacked: false, query },
        });

        // ECS Container Insights CPU/mem/task metrics are keyed by the full
        // CDK-generated cluster/service names (random suffix per deploy), so we
        // match them with a SEARCH() expression rather than hardcoding names —
        // one line per ECS service (incl. the load generators). CloudWatch
        // SEARCH dimension filters are exact-match, not prefix, so we match the
        // metric across the namespace and let the per-service labels distinguish.
        const ecsSat = (metric: string, label: string) => ({
            expression: `SEARCH('{ECS/ContainerInsights,ClusterName,ServiceName} MetricName="${metric}"', 'Average', 60)`,
            label,
        });

        let y = 0;
        const widgets: object[] = [];

        // ─────────────────────────────────────────────────────────────────────
        // Header
        // ─────────────────────────────────────────────────────────────────────
        widgets.push({
            type: 'text', x: 0, y, width: 24, height: 3,
            properties: {
                markdown: '# PetAdoptions — Operational Health (golden signals)\n' +
                    'On-call view. **① Health** (top): is a service breaching? **② Blast radius**: is it one AZ / one ' +
                    'host / everywhere? **③ Trend**: spreading or recovering? **④ Downstream**: ALB latency / 5xx. ' +
                    'Request signals come from the per-request structured logs; saturation from Container Insights. ' +
                    'During an FIS experiment, watch the impaired **service → AZ → instance** light up top-down.'
            }
        });
        y += 3;

        // ─────────────────────────────────────────────────────────────────────
        // ① SERVICE HEALTH — the "is it bad, and which service" glance
        // ─────────────────────────────────────────────────────────────────────
        widgets.push({
            type: 'text', x: 0, y, width: 24, height: 1,
            properties: { markdown: '## ① Service health — all services, worst first (p99 latency · error count · throughput)' }
        });
        y += 1;
        widgets.push(logWidget('Service health — reqs / avg / p99 / 5xx by service (sorted slowest first)',
            `${src(ALL_GROUPS)} | fields ${C.svc} as svc, ${C.lat} as lat, ${C.st} as st ` +
            `| filter ispresent(lat) ` +
            `| stats count(*) as reqs, avg(lat) as avg_ms, pct(lat,99) as p99_ms, max(lat) as max_ms, sum(st>=500) as errors_5xx by svc ` +
            `| sort p99_ms desc`,
            0, y, 14, 7, 'table'));
        // Fleet error rate (5xx %) trend — the "is it bad right now" line.
        widgets.push(logWidget('Fleet 5xx error % (all services)',
            `${src(ALL_GROUPS)} | fields ${C.st} as st | filter ispresent(st) ` +
            `| stats (sum(st>=500)*100.0)/count(*) as error_pct by bin(1m)`,
            14, y, 10, 7));
        y += 7;

        // ─────────────────────────────────────────────────────────────────────
        // ② BLAST RADIUS — where: which AZ, which instance/pod
        // ─────────────────────────────────────────────────────────────────────
        widgets.push({
            type: 'text', x: 0, y, width: 24, height: 1,
            properties: { markdown: '## ② Blast radius — *where* is it: which AZ, which instance / pod (who + where, worst first)' }
        });
        y += 1;
        // who+where: ECS instances, ranked by p99
        widgets.push(logWidget('ECS — slowest instance & where (who=instance, where=az; rank by p99)',
            `${src(ECS_GROUPS)} | fields service, az, instance, latency_ms, status ` +
            `| filter ispresent(latency_ms) ` +
            `| stats count(*) as reqs, avg(latency_ms) as avg_ms, pct(latency_ms,99) as p99_ms, sum(status>=500) as errors by service, az, instance ` +
            `| sort p99_ms desc | limit 20`,
            0, y, 12, 7, 'table'));
        // who+where: EKS pods, ranked by p99
        widgets.push(logWidget('EKS — slowest pod/node & where (who=pod, where=node/az; rank by p99)',
            `SOURCE '${EKS_GROUP}' | filter ispresent(log_processed.latency_ms) ` +
            `| fields log_processed.service as service, log_processed.az as az, log_processed.node as node, log_processed.instance as pod, log_processed.latency_ms as latency_ms, log_processed.status as status ` +
            `| stats count(*) as reqs, avg(latency_ms) as avg_ms, pct(latency_ms,99) as p99_ms, sum(status>=500) as errors by service, az, node, pod ` +
            `| sort p99_ms desc | limit 20`,
            12, y, 12, 7, 'table'));
        y += 7;
        // Error blast radius: is it AZ-isolated? (errors by AZ — the AZ-evacuation signal)
        widgets.push(logWidget('5xx errors by AZ (is the failure AZ-isolated?)',
            `${src(ALL_GROUPS)} | fields ${C.az} as zone, ${C.st} as st | filter ispresent(st) ` +
            `| stats sum(st>=500) as errors_5xx by zone, bin(1m)`,
            0, y, 12, 6));
        // Throughput by AZ — confirms traffic is balanced / shifting
        widgets.push(logWidget('Throughput (req/min) by AZ',
            `${src(ALL_GROUPS)} | fields ${C.az} as zone | stats count(*) as reqs by zone, bin(1m)`,
            12, y, 12, 6));
        y += 6;

        // ─────────────────────────────────────────────────────────────────────
        // ③ TREND — per-service latency by AZ (spreading or recovering)
        // ─────────────────────────────────────────────────────────────────────
        widgets.push({
            type: 'text', x: 0, y, width: 24, height: 1,
            properties: { markdown: '## ③ Latency trend by AZ — per service (which AZ diverges while others stay flat)' }
        });
        y += 1;
        // p99 only (p50 added noise) over 5-minute bins (1-minute bins on sparse
        // per-AZ data were too jagged to read "which AZ diverges").
        const latByAz = (label: string, group: string, azField: string) =>
            logWidget(`${label} — p99 latency by AZ (ms, 5m)`,
                `SOURCE '${group}' | fields ${azField} as zone, ${group === EKS_GROUP ? 'log_processed.latency_ms' : 'latency_ms'} as lat ` +
                `| filter ispresent(lat) | stats pct(lat,99) as p99_ms by zone, bin(5m)`,
                0, 0, 12, 6);
        // ECS three + EKS petsite (by node, since pods map to nodes→AZ)
        widgets.push({ ...latByAz('petsearch', '/ecs/PetSearchEc2', 'az'), x: 0, y });
        widgets.push({ ...latByAz('payforadoption', '/ecs/PayForAdoption', 'az'), x: 12, y });
        y += 6;
        widgets.push({ ...latByAz('petlistadoptions', '/ecs/PetListAdoptions', 'az'), x: 0, y });
        widgets.push(logWidget('petsite (EKS) — p99 latency by node (ms, 5m)',
            `SOURCE '${EKS_GROUP}' | filter ispresent(log_processed.latency_ms) and log_processed.service = 'petsite' ` +
            `| stats pct(log_processed.latency_ms,99) as p99_ms by log_processed.node, bin(5m)`,
            12, y, 12, 6));
        y += 6;

        // ─────────────────────────────────────────────────────────────────────
        // ④ DOWNSTREAM & SATURATION
        // ─────────────────────────────────────────────────────────────────────
        widgets.push({
            type: 'text', x: 0, y, width: 24, height: 1,
            properties: { markdown: '## ④ Downstream (ALB target response time & 5xx) & saturation (CPU / memory / tasks)' }
        });
        y += 1;
        // ALB target response time per service ALB (catches downstream/egress
        // latency the app's own request timer misses). One line per service ALB
        // via SEARCH on the "Servic-" LB-name prefix (deploy-agnostic).
        // (X-Ray ResponseTime is intentionally NOT used — this account publishes
        // no AWS/X-Ray CloudWatch metrics, so an X-Ray widget renders empty.)
        widgets.push({
            type: 'metric', x: 0, y, width: 12, height: 6,
            properties: {
                title: 'ALB target response time p99 (s) per service — downstream/egress latency',
                region, view: 'timeSeries', period: 60,
                yAxis: { left: { min: 0, label: 'Seconds' } },
                metrics: [[{ expression: "SEARCH('{AWS/ApplicationELB,LoadBalancer} MetricName=\"TargetResponseTime\"', 'p99', 60)", label: 'p99 by ALB' }]],
            },
        });
        widgets.push({
            type: 'metric', x: 12, y, width: 12, height: 6,
            properties: {
                title: 'ALB 5xx (target) per service — downstream error surface',
                region, view: 'timeSeries', period: 60, stat: 'Sum',
                metrics: [[{ expression: "SEARCH('{AWS/ApplicationELB,LoadBalancer} MetricName=\"HTTPCode_Target_5XX_Count\"', 'Sum', 60)", label: '5xx by ALB' }]],
            },
        });
        y += 6;
        // Saturation — ECS (left half) + EKS (right half). ECS via SEARCH on the
        // ECS/ContainerInsights namespace; EKS pod CPU/mem via the ContainerInsights
        // namespace, populated by the managed amazon-cloudwatch-observability add-on
        // (filtered to the 'default' namespace = the PetAdoptions EKS workloads).
        const eksSat = (metric: string, label: string) => ({
            expression: `SEARCH('{ContainerInsights,ClusterName,Namespace,PodName} MetricName="${metric}" Namespace="default"', 'Average', 60)`,
            label,
        });
        widgets.push({
            type: 'metric', x: 0, y, width: 6, height: 6,
            properties: { title: 'ECS CPU utilized (per service)', region, view: 'timeSeries', period: 60,
                metrics: [[ecsSat('CpuUtilized', 'CPU (vCPU units)')]] },
        });
        widgets.push({
            type: 'metric', x: 6, y, width: 6, height: 6,
            properties: { title: 'ECS memory utilized (per service)', region, view: 'timeSeries', period: 60,
                metrics: [[ecsSat('MemoryUtilized', 'memory (MiB)')]] },
        });
        widgets.push({
            type: 'metric', x: 12, y, width: 6, height: 6,
            properties: { title: 'EKS pod CPU % (default ns)', region, view: 'timeSeries', period: 60,
                metrics: [[eksSat('pod_cpu_utilization', 'pod CPU %')]] },
        });
        widgets.push({
            type: 'metric', x: 18, y, width: 6, height: 6,
            properties: { title: 'EKS pod memory % (default ns)', region, view: 'timeSeries', period: 60,
                metrics: [[eksSat('pod_memory_utilization', 'pod mem %')]] },
        });
        y += 6;
        // ECS running tasks (capacity/restarts) — full width below the CPU/mem row.
        widgets.push({
            type: 'metric', x: 0, y, width: 24, height: 4,
            properties: { title: 'ECS running tasks (per service) — capacity / restarts', region, view: 'timeSeries', period: 60,
                metrics: [[ecsSat('RunningTaskCount', 'running tasks')]] },
        });
        y += 4;

        // ─────────────────────────────────────────────────────────────────────
        // ⑤ RESILIENCE — how the system REACTS to an AZ/instance impairment
        //   (not just impact). All split by AZ so failover & recovery are visible:
        //   - HealthyHostCount/AZ: does the ALB eject the impaired AZ's targets and
        //     does it recover? (drops to 0 in the bad AZ, climbs back after)
        //   - RequestCount/AZ: does traffic shift to the healthy AZ?
        //   - 2XX vs 5XX/AZ: graceful degradation — healthy AZ keeps serving 2XX
        //     while the impaired AZ errors.
        //   These come from ALB per-AZ metrics (X-Ray ResponseTime is NOT published
        //   as a CloudWatch metric in this account, so it can't drive a widget).
        //   SEARCH across the service ALBs (deploy-agnostic); during a petsearch
        //   experiment the petsearch ALB's AZ lines are the ones that move.
        // ─────────────────────────────────────────────────────────────────────
        widgets.push({
            type: 'text', x: 0, y, width: 24, height: 1,
            properties: { markdown: '## ⑤ Resilience — how the app reacts to impairment (failover & recovery, by AZ)' }
        });
        y += 1;
        const albSearch = (metric: string, stat: string, label: string, extraDims = 'AvailabilityZone,LoadBalancer,TargetGroup') => ({
            expression: `SEARCH('{AWS/ApplicationELB,${extraDims}} MetricName="${metric}"', '${stat}', 60)`,
            label,
        });
        widgets.push({
            type: 'metric', x: 0, y, width: 8, height: 6,
            properties: {
                title: 'Healthy hosts by AZ — does the ALB eject & recover the impaired AZ?',
                region, view: 'timeSeries', period: 60, stacked: false,
                yAxis: { left: { min: 0 } },
                metrics: [[albSearch('HealthyHostCount', 'Average', 'healthy hosts')]],
            },
        });
        widgets.push({
            type: 'metric', x: 8, y, width: 8, height: 6,
            properties: {
                title: 'Requests by AZ — does traffic shift to the healthy AZ?',
                region, view: 'timeSeries', period: 60, stacked: false,
                metrics: [[albSearch('RequestCount', 'Sum', 'requests', 'AvailabilityZone,LoadBalancer')]],
            },
        });
        widgets.push({
            type: 'metric', x: 16, y, width: 8, height: 6,
            properties: {
                title: 'Target 5xx by AZ — is failure AZ-isolated (graceful degradation)?',
                region, view: 'timeSeries', period: 60, stacked: false,
                metrics: [[albSearch('HTTPCode_Target_5XX_Count', 'Sum', '5xx', 'AvailabilityZone,LoadBalancer')]],
            },
        });
        y += 6;

        // ─────────────────────────────────────────────────────────────────────
        // ⑥ Contributor Insights — live top-N during an FIS experiment
        // ─────────────────────────────────────────────────────────────────────
        widgets.push(...contributorInsightWidgets(region, y));

        new cloudwatch.CfnDashboard(this, 'Resource', {
            dashboardName: 'PetAdoptions-Latency-by-AZ',
            dashboardBody: JSON.stringify({ widgets }),
        });
    }
}
