import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export class ASGMetricsCollectorConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create IAM role for the Lambda function
    const lambdaRole = new iam.Role(this, 'ASGMetricsCollectorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for ASG Metrics Collector Lambda',
    });

    // Add required IAM permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // Auto Scaling permissions
        'autoscaling:DescribeAutoScalingGroups',
        // EC2 permissions
        'ec2:DescribeInstances',
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
    this.function = new lambda.Function(this, 'ASGMetricsCollector', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/asg_metrics')),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'Collects instance distribution metrics for Auto Scaling groups',
      environment: {
        PYTHONPATH: '/var/runtime'
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE
    });

    // Create EventBridge rule to trigger the function every minute
    const rule = new events.Rule(this, 'ASGMetricsSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      description: 'Triggers ASG metrics collection every minute',
    });

    rule.addTarget(new targets.LambdaFunction(this.function, {
      retryAttempts: 2,
    }));
  }
}
