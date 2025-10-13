import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';
import { Construct } from 'constructs';

export class ContainerStatsCollectorConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create IAM role for the Lambda function
    const lambdaRole = new iam.Role(this, 'ContainerStatsRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Container Stats Collector Lambda',
    });

    // Add required IAM permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // ECS permissions
        'ecs:ListClusters',
        'ecs:ListTasks',
        'ecs:DescribeTasks',
        // EKS permissions
        'eks:ListClusters',
        'eks:DescribeCluster',
        'eks:ListNodegroups',
        'eks:DescribeNodegroup',
        // EC2 permissions (for EKS node information)
        'ec2:DescribeInstances',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DescribeVpcs',

      ],
      resources: ['*'],
    }));

    // Add CloudWatch permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
      ],
      resources: ['*'],
    }));

    // Add CloudWatch Logs permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['arn:aws:logs:*:*:*'],
    }));

    // Create Lambda function
    this.function = new lambda.Function(this, 'ContainerStatsCollector', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/container_stats')),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      description: 'Collects container distribution stats across ECS and EKS clusters',
      environment: {
        PYTHONPATH: '/var/runtime'
      }
    });

    // Create EventBridge rule to trigger the function every 60 seconds
    const rule = new events.Rule(this, 'ContainerStatsSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.seconds(60)),
      description: 'Triggers container stats collection every 60 seconds',
    });

    rule.addTarget(new targets.LambdaFunction(this.function, {
      retryAttempts: 2, // Number of retries if the function fails
    }));
  }
}
