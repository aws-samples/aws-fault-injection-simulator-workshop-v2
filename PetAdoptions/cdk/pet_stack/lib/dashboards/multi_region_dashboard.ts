import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { SSMParameterReader } from '../common/ssm-parameter-reader';
import { ServiceStackProps } from '../common/services-shared-properties';

export class MultiRegionDashboard {

    private readonly props: ServiceStackProps;

    constructor(stack: cdk.Stack, props: ServiceStackProps) {

        this.props = props;
        
        const multiRegionDashboard = new cloudwatch.Dashboard(stack, 'MultiRegionConnectivityDashboard', {
            dashboardName: 'MultiRegionConnectivity'
        });

        // Get SSM Parameters
        const parameters = this.getSSMParameters(stack);

        // Add all widgets to dashboard
        multiRegionDashboard.addWidgets(
            new cloudwatch.Row(
                new cloudwatch.TextWidget({
                    markdown: `## Multi-Region Connectivity Dashboard
            * Primary Region: ${props.MainRegion}
            * Secondary Region: ${props.SecondaryRegion}`,
                    width: 24,
                    height: 3,
                })),
            new cloudwatch.Column(...this.createCustomerExpDashboardWidgets()),
            new cloudwatch.Column(...this.createNetworkDashboardWidgets(parameters), ...this.createS3DashboardWidgets(parameters)),
            new cloudwatch.Column(...this.createDatabaseDashboardWidgets(parameters))
        );
    }
    
    private getSSMParameters(stack: cdk.Stack) {
        return {
            mainTgwId: ssm.StringParameter.valueForStringParameter(
                stack,
                '/petstore/tgwid'
            ),
            secondaryTgwId: new SSMParameterReader(stack, 'ssmTgwIdReader', {
                parameterName: '/petstore/tgwid',
                region: this.props.SecondaryRegion
            })?.getParameterValue(),
            mainTgwAttachmentId: ssm.StringParameter.valueForStringParameter(
                stack,
                '/petstore/tgwattachmentid'
            ),
            // Same value for the peering attachmentID  in both regions.
            secondaryTgwAttachmentId: ssm.StringParameter.valueForStringParameter(
                stack,
                '/petstore/tgwattachmentid'
            ),
            sourceBucket: ssm.StringParameter.valueForStringParameter(
                stack,
                '/petstore/s3bucketname'
            ),
            destinationBucket: new SSMParameterReader(stack, 'ssmS3BucketNameReader', {
                parameterName: '/petstore/s3bucketname',
                region: this.props.SecondaryRegion
            })?.getParameterValue(),
            dbTableName: ssm.StringParameter.valueForStringParameter(
                stack,
                '/petstore/dynamodbtablename'
            ),
            dbClusterIdentifier: cdk.Fn.select(0, cdk.Fn.split('.', ssm.StringParameter.valueForStringParameter(stack,'/petstore/rdsendpoint'))),
            
            dbInstanceIdentifierWriter: ssm.StringParameter.valueForStringParameter(
                stack,
                '/petstore/rdsinstanceIdentifierWriter'
            ),

            dbInstanceIdentifierReader: ssm.StringParameter.valueForStringParameter(
                stack,
                '/petstore/rdsinstanceIdentifierReader'
            ),
        };
    }

    private createCustomerExpDashboardWidgets(): cloudwatch.IWidget[] {

        return [
            new cloudwatch.TextWidget({
                markdown: '### **Customer experience**',
                height: 1,
                width: 8,
                background: cloudwatch.TextWidgetBackground.TRANSPARENT
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
                        region: this.props.SecondaryRegion,
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
                        region: this.props.SecondaryRegion,
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
                        region: this.props.MainRegion,
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
                        region: this.props.MainRegion,
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
                        region: this.props.SecondaryRegion,
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
                        region: this.props.SecondaryRegion,
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
                        region: this.props.MainRegion,
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
                        region: this.props.MainRegion,
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
                        region: this.props.SecondaryRegion,
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
                        region: this.props.SecondaryRegion,
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
                        region: this.props.MainRegion,
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
                        region: this.props.MainRegion,
                        statistic: 'p90',
                    }),
                ],
                width: 8,
                height: 5,
                period: cdk.Duration.seconds(60)
            })
        ];
    }
    private createNetworkDashboardWidgets(parameters: any): cloudwatch.IWidget[] {

        return [
            new cloudwatch.TextWidget({
                markdown: '### **Network metrics**',
                width: 8,
                height: 1,
                background: cloudwatch.TextWidgetBackground.TRANSPARENT
            }),

            // TGW - 2nd region
            new cloudwatch.GraphWidget({
                title: 'Transit Gateway - Packet Flow',
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
                        region: this.props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        label: 'us-west-2 PacketsOut'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/TransitGateway',
                        metricName: 'PacketsIn',
                        dimensionsMap: {
                            TransitGatewayAttachment: parameters.secondaryTgwAttachmentId,
                            TransitGateway: parameters.secondaryTgwId,
                        },
                        region: this.props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        label: 'us-west-2 PacketsIn'
                    }),
                ],
            }),
            // TGW - 1st Region PacketDropCount
            new cloudwatch.GraphWidget({
                title: 'Transit Gateway - Packet Drop',
                width: 8,
                height: 5,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/TransitGateway',
                        metricName: 'PacketDropCountNoRoute',
                        dimensionsMap: {
                            TransitGateway: parameters.mainTgwId
                        },
                        region: this.props.MainRegion,
                        statistic: 'Sum',
                        color: '#2ca02c',
                        period: cdk.Duration.seconds(60),
                        label: 'us-east-1 PacketDropCount'
                    }),
                ],
            })
        ];
    }
    private createS3DashboardWidgets(parameters: any): cloudwatch.IWidget[] {

        return [
            // S3 Replication Header
            new cloudwatch.TextWidget({
                markdown: '### **S3 Replication**',
                width: 8,
                height: 1,
                background: cloudwatch.TextWidgetBackground.TRANSPARENT
            }),
            // S3 BytesPendingReplication
            new cloudwatch.GraphWidget({
                title: 'S3 - Bytes Pending Replication',
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
                        region: this.props.SecondaryRegion,
                        statistic: 'Average',
                        period: cdk.Duration.seconds(60),
                    }),
                ],
            }),
            // S3 OperationsPendingReplication
            new cloudwatch.GraphWidget({
                title: 'S3 - Operations Pending Replication',
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
                        region: this.props.SecondaryRegion,
                        statistic: 'Average',
                        period: cdk.Duration.seconds(60),
                        color: "#e377c2" 
                    }),
                ],
            }),
            // S3 ReplicationLatency
            new cloudwatch.GraphWidget({
                title: 'S3 - Replication Latency',
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
                        region: this.props.SecondaryRegion,
                        statistic: 'Average',
                        period: cdk.Duration.seconds(60),
                        color: '#2ca02c'
                    }),
                ],
            }),
            // S3 ReplicationLatency
            new cloudwatch.SingleValueWidget({
                title: 'S3 - Failed Replications',
                width: 8,
                height: 4,
                metrics: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/S3',
                        metricName: 'OperationsFailedReplication',
                        dimensionsMap: {
                            SourceBucket: parameters.sourceBucket,
                            DestinationBucket: parameters.destinationBucket,
                            RuleId: 'ReplicationRule',
                        },
                        region: this.props.MainRegion,
                        statistic: 'Sum',
                        period: cdk.Duration.seconds(60),
                        color: '#d62728'
                    }),
                ],
            })
        ];
    }
    private createDatabaseDashboardWidgets(parameters: any): cloudwatch.IWidget[] {

        return [
            // Database Section
            new cloudwatch.TextWidget({
                markdown: '### **RDS Aurora metrics**',
                width: 8,
                height: 1,
                background: cloudwatch.TextWidgetBackground.TRANSPARENT
            }),
            // RDS DatabaseConnections
            new cloudwatch.GraphWidget({
                title: 'RDS - DatabaseConnections',
                width: 8,
                height: 6,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/RDS',
                        metricName: 'DatabaseConnections',
                        dimensionsMap: {
                            DBClusterIdentifier: parameters.dbClusterIdentifier,
                        },
                        region: this.props.MainRegion,
                        statistic: 'tm99',
                        period: cdk.Duration.seconds(60),
                        label: 'us-east-1 DatabaseCluserConnections'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/RDS',
                        metricName: 'DatabaseConnections',
                        dimensionsMap: {
                            dbInstanceIdentifierReader: parameters.dbInstanceIdentifierReader,
                        },
                        region: this.props.MainRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'tm99',
                        label: 'us-east-1 DatabaseWriterConnections'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/RDS',
                        metricName: 'DatabaseConnections',
                        dimensionsMap: {
                            DBInstanceIdentifier: parameters.dbInstanceIdentifierReader,
                        },
                        region: this.props.MainRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'tm99',
                        label: 'us-east-1 DatabaseReaderConnections'
                    }),
                ],
                leftYAxis: { min: 0 },
            }),
            new cloudwatch.TextWidget({
                markdown: '### **DynamoDB metrics**',
                height: 1,
                width: 8,
                background: cloudwatch.TextWidgetBackground.TRANSPARENT
            }),
            new cloudwatch.GraphWidget({
                title: 'DynamoDB - Successful Request Latency (us-west-2)',
                width: 8,
                height: 6,
                view: cloudwatch.GraphWidgetView.TIME_SERIES,
                stacked: false,
                region: 'us-west-2',
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'Scan'
                        },
                        region: this.props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average',
                        label: 'us-west-2 Scan'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'Query'
                        },
                        region: this.props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average',
                        label: 'us-west-2 Query'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'UpdateItem'
                        },
                        region: this.props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average',
                        label: 'us-west-2 UpdateItem'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'PutItem'
                        },
                        region: this.props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average',
                        label: 'us-west-2 PutItem'
                    }),
                ],
            }),
            new cloudwatch.GraphWidget({
                title: 'DynamoDB - Successful Request Latency (us-east-1)',
                width: 8,
                height: 6,
                view: cloudwatch.GraphWidgetView.TIME_SERIES,
                stacked: false,
                region: 'us-east-1',
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'Scan'
                        },
                        region: this.props.MainRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average',
                        label: 'us-east-1 Scan'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'Query'
                        },
                        region: this.props.MainRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average',
                        label: 'us-east-1 Query'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'UpdateItem'
                        },
                        region: this.props.MainRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average',
                        label: 'us-east-1 UpdateItem'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'SuccessfulRequestLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            Operation: 'PutItem'
                        },
                        region: this.props.MainRegion,
                        period: cdk.Duration.seconds(60),
                        statistic: 'Average',
                        label: 'us-east-1 PutItem'
                    }),
                ],
            }),
            new cloudwatch.GraphWidget({
                title: 'DynamoDB - Replication Latency',
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
                            ReceivingRegion: this.props.SecondaryRegion
                        },
                        region: this.props.MainRegion,
                        period: cdk.Duration.seconds(60),
                        label: 'us-east-1 -> us-west-2'
                    }),
                    new cloudwatch.Metric({
                        namespace: 'AWS/DynamoDB',
                        metricName: 'ReplicationLatency',
                        dimensionsMap: {
                            TableName: parameters.dbTableName,
                            ReceivingRegion: this.props.MainRegion
                        },
                        region: this.props.SecondaryRegion,
                        period: cdk.Duration.seconds(60),
                        label: 'us-west-2 -> us-east-1'
                    })
                ]
            })
        ];
    }
}