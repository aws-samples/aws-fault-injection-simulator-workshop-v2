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

    const stack = Stack.of(this);
    const region = stack.region;

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });

    // Create an ECS cluster within the VPC
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsights: true,
    });


    if (region as string == 'us-west-2') {
      // catAdopt
      // Define the ECS task definition
      const catAdoptTaskDefinition = new ecs.FargateTaskDefinition(this, 'catAdoptTaskDefinition');

      // Add permissions to query SSM parameter
      catAdoptTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
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
      const catAdoptContainer = catAdoptTaskDefinition.addContainer('catAdoptContainer', {
        image: ecs.ContainerImage.fromAsset('./resources/user_simulation/catadopt'),
        logging: new ecs.AwsLogDriver({ streamPrefix: 'catadopt' }),
      });

      // Configure container settings, environment variables, etc.
      catAdoptContainer.addPortMappings({ containerPort: 80 });

      // Create catAdoptService
      new ecs.FargateService(this, 'catAdoptService', {
        cluster,
        taskDefinition: catAdoptTaskDefinition,
        desiredCount: 1,
      });
    }



    if (region as string == 'us-east-1') {
      // DogAdopt
      // Define the ECS task definition
      const dogAdoptTaskDefinition = new ecs.FargateTaskDefinition(this, 'dogAdoptTaskDefinition');

      // Add permissions to query SSM parameter
      dogAdoptTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
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
      const dogAdoptContainer = dogAdoptTaskDefinition.addContainer('dogAdoptContainer', {
        image: ecs.ContainerImage.fromAsset('./resources/user_simulation/dogadopt'),
        logging: new ecs.AwsLogDriver({ streamPrefix: 'dogadopt' }),
      });

      // Configure container settings, environment variables, etc.
      dogAdoptContainer.addPortMappings({ containerPort: 80 });

      // Create dogAdoptService
      new ecs.FargateService(this, 'dogAdoptService', {
        cluster,
        taskDefinition: dogAdoptTaskDefinition,
        desiredCount: 1,
      });
    }

    // GetAllPets
    // Define the ECS task definition
    const getAllPetsTaskDefinition = new ecs.FargateTaskDefinition(this, 'getAllPetsTaskDefinition');

    // Add permissions to query SSM parameter
    getAllPetsTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
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
    const getAllPetsContainer = getAllPetsTaskDefinition.addContainer('getAllPetsContainer', {
      image: ecs.ContainerImage.fromAsset('./resources/user_simulation/getallpets'),
      logging: new ecs.AwsLogDriver({ streamPrefix: 'getallpets' }),
    });

    // Configure container settings, environment variables, etc.
    getAllPetsContainer.addPortMappings({ containerPort: 80 });

    // Create getAllPetsService
    new ecs.FargateService(this, 'getAllPetsService', {
      cluster,
      taskDefinition: getAllPetsTaskDefinition,
      desiredCount: 1,
    });

    // Search List
    // Define the ECS task definition
    const searchListTaskDefinition = new ecs.FargateTaskDefinition(this, 'searchListTaskDefinition');

    // Add permissions to query SSM parameter
    searchListTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
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
    const searchListContainer = searchListTaskDefinition.addContainer('searchListContainer', {
      image: ecs.ContainerImage.fromAsset('./resources/user_simulation/searchlist'),
      logging: new ecs.AwsLogDriver({ streamPrefix: 'searchlist' }),
    });

    // Configure container settings, environment variables, etc.
    searchListContainer.addPortMappings({ containerPort: 80 });

    // Create searchListService
    new ecs.FargateService(this, 'searchListService', {
      cluster,
      taskDefinition: searchListTaskDefinition,
      desiredCount: 1,
    });


    // AZ Monitoring Service
    // Define the ECS task definition
    const azMonitorTaskDefinition = new ecs.FargateTaskDefinition(this, 'azMonitorTaskDefinition');


    // EC2 permissions (for detailed instance information if needed)
    azMonitorTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'autoscaling:DescribeAutoScalingGroups',
        'autoscaling:DescribeAutoScalingInstances',
      ],
      resources: ['*'],
    }));

    // CloudWatch permissions
    azMonitorTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
        'cloudwatch:GetMetricData',
        'cloudwatch:GetMetricStatistics',
      ],
      resources: ['*'],
    }));

    // RDS Permissions
    azMonitorTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds:DescribeDBClusters',
        'rds:DescribeDBInstances',
      ],
      resources: ['*'],
    }));

    // EC2 permissions (for detailed instance information if needed)
    azMonitorTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:DescribeInstances',
        'ec2:DescribeInstanceStatus',
      ],
      resources: ['*'],
    }));

    // Add a container to the task definition using your Docker image
    const azMonitorContainer = azMonitorTaskDefinition.addContainer('azMonitorContainer', {
      image: ecs.ContainerImage.fromAsset('./resources/user_simulation/azmonitor'),
      logging: new ecs.AwsLogDriver({ streamPrefix: 'azmonitor' }),
    });

    // // Configure container settings, environment variables, etc.
    // searchListContainer.addPortMappings({ containerPort: 80 });

    // Create searchListService
    new ecs.FargateService(this, 'azMonitorService', {
      cluster,
      taskDefinition: azMonitorTaskDefinition,
      desiredCount: 1,
    });



  }
}
