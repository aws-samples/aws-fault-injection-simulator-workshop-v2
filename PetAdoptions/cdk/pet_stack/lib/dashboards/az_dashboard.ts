import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Duration } from 'aws-cdk-lib';
import { ServiceStackProps } from '../common/services-shared-properties';

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
    private readonly props: ServiceStackProps;

    constructor(stack: cdk.Stack, props: ServiceStackProps) {

        this.props = props;

        const dashboard = new cloudwatch.Dashboard(stack, 'AZDashboard', {
            dashboardName: 'AZ-Dashboard'
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion,
                    label: `[${az}] ${this.parameters.loadBalancerArn}`
                })
            )
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
                    region: this.props.MainRegion
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
                    region: this.props.MainRegion
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion
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
                    region: this.props.MainRegion
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion,
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
                    region: this.props.MainRegion
                }),
                new cloudwatch.Metric({
                    namespace: 'CustomAZMetrics',
                    metricName: 'HealthyInstancesInAZ',
                    dimensionsMap: {
                        AutoScalingGroupName: this.parameters.ecsAutoScalingGroupName,
                        AvailabilityZone: az
                    },
                    region: this.props.MainRegion
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
                    region: this.props.MainRegion
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'DatabaseConnections',
                    dimensionsMap: {
                        DBInstanceIdentifier: this.parameters.rdsWriterInstanceId
                    },
                    statistic: 'Maximum',
                    period: Duration.seconds(60),
                    region: this.props.MainRegion
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
                    region: this.props.MainRegion
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
                    region: this.props.MainRegion
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
                    region: this.props.MainRegion,
                    period: Duration.seconds(60),
                    statistic: 'Average'
                })
            ),
            view: cloudwatch.GraphWidgetView.TIME_SERIES,
            stacked: false
        });
    }

}


