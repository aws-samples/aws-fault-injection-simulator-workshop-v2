import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ServiceStackProps } from './common/services-shared-properties';
import { SSMParameterReader } from './common/ssm-parameter-reader';
import * as CustomResource from 'aws-cdk-lib/custom-resources';
import { randomInt } from 'crypto';

export class MultiRegionConnectivityDashboard extends cdk.Stack {

    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        const dashboard = new cloudwatch.Dashboard(this, 'MultiRegionConnectivityDashboard', {
            dashboardName: 'MultiRegionConnectivity'
        });

        // Get SSM Parameters
        const parameters = this.getSSMParameters(props);

        // Add all widgets to dashboard
        dashboard.addWidgets(
            new cloudwatch.Column(...this.createCustomerExpDashboardWidgets(props, parameters)),
            new cloudwatch.Column(...this.createNetworkDashboardWidgets(props, parameters), ...this.createS3DashboardWidgets(props, parameters)),
            new cloudwatch.Column(...this.createDatabaseDashboardWidgets(props, parameters)),
            new cloudwatch.Row(
                new cloudwatch.TextWidget({
                    markdown: `## Multi-Region Connectivity Dashboard
            * Primary Region: ${props.MainRegion}
            * Secondary Region: ${props.SecondaryRegion}`,
                    width: 24,
                    height: 3,
                }))
        );
    }

    private getSSMParameters(props: ServiceStackProps) {
        return {
            mainTgwId: ssm.StringParameter.valueForStringParameter(
                this,
                '/petstore/tgwid'
            ),
            secondaryTgwId: new SSMParameterReader(this, 'ssmTgwIdReader', {
                parameterName: '/petstore/tgwid',
                region: props.SecondaryRegion
            })?.getParameterValue(),
            mainTgwAttachmentId: ssm.StringParameter.valueForStringParameter(
                this,
                '/petstore/tgwattachmentid'
            ),
            // TODO: add SSM Parameter '/petstore/tgwattachmentid' in NetworkSecondary Stack
            secondaryTgwAttachmentId: new SSMParameterReader(this, 'ssmTgwIdSecondReader', {
                parameterName: '/petstore/tgwattachmentid',
                region: props.SecondaryRegion
            })?.getParameterValue(),
            sourceBucket: ssm.StringParameter.valueForStringParameter(
                this,
                '/petstore/s3bucketname'
            ),
            destinationBucket: new SSMParameterReader(this, 'ssmS3BucketNameReader', {
                parameterName: '/petstore/s3bucketname',
                region: props.SecondaryRegion
            })?.getParameterValue(),
            dbTableName: ssm.StringParameter.valueForStringParameter(
                this,
                '/petstore/dynamodbtablename'
            ),
            dbClusterIdentifier: cdk.Fn.select(0, cdk.Fn.split('.', ssm.StringParameter.valueForStringParameter(this,'/petstore/rdsendpoint'))),
            // TODO: Add SSM Parameter '/petstore/dbInstanceidentifier' to Services Stack
            dbInstanceIdentifier: ssm.StringParameter.valueForStringParameter(
                this,
                '/petstore/dbInstanceidentifier'
            ),
        };
    }

    private createCustomerExpDashboardWidgets(props: ServiceStackProps, parameters: any): cloudwatch.IWidget[] {

        return [
            new cloudwatch.TextWidget({
                markdown: '### Customer experience',
                height: 1,
                width: 8
            }),

            new cloudwatch.GraphWidget({
                title: 'Latency - PetSite Service',
                width: 8,
                height: 5,
                period: cdk.Duration.seconds(60),
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        color: '#1f77b4',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'PetSite',
                            ServiceType: 'AWS::EC2::Instance'
                        },
                        region: props.SecondaryRegion,
                        statistic: 'p50',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        color: '#e377c2',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'PetSite',
                            ServiceType: 'AWS::EC2::Instance'
                        },
                        region: props.SecondaryRegion,
                        statistic: 'p90',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        color: '#17becf',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'PetSite',
                            ServiceType: 'AWS::EC2::Instance',
                        },
                        region: props.MainRegion,
                        statistic: 'p50',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        color: '#bcbd22',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'PetSite',
                            ServiceType: 'AWS::EC2::Instance',
                        },
                        region: props.MainRegion,
                        statistic: 'p90',
                    })
                ],
                leftYAxis: { min: 0 },
            }),

            new cloudwatch.GraphWidget({
                title: 'Latency - PetSearch Service',
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'PetSearch',
                            ServiceType: 'AWS::ECS::EC2',
                        },
                        region: props.SecondaryRegion,
                        statistic: 'p50',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'PetSearch',
                            ServiceType: 'AWS::ECS::EC2',
                        },
                        region: props.SecondaryRegion,
                        statistic: 'p90',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'PetSearch',
                            ServiceType: 'AWS::ECS::EC2',
                        },
                        region: props.MainRegion,
                        statistic: 'p50',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'PetSearch',
                            ServiceType: 'AWS::ECS::EC2',
                        },
                        region: props.MainRegion,
                        statistic: 'p90',
                    }),
                ],
                width: 8,
                height: 5,
                period: cdk.Duration.seconds(60)
            }),
            new cloudwatch.GraphWidget({
                title: 'Latency - PetAdoption Service',
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'petlistadoptions',
                            ServiceType: 'AWS::ECS::Fargate',
                        },
                        region: props.SecondaryRegion,
                        statistic: 'p50',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'petlistadoptions',
                            ServiceType: 'AWS::ECS::Fargate',
                        },
                        region: props.SecondaryRegion,
                        statistic: 'p90',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'petlistadoptions',
                            ServiceType: 'AWS::ECS::Fargate',
                        },
                        region: props.MainRegion,
                        statistic: 'p50',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/X-Ray',
                        metricName: 'ResponseTime',
                        dimensionsMap: {
                            GroupName: 'Default',
                            ServiceName: 'petlistadoptions',
                            ServiceType: 'AWS::ECS::Fargate',
                        },
                        region: props.MainRegion,
                        statistic: 'p90',
                    }),
                ],
                width: 8,
                height: 5,
                period: cdk.Duration.seconds(60)
            })
        ];
    }
    private createNetworkDashboardWidgets(props: ServiceStackProps, parameters: any): cloudwatch.IWidget[] {

        return [
            new cloudwatch.TextWidget({
                markdown: '### Network',
                width: 8,
                height: 1,
            }),

            // TGW - 2nd region
            new cloudwatch.GraphWidget({
                title: 'TGW - 2nd region',
                width: 8,
                height: 5,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/TransitGateway',
                        metricName: 'PacketsOut',
                        dimensionsMap: {
                            TransitGatewayAttachment: parameters.secondaryTgwAttachmentId,
                            TransitGateway: parameters.secondaryTgwId,
                        },
                        region: props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/TransitGateway',
                        metricName: 'PacketsIn',
                        dimensionsMap: {
                            TransitGatewayAttachment: parameters.secondaryTgwAttachmentId,
                            TransitGateway: parameters.secondaryTgwId,
                        },
                        region: props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                    }),
                ],
            }),
            // TGW - 1st Region PacketDropCount
            new cloudwatch.GraphWidget({
                title: 'TGW - 1st Region - PacketDropCount',
                width: 8,
                height: 5,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/TransitGateway',
                        metricName: 'PacketDropCountNoRoute',
                        dimensionsMap: {
                            TransitGateway: parameters.mainTgwId
                        },
                        region: props.MainRegion,
                        statistic: 'Sum',
                        color: '#9467bd',
                        period: cdk.Duration.seconds(60),
                    }),
                ],
            })
        ];
    }
    private createS3DashboardWidgets(props: ServiceStackProps, parameters: any): cloudwatch.IWidget[] {

        return [
            // S3 Replication Header
            new cloudwatch.TextWidget({
                markdown: '### S3 Replication',
                width: 8,
                height: 1,
            }),
            // S3 BytesPendingReplication
            new cloudwatch.GraphWidget({
                title: 'S3 Bytes Pending Replication',
                width: 8,
                height: 4,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/S3',
                        metricName: 'BytesPendingReplication',
                        dimensionsMap: {
                            SourceBucket: parameters.sourceBucket,
                            DestinationBucket: parameters.destinationBucket,
                            RuleId: 'ReplicationRule',
                        },
                        region: props.SecondaryRegion,
                        statistic: 'Average',
                        period: cdk.Duration.seconds(60),
                    }),
                ],
            }),
            // S3 OperationsPendingReplication
            new cloudwatch.GraphWidget({
                title: 'Operations Pending Replication',
                width: 8,
                height: 4,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/S3',
                        metricName: 'OperationsPendingReplication',
                        dimensionsMap: {
                            SourceBucket: parameters.sourceBucket,
                            DestinationBucket: parameters.destinationBucket,
                            RuleId: 'ReplicationRule',
                        },
                        region: props.SecondaryRegion,
                        statistic: 'Average',
                        period: cdk.Duration.seconds(60),
                    }),
                ],
            }),
            // S3 ReplicationLatency
            new cloudwatch.GraphWidget({
                title: 'S3 Replication Latency',
                width: 8,
                height: 4,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/S3',
                        metricName: 'ReplicationLatency',
                        dimensionsMap: {
                            SourceBucket: parameters.sourceBucket,
                            DestinationBucket: parameters.destinationBucket,
                            RuleId: 'ReplicationRule',
                        },
                        region: props.SecondaryRegion,
                        statistic: 'Average',
                        period: cdk.Duration.seconds(60),
                    }),
                ],
            })
        ];
    }
    private createDatabaseDashboardWidgets(props: ServiceStackProps, parameters: any): cloudwatch.IWidget[] {

        return [
            // Database Section
            new cloudwatch.TextWidget({
                markdown: '### Database',
                width: 8,
                height: 1,
            }),
            // RDS DatabaseConnections
            new cloudwatch.GraphWidget({
                title: 'RDS-DatabaseConnections',
                width: 8,
                height: 6,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/RDS',
                        metricName: 'DatabaseConnections',
                        dimensionsMap: {
                            DBClusterIdentifier: parameters.dbClusterIdentifier,
                        },
                        region: props.MainRegion,
                        statistic: 'tm99',
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/RDS',
                        metricName: 'DatabaseConnections',
                        dimensionsMap: {
                            DBInstanceIdentifier: parameters.dbInstanceIdentifier,
                        },
                        region: props.MainRegion,
                        statistic: 'tm99',
                    }),
                ],
                leftYAxis: { min: 0 },
            }),
            new cloudwatch.GraphWidget({
                title: 'SuccessfulRequestLatency',
                width: 8,
                height: 6,
                view: cloudwatch.GraphWidgetView.TIME_SERIES,
                stacked: false,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'Scan'
                        },
                        region: props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'Query'
                        },
                        region: props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'UpdateItem'
                        },
                        region: props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'PutItem'
                        },
                        region: props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average'
                    }),
                ],
            }),
            new cloudwatch.GraphWidget({
                title: 'ReplicationLatency',
                width: 8,
                height: 6,
                view: cloudwatch.GraphWidgetView.TIME_SERIES,
                stacked: false,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'ReplicationLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            ReceivingRegion: props.SecondaryRegion
                        },
                        region: props.MainRegion
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'ReplicationLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            ReceivingRegion: props.SecondaryRegion
                        },
                        region: props.SecondaryRegion
                    })
                ]
            })
        ];
    }

}

