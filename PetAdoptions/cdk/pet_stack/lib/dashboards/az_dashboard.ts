import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Duration } from 'aws-cdk-lib';

export interface AZDashboardProps extends cdk.StackProps {
    dashboardName?: string;
}

interface AZDashboardParameters {
    loadBalancerArn: string;
    targetGroupArn: string;
    ecsAutoScalingGroupName: string;
    eksAutoScalingGroupName: string;
    rdsReaderInstanceId: string;
    rdsWriterInstanceId: string;
    rdsClusterIdentifier: string;
    availabilityZones: string[];
}

export class AZDashboard {
    private readonly parameters: AZDashboardParameters;
    private readonly region: string;

    constructor(stack: cdk.Stack) {

        this.region = stack.region;

        const dashboard = new cloudwatch.Dashboard(stack, 'AvailabilityZonePowerImpairment', {
            dashboardName: 'AvailabilityZonePowerImpairment'
        });

        this.parameters = this.getSSMParameters(stack);

        dashboard.addWidgets(
            new cloudwatch.Row(
                this.createALBConnectionsWidget(),
                this.createALBProcessedBytesWidget(),
                this.createALB5XXWidget(),
                this.createALBUnhealthyHostsWidget(),
            ),
            new cloudwatch.Row(
                this.createALBTargetResponseTimeByAZWidget(),
            ),
            new cloudwatch.Row(
                this.createPetSearchLatencyWidget(),
                this.createPetSiteLatencyWidget(),
                this.createPetAdoptionLatencyWidget(),
            ),
            new cloudwatch.Row(
                this.createASGHealthyInstancesWidget(this.parameters.availabilityZones[0]),
                this.createASGHealthyInstancesWidget(this.parameters.availabilityZones[1]),
                this.createASGHealthyInstancesTimelineWidget(),
                this.createASGHealthyInstancesPieWidget(),
            ),
            new cloudwatch.Row(
                this.createRDSWriterInstancesWidget(),
                this.createRDSReaderInstancesWidget(),
                this.createRDSWriterWidget(),
                this.createRDSConnectionsWidget()
            ),
            // Cross-AZ Traffic Disruption section. The cross-az-traffic-slowdown
            // FIS scenario uses aws:network:disrupt-connectivity scoped to one AZ,
            // which severs TCP connectivity between that AZ and the others. The ALB
            // 5XX count is NOT AZ-separable here (it is dominated by load-generator
            // noise), so participants cannot see the disruption from it. The signals
            // below ARE AZ-distinguishable: TargetConnectionErrorCount rises in the
            // affected AZ as the ALB fails to open TCP connections to cross-AZ
            // targets, and Aurora replica lag climbs as cross-AZ replication stalls.
            new cloudwatch.Row(
                this.createCrossAZHeaderWidget(),
            ),
            new cloudwatch.Row(
                this.createALBTargetConnectionErrorsByAZWidget(),
                this.createRDSReplicaLagWidget(),
            )
        );

    }
    private getSSMParameters(stack: cdk.Stack): AZDashboardParameters {
        const azs = cdk.Stack.of(stack).availabilityZones;
        // Get the eks ASG name from the ARN of the ClusterNodeGroup, therefore we need to make small adjustments
        const asgNameArn = ssm.StringParameter.valueForStringParameter(stack, '/eks/petsite/AsgNameArn');
        const eksNodeGroupName = cdk.Fn.join('-', [
            'eks',
            cdk.Fn.join('-', [
                cdk.Fn.select(2, cdk.Fn.split('/', asgNameArn)),
                cdk.Fn.select(3, cdk.Fn.split('/', asgNameArn))
            ])
        ]);        

        return {
            loadBalancerArn: ssm.StringParameter.valueForStringParameter(stack, '/eks/petsite/AlbArn'),
            targetGroupArn: ssm.StringParameter.valueForStringParameter(stack, '/eks/petsite/TargetGroupArn'),
            ecsAutoScalingGroupName: ssm.StringParameter.valueForStringParameter(stack, '/petstore/ecsasgname'),
            eksAutoScalingGroupName: eksNodeGroupName,
            rdsReaderInstanceId: ssm.StringParameter.valueForStringParameter(stack, '/petstore/rdsinstanceIdentifierReader'),
            rdsWriterInstanceId: ssm.StringParameter.valueForStringParameter(stack, '/petstore/rdsinstanceIdentifierWriter'),
            rdsClusterIdentifier: cdk.Fn.select(0, cdk.Fn.split('.', ssm.StringParameter.valueForStringParameter(stack, '/petstore/rdsendpoint'))),
            availabilityZones: azs.length > 2 ? azs.slice(0, 2) : azs
        }
    }

    private createALBConnectionsWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'ALB Active Connections',
            width: 6,
            height: 5,
            left: this.parameters.availabilityZones.map(az =>
                new cloudwatch.Metric({
                    namespace: 'AWS/ApplicationELB',
                    metricName: 'ActiveConnectionCount',
                    dimensionsMap: {
                        AvailabilityZone: az,
                        LoadBalancer: this.parameters.loadBalancerArn
                    },
                    statistic: 'Sum',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: `[${az}] ${this.parameters.loadBalancerArn}`
                })
            )
        });
    }

    private createALBProcessedBytesWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'ALB ProcessedBytes',
            width: 6,
            height: 5,
            left: this.parameters.availabilityZones.map(az =>
                new cloudwatch.Metric({
                    namespace: 'AWS/ApplicationELB',
                    metricName: 'ProcessedBytes',
                    dimensionsMap: {
                        AvailabilityZone: az,
                        LoadBalancer: this.parameters.loadBalancerArn
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: `[${az}] ${this.parameters.loadBalancerArn}`
                })
            )
        });
    }

    private createALB5XXWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'ALB HTTP 5XX codes',
            width: 6,
            height: 5,
            left: this.parameters.availabilityZones.map(az =>
                new cloudwatch.Metric({
                    namespace: 'AWS/ApplicationELB',
                    metricName: 'HTTPCode_Target_5XX_Count',
                    dimensionsMap: {
                        AvailabilityZone: az,
                        LoadBalancer: this.parameters.loadBalancerArn
                    },
                    statistic: 'Maximum',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: `[${az}] ${this.parameters.loadBalancerArn}`
                })
            )
        });
    }

    private createALBUnhealthyHostsWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'ALB UnHealthyHostCount',
            width: 6,
            height: 5,
            left: this.parameters.availabilityZones.map(az =>
                new cloudwatch.Metric({
                    namespace: 'AWS/ApplicationELB',
                    metricName: 'UnHealthyHostCount',
                    dimensionsMap: {
                        AvailabilityZone: az,
                        LoadBalancer: this.parameters.loadBalancerArn,
                        TargetGroup: this.parameters.targetGroupArn
                    },
                    statistic: 'Maximum',
                    period: Duration.seconds(300),
                    region: this.region,
                    label: `[${az}] ${this.parameters.loadBalancerArn}`
                })
            )
        });
    }

    // ALB TargetResponseTime split by Availability Zone. This is the clearest
    // signal for an AZ-scoped slowdown (e.g. the az-app-slowdown FIS scenario):
    // the ALB measures, per AZ, how long its targets take to respond — including
    // the time their downstream calls (S3/DynamoDB/RDS) take. When egress latency
    // is injected into one AZ, that AZ's line rises while the others stay flat,
    // with no application instrumentation required. The lab guide tells
    // participants to watch "ALB Target Response Time increasing for targets in
    // the affected AZ" — this is that widget.
    private createALBTargetResponseTimeByAZWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'ALB Target Response Time by AZ (watch one AZ diverge during an AZ slowdown)',
            width: 24,
            height: 6,
            left: this.parameters.availabilityZones.flatMap(az => [
                new cloudwatch.Metric({
                    namespace: 'AWS/ApplicationELB',
                    metricName: 'TargetResponseTime',
                    dimensionsMap: {
                        AvailabilityZone: az,
                        LoadBalancer: this.parameters.loadBalancerArn
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: `[${az}] avg`
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/ApplicationELB',
                    metricName: 'TargetResponseTime',
                    dimensionsMap: {
                        AvailabilityZone: az,
                        LoadBalancer: this.parameters.loadBalancerArn
                    },
                    statistic: 'p90',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: `[${az}] p90`
                })
            ]),
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            period: Duration.seconds(60),
            stacked: false,
            leftYAxis: { min: 0, label: 'Seconds' }
        });
    }

    // Header for the Cross-AZ Traffic Disruption section. The cross-az-traffic-slowdown
    // scenario opens this same dashboard, so the section is labelled explicitly to tell
    // participants which widgets correspond to the inter-AZ connectivity fault (as opposed
    // to the AZ power-impairment / slowdown widgets above).
    private createCrossAZHeaderWidget(): cloudwatch.TextWidget {
        return new cloudwatch.TextWidget({
            width: 24,
            height: 2,
            markdown: '# Cross-AZ Traffic Disruption\n' +
                'For the **cross-az-traffic-slowdown** scenario (inter-AZ connectivity severed in one AZ). ' +
                'Watch **Target Connection Errors** spike in the affected AZ as the ALB cannot open TCP ' +
                'connections to cross-AZ targets, and **Aurora Replica Lag** climb as cross-AZ replication ' +
                'stalls. (The ALB 5XX widget above is dominated by load-generator noise and is *not* AZ-separable here.)'
        });
    }

    // ALB TargetConnectionErrorCount split by Availability Zone. This is the clearest
    // signal for the cross-az-traffic-slowdown scenario: when inter-AZ connectivity is
    // disrupted, the ALB nodes in the affected AZ fail to establish TCP connections to
    // their cross-AZ targets, so this count rises sharply for that AZ while the others
    // stay flat — unlike HTTPCode_Target_5XX_Count, which is not AZ-distinguishable here.
    private createALBTargetConnectionErrorsByAZWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'ALB Target Connection Errors by AZ (watch the affected AZ spike during cross-AZ disruption)',
            width: 12,
            height: 6,
            left: this.parameters.availabilityZones.map(az =>
                new cloudwatch.Metric({
                    namespace: 'AWS/ApplicationELB',
                    metricName: 'TargetConnectionErrorCount',
                    dimensionsMap: {
                        AvailabilityZone: az,
                        LoadBalancer: this.parameters.loadBalancerArn
                    },
                    statistic: 'Sum',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: `[${az}] connection errors`
                })
            ),
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            period: Duration.seconds(60),
            stacked: false,
            leftYAxis: { min: 0, label: 'Count' }
        });
    }

    // Aurora replica lag on the reader instance. When cross-AZ traffic is disrupted and
    // the reader sits in a different AZ from the writer, replication stalls and this lag
    // climbs; it recovers once connectivity is restored. The cluster is Aurora, so the
    // metric is AuroraReplicaLag (the plain AWS/RDS ReplicaLag metric is not emitted here).
    private createRDSReplicaLagWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'RDS Aurora Replica Lag - Reader (climbs when cross-AZ replication stalls)',
            width: 12,
            height: 6,
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'AuroraReplicaLag',
                    dimensionsMap: {
                        DBInstanceIdentifier: this.parameters.rdsReaderInstanceId
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: 'reader avg'
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'AuroraReplicaLag',
                    dimensionsMap: {
                        DBInstanceIdentifier: this.parameters.rdsReaderInstanceId
                    },
                    statistic: 'Maximum',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: 'reader max'
                })
            ],
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            period: Duration.seconds(60),
            stacked: false,
            leftYAxis: { min: 0, label: 'Milliseconds' }
        });
    }

    private createPetSearchLatencyWidget() {
        return new cloudwatch.GraphWidget({
            title: 'Latency - PetSearch Service',
            width: 8,
            height: 6,
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/X-Ray',
                    metricName: 'ResponseTime',
                    dimensionsMap: {
                        GroupName: 'Default',
                        ServiceName: 'PetSearch',
                        ServiceType: 'AWS::ECS::EC2'
                    },
                    statistic: 'p50',
                    region: this.region
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/X-Ray',
                    metricName: 'ResponseTime',
                    dimensionsMap: {
                        GroupName: 'Default',
                        ServiceName: 'PetSearch',
                        ServiceType: 'AWS::ECS::EC2'
                    },
                    statistic: 'p90',
                    region: this.region
                }),
            ],
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            period: cdk.Duration.seconds(60),
            stacked: false
        });
    }

    private createPetSiteLatencyWidget() {
        return new cloudwatch.GraphWidget({
            title: 'Latency - PetSite Service',
            width: 8,
            height: 6,
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/X-Ray',
                    metricName: 'ResponseTime',
                    dimensionsMap: {
                        GroupName: 'Default',
                        ServiceName: 'PetSite',
                        ServiceType: 'AWS::EC2::Instance'
                    },
                    statistic: 'p50',
                    region: this.region,
                    color: '#17becf'
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/X-Ray',
                    metricName: 'ResponseTime',
                    dimensionsMap: {
                        GroupName: 'Default',
                        ServiceName: 'PetSite',
                        ServiceType: 'AWS::EC2::Instance'
                    },
                    statistic: 'p90',
                    region: this.region,
                    color: '#bcbd22'
                }),
            ],
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            period: cdk.Duration.seconds(60),
            stacked: false
        });
    }

    private createPetAdoptionLatencyWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'Latency - PetAdoption Service',
            width: 8,
            height: 6,
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/X-Ray',
                    metricName: 'ResponseTime',
                    dimensionsMap: {
                        GroupName: 'Default',
                        ServiceName: 'petlistadoptions',
                        ServiceType: 'AWS::ECS::Fargate'
                    },
                    statistic: 'p50',
                    region: this.region
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/X-Ray',
                    metricName: 'ResponseTime',
                    dimensionsMap: {
                        GroupName: 'Default',
                        ServiceName: 'petlistadoptions',
                        ServiceType: 'AWS::ECS::Fargate'
                    },
                    statistic: 'p90',
                    region: this.region
                })
            ],
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            period: Duration.seconds(60),
            stacked: false
        });
    }


    private createASGHealthyInstancesWidget(az: string): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: `ASG Healthy Instances - ${az}`,
            width: 6,
            height: 6,
            view: cloudwatch.GraphWidgetView.BAR,
            left: [
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'HealthyInstancesInAZ',
                    dimensionsMap: {
                        AutoScalingGroupName: this.parameters.ecsAutoScalingGroupName,
                        AvailabilityZone: az
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: 'ecsEc2PetSearchASG'
                }),
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'HealthyInstancesInAZ',
                    dimensionsMap: {
                        AutoScalingGroupName: this.parameters.eksAutoScalingGroupName,
                        AvailabilityZone: az
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: 'eksPetsiteASG'
                })
            ]
        });
    }

    private createASGHealthyInstancesTimelineWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'ASG Healthy Instances',
            width: 6,
            height: 6,
            left: this.parameters.availabilityZones.flatMap(az => [
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'HealthyInstancesInAZ',
                    dimensionsMap: {
                        AutoScalingGroupName: this.parameters.eksAutoScalingGroupName,
                        AvailabilityZone: az
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: `eksPetsiteASG-${az}`
                }),
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'HealthyInstancesInAZ',
                    dimensionsMap: {
                        AutoScalingGroupName: this.parameters.ecsAutoScalingGroupName,
                        AvailabilityZone: az
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region,
                    label: `ecsEc2PetSearchASG-${az}`
                }),
            ]),
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            period: Duration.seconds(60),
            statistic: 'Average',
            setPeriodToTimeRange: true,
            stacked: false
        });
    }

    private createASGHealthyInstancesPieWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'ASG Healthy Instances',
            width: 6,
            height: 6,
            left: this.parameters.availabilityZones.flatMap(az => [
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'HealthyInstancesInAZ',
                    dimensionsMap: {
                        AutoScalingGroupName: this.parameters.eksAutoScalingGroupName,
                        AvailabilityZone: az
                    },
                    region: this.region
                }),
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'HealthyInstancesInAZ',
                    dimensionsMap: {
                        AutoScalingGroupName: this.parameters.ecsAutoScalingGroupName,
                        AvailabilityZone: az
                    },
                    region: this.region
                })
            ]),
            view: cloudwatch.GraphWidgetView.PIE,
            period: Duration.seconds(60),
            statistic: 'Average',
            setPeriodToTimeRange: true,
            stacked: false,
            leftYAxis: {
                min: 0,
                max: 3
            }
        });
    }

    private createRDSConnectionsWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'RDS Database Connections',
            width: 6,
            height: 6,
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'DatabaseConnections',
                    dimensionsMap: {
                        DBInstanceIdentifier: this.parameters.rdsReaderInstanceId
                    },
                    statistic: 'Maximum',
                    period: Duration.seconds(60),
                    region: this.region
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'DatabaseConnections',
                    dimensionsMap: {
                        DBInstanceIdentifier: this.parameters.rdsWriterInstanceId
                    },
                    statistic: 'Maximum',
                    period: Duration.seconds(60),
                    region: this.region
                })
            ]
        });
    }

    private createRDSWriterInstancesWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'RDS - Writer',
            width: 6,
            height: 6,
            view: cloudwatch.GraphWidgetView.BAR,
            left: this.parameters.availabilityZones.map(az =>
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'WriterInstancesInAZ',
                    dimensionsMap: {
                        DBClusterIdentifier: this.parameters.rdsClusterIdentifier,
                        AvailabilityZone: az
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region
                })
            )
        });
    }

    private createRDSReaderInstancesWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'RDS - Reader',
            width: 6,
            height: 6,
            view: cloudwatch.GraphWidgetView.BAR,
            left: this.parameters.availabilityZones.map(az =>
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'ReaderInstancesInAZ',
                    dimensionsMap: {
                        DBClusterIdentifier: this.parameters.rdsClusterIdentifier,
                        AvailabilityZone: az
                    },
                    statistic: 'Average',
                    period: Duration.seconds(60),
                    region: this.region
                })
            )
        });
    }

    private createRDSWriterWidget(): cloudwatch.GraphWidget {
        return new cloudwatch.GraphWidget({
            title: 'RDS - Writer',
            width: 6,
            height: 6,
            left: this.parameters.availabilityZones.map(az =>
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'WriterInstancesInAZ',
                    dimensionsMap: {
                        DBClusterIdentifier: this.parameters.rdsClusterIdentifier,
                        AvailabilityZone: az
                    },
                    region: this.region,
                    period: Duration.seconds(60),
                    statistic: 'Average'
                })
            ),
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            stacked: false
        });
    }

}


