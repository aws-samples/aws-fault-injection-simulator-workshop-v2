import { Stack, StackProps } from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs'

export class UserSimulationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 }); 
    // Create an ECS cluster within the VPC
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsights: true,
    });
    
    // Define the ECS task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition');

    // Add permissions to query SSM parameter
    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: [
                "ssm:GetParameters",
                "ssm:GetParameter",
                "ssm:DescribeParameters", 
                "ssm:GetParametersByPath",
                "ssm:ListParameters",
            ]
    }));

    // Add a container to the task definition using your Docker image
    const container = taskDefinition.addContainer('Load_Test_Container', {
      image: ecs.ContainerImage.fromAsset('./lib/app'), 
      logging: new ecs.AwsLogDriver({ streamPrefix: 'LoadTesting' }),
    });
    
    // Configure container settings, environment variables, etc.
    container.addPortMappings({ containerPort: 80 });

    // Create an ECS service
    new ecs.FargateService(this, 'Load_Test_Service', {
      cluster,
      taskDefinition,
      desiredCount: 5, 
    });
  }
}