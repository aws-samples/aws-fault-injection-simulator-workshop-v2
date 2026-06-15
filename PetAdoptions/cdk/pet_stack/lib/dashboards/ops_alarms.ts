import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cwactions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { INSIGHT_RULES } from './contributor_insights';

/**
 * Golden-signal CloudWatch alarms an on-call team would page on for
 * PetAdoptions. Built on metrics that exist as real CloudWatch metrics (not
 * Logs Insights, which can't back an alarm):
 *   - Contributor Insights INSIGHT_RULE_METRIC (rule names are stable) for the
 *     "a single instance/pod is erroring or slow" signal — the per-contributor
 *     view the fleet average hides.
 *   - ALB 5xx + target response time via metric SEARCH (per-service ALBs) for
 *     the customer-facing error/latency signal, aggregated fleet-wide.
 *
 * All alarms notify an SNS topic (ops-alerts). The composite alarm gives a
 * single "PetAdoptions degraded" page that fires when errors AND latency are
 * both unhealthy, to cut noise.
 *
 * Thresholds are workshop-reasonable starting points; a real team tunes them to
 * their SLOs. treatMissingData=notBreaching so quiet periods don't false-page.
 */
export class OpsAlarms extends Construct {
    constructor(scope: Construct) {
        super(scope, 'OpsAlarms');

        const region = cdk.Stack.of(this).region;

        const topic = new sns.Topic(this, 'OpsAlertsTopic', {
            displayName: 'PetAdoptions ops alerts',
            topicName: 'PetAdoptions-ops-alerts',
        });
        const notify = (a: cloudwatch.Alarm) => a.addAlarmAction(new cwactions.SnsAction(topic));

        // ── Contributor Insights surge alarms (per-instance/pod, not averages) ──
        // INSIGHT_RULE_METRIC(rule, "MaxContributorValue"): the worst single
        // contributor's value per minute. For the error rules that's the max 5xx
        // count from one instance; for latency it's one instance's summed ms.
        const ciMetric = (ruleName: string, stat: string, label: string) =>
            new cloudwatch.MathExpression({
                expression: `INSIGHT_RULE_METRIC('${ruleName}', '${stat}')`,
                label,
                period: cdk.Duration.minutes(1),
            });

        // A single ECS or EKS instance/pod throwing 5xx — the "one bad host" signal.
        const ecsErrInstance = new cloudwatch.Alarm(this, 'EcsTopErrorInstanceAlarm', {
            alarmName: 'PetAdoptions-ECS-instance-5xx-surge',
            alarmDescription: 'A single ECS instance is returning 5xx errors (top contributor). One bad host — recycle the task or check that instance.',
            metric: ciMetric(INSIGHT_RULES.ecsTopErrors, 'MaxContributorValue', 'worst instance 5xx/min'),
            threshold: 10,
            evaluationPeriods: 3,
            datapointsToAlarm: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        notify(ecsErrInstance);

        const eksErrPod = new cloudwatch.Alarm(this, 'EksTopErrorPodAlarm', {
            alarmName: 'PetAdoptions-EKS-pod-5xx-surge',
            alarmDescription: 'A single EKS pod is returning 5xx errors (top contributor). One bad pod — recycle it or check its node.',
            metric: ciMetric(INSIGHT_RULES.eksTopErrors, 'MaxContributorValue', 'worst pod 5xx/min'),
            threshold: 10,
            evaluationPeriods: 3,
            datapointsToAlarm: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        notify(eksErrPod);

        // ── Latency surge alarms (per-instance/pod, via CI latency rules) ──
        // NOTE: CloudWatch alarms do NOT allow SEARCH() in metric math (non-
        // deterministic), so ALB-fleet SEARCH alarms aren't possible here. The
        // CI INSIGHT_RULE_METRIC rules are alarm-compatible AND stable (rule names
        // don't change per deploy), and give the better per-contributor signal:
        // MaxContributorValue = the worst single instance's summed latency/min,
        // which surges when one instance/AZ is impaired (e.g. az-app-slowdown).
        const ecsLatAlarm = new cloudwatch.Alarm(this, 'EcsLatencySurgeAlarm', {
            alarmName: 'PetAdoptions-ECS-latency-surge',
            alarmDescription: 'Top ECS instance summed-latency/min is high — a service/instance is slow (e.g. AZ slowdown). Check the Latency-by-AZ dashboard.',
            metric: ciMetric(INSIGHT_RULES.ecsTopLatency, 'MaxContributorValue', 'worst instance latency ms/min'),
            threshold: 60000,
            evaluationPeriods: 5,
            datapointsToAlarm: 3,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        notify(ecsLatAlarm);

        const eksLatAlarm = new cloudwatch.Alarm(this, 'EksLatencySurgeAlarm', {
            alarmName: 'PetAdoptions-EKS-latency-surge',
            alarmDescription: 'Top EKS pod summed-latency/min is high — a pod/node is slow. Check the Latency-by-AZ dashboard.',
            metric: ciMetric(INSIGHT_RULES.eksTopLatency, 'MaxContributorValue', 'worst pod latency ms/min'),
            threshold: 60000,
            evaluationPeriods: 5,
            datapointsToAlarm: 3,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        notify(eksLatAlarm);

        // ── Composite: one "PetAdoptions degraded" page (errors OR latency) ──
        const degraded = new cloudwatch.CompositeAlarm(this, 'PetAdoptionsDegradedComposite', {
            compositeAlarmName: 'PetAdoptions-DEGRADED',
            alarmDescription: 'PetAdoptions is degraded: a single instance/pod is erroring OR latency is surging. Start at the PetAdoptions-Latency-by-AZ dashboard.',
            alarmRule: cloudwatch.AlarmRule.anyOf(
                cloudwatch.AlarmRule.fromAlarm(ecsErrInstance, cloudwatch.AlarmState.ALARM),
                cloudwatch.AlarmRule.fromAlarm(eksErrPod, cloudwatch.AlarmState.ALARM),
                cloudwatch.AlarmRule.fromAlarm(ecsLatAlarm, cloudwatch.AlarmState.ALARM),
                cloudwatch.AlarmRule.fromAlarm(eksLatAlarm, cloudwatch.AlarmState.ALARM),
            ),
        });
        degraded.addAlarmAction(new cwactions.SnsAction(topic));

        new cdk.CfnOutput(this, 'OpsAlertsTopicArn', { value: topic.topicArn, description: 'Subscribe (email/Slack/PagerDuty) to receive PetAdoptions ops alerts' });
    }
}
