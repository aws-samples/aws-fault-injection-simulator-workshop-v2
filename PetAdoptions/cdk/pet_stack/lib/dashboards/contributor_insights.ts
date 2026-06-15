import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

/**
 * "Where is the slowness / errors coming from" surfacing for the PetAdoptions
 * FIS workshop. The latency-by-AZ dashboard shows *that* an impairment is
 * happening; this answers *who* (which instance / pod) and *where* (which AZ /
 * node) during az-app-slowdown, cross-az-traffic-slowdown, instance-kill, or AZ
 * power-interruption experiments.
 *
 * Design (see PETSEARCH_LOGGING_PLAN.md for the full rationale):
 *  - **Logs Insights table widgets are the primary "who+where" answer.** They
 *    are the ONLY option that ranks by p99/avg latency, shows the contributor
 *    identity AND its az/node as columns, sorts worst-first, and renders
 *    reliably from IaC. Contributor Insights cannot rank by average/percentile
 *    (AggregateOn supports only Count and Sum), and INSIGHT_RULE_METRIC graphs
 *    plot an anonymous aggregate (MaxContributorValue has no identity on the
 *    graph). So tables carry the steady-state answer.
 *  - **Contributor Insights rules are kept for the live FIS moment** — a
 *    sub-minute, auto-ranking, alarmable top-N. The rules use MULTI-KEY
 *    contributions ([service, az, instance(, node)]) so each ranked contributor
 *    already encodes its location when viewed in the Logs > Contributor Insights
 *    console report. One INSIGHT_RULE_METRIC "surge" line per group shows the
 *    top contributor's magnitude spiking during an experiment.
 *
 * Two log transports: ECS services (petsearch, payforadoption, petlistadoptions)
 * log top-level to /ecs/*; EKS services (petsite, pethistory, petfood,
 * petfood-metric) share /aws/containerinsights/PetSite/application with fields
 * nested under log_processed.* (so `service` must be a key/column to separate
 * them). Both now resolve a real `az`.
 */

const ECS_LOG_GROUPS = ['/ecs/PetSearchEc2', '/ecs/PayForAdoption', '/ecs/PetListAdoptions'];
const EKS_LOG_GROUP = '/aws/containerinsights/PetSite/application';

// Static rule names, exported so the dashboard surge widgets can reference them
// without a CloudFormation dependency.
export const INSIGHT_RULES = {
    ecsTopLatency: 'PetAdoptions-ECS-TopLatencyByInstance',
    ecsTopErrors: 'PetAdoptions-ECS-TopErrorsByInstance',
    eksTopLatency: 'PetAdoptions-EKS-TopLatencyByPod',
    eksTopErrors: 'PetAdoptions-EKS-TopErrorsByPod',
};

export class ContributorInsights extends Construct {
    constructor(scope: Construct) {
        super(scope, 'ContributorInsights');

        const rule = (
            id: string,
            ruleName: string,
            logGroupNames: string[],
            keys: string[],
            opts: { valueKey?: string; filters?: object[]; aggregateOn: 'Count' | 'Sum' }
        ) => {
            const contribution: Record<string, any> = { Keys: keys };
            if (opts.valueKey) contribution.ValueOf = opts.valueKey;
            if (opts.filters) contribution.Filters = opts.filters;

            return new cloudwatch.CfnInsightRule(this, id, {
                ruleName,
                ruleState: 'ENABLED',
                ruleBody: JSON.stringify({
                    Schema: { Name: 'CloudWatchLogRule', Version: 1 },
                    LogGroupNames: logGroupNames,
                    LogFormat: 'JSON',
                    Contribution: contribution,
                    AggregateOn: opts.aggregateOn,
                }),
            });
        };

        // CloudWatch Contributor Insights has no GreaterThanOrEqualTo operator;
        // GreaterThan:499 matches HTTP status >= 500. Sum (ValueOf) rules require
        // a Filters array, so latency rules filter latency_ms>0.
        const err5xx = (statusKey: string) => [{ Match: statusKey, GreaterThan: 499 }];
        const hasLatency = (latencyKey: string) => [{ Match: latencyKey, GreaterThan: 0 }];

        // Multi-key: each contributor is the {service, az, instance(, node)} tuple,
        // so the ranked console report reads e.g. "petsearch | us-east-1b | ip-10-1-…".
        // ECS group (top-level fields; node is empty on ECS so it's omitted).
        rule('EcsTopLatencyByInstance', INSIGHT_RULES.ecsTopLatency, ECS_LOG_GROUPS,
            ['$.service', '$.az', '$.instance'],
            { valueKey: '$.latency_ms', filters: hasLatency('$.latency_ms'), aggregateOn: 'Sum' });
        rule('EcsTopErrorsByInstance', INSIGHT_RULES.ecsTopErrors, ECS_LOG_GROUPS,
            ['$.service', '$.az', '$.instance'],
            { filters: err5xx('$.status'), aggregateOn: 'Count' });

        // EKS group (nested; shared log group, so `service` is a mandatory key to
        // separate petsite/pethistory/petfood; uses all 4 allowed keys).
        rule('EksTopLatencyByPod', INSIGHT_RULES.eksTopLatency, [EKS_LOG_GROUP],
            ['$.log_processed.service', '$.log_processed.az', '$.log_processed.node', '$.log_processed.instance'],
            { valueKey: '$.log_processed.latency_ms', filters: hasLatency('$.log_processed.latency_ms'), aggregateOn: 'Sum' });
        rule('EksTopErrorsByPod', INSIGHT_RULES.eksTopErrors, [EKS_LOG_GROUP],
            ['$.log_processed.service', '$.log_processed.az', '$.log_processed.node', '$.log_processed.instance'],
            { filters: err5xx('$.log_processed.status'), aggregateOn: 'Count' });
    }
}

/**
 * Live Contributor Insights "surge" widgets for the FIS moment. The steady-state
 * "who+where" answer is the Logs Insights tables in the ops dashboard (section ②);
 * these add the sub-minute, alarmable top-contributor magnitude lines, with a
 * pointer to the console CI report for the ranked identities. `region` is the
 * stack region token; `yStart` is where to begin laying these out.
 */
export function contributorInsightWidgets(region: string, yStart: number): object[] {
    // INSIGHT_RULE_METRIC "surge" line: top contributor's value + how many
    // contributors are serving. Anonymous by design (identity lives in the
    // console CI report linked from the header) — its job is to show the spike.
    const surgeWidget = (title: string, ruleName: string, valueLabel: string, x: number, y: number) => ({
        type: 'metric',
        x, y, width: 12, height: 6,
        properties: {
            view: 'timeSeries', stacked: false, region, period: 60, title,
            metrics: [
                [{ expression: `INSIGHT_RULE_METRIC("${ruleName}", "MaxContributorValue")`, label: valueLabel, id: 'e1' }],
                [{ expression: `INSIGHT_RULE_METRIC("${ruleName}", "UniqueContributors")`, label: 'contributors serving', id: 'e2', yAxis: 'right' }],
            ],
            yAxis: { left: { min: 0 } },
        },
    });

    return [
        {
            type: 'text', x: 0, y: yStart, width: 24, height: 2,
            properties: {
                markdown: '## ⑥ Live top contributor (Contributor Insights — sub-minute, alarmable)\n' +
                    'The lines below show the **top contributor’s magnitude** surging during an FIS experiment ' +
                    '(latency summed/min and error count). They are anonymous by design — for the **live ranked ' +
                    'bar chart with identities** (service · AZ · instance/pod), open **Logs → Contributor Insights** ' +
                    'and select `PetAdoptions-ECS-*` / `PetAdoptions-EKS-*`. The who+where tables in section ② are ' +
                    'the steady-state answer; these are the real-time + alarmable signal.'
            }
        },
        surgeWidget('FIS live — ECS top-contributor latency surge (Σ ms/min) + instances serving',
            INSIGHT_RULES.ecsTopLatency, 'worst instance (Σ latency ms/min)', 0, yStart + 2),
        surgeWidget('FIS live — EKS top-contributor latency surge (Σ ms/min) + pods serving',
            INSIGHT_RULES.eksTopLatency, 'worst pod (Σ latency ms/min)', 12, yStart + 2),
        surgeWidget('FIS live — ECS top error contributor (5xx count/min)',
            INSIGHT_RULES.ecsTopErrors, 'worst instance (5xx/min)', 0, yStart + 8),
        surgeWidget('FIS live — EKS top error contributor (5xx count/min)',
            INSIGHT_RULES.eksTopErrors, 'worst pod (5xx/min)', 12, yStart + 8),
    ];
}
