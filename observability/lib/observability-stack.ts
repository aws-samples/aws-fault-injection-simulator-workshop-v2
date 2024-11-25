import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ContainerStatsCollectorConstruct } from '../lib/container-stats-collector-construct';
import { ASGMetricsCollectorConstruct } from './ec2-asg-stats-collector';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const containerStats = new ContainerStatsCollectorConstruct(this, 'ContainerStats');
    const ec2ASGStats = new ASGMetricsCollectorConstruct(this, 'ASGMetricsStats');
    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'ObservabilityQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
 