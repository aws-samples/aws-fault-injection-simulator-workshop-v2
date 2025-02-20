import { Stack, StackProps } from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs'
import path = require('path');
import fs = require('fs');

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
        logging: new ecs.AwsLogDriver({
          streamPrefix: 'catadopt',
          removalPolicy: cdk.RemovalPolicy.DESTROY
        }),
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
        logging: new ecs.AwsLogDriver({
          streamPrefix: 'dogadopt',
          removalPolicy: cdk.RemovalPolicy.DESTROY
        }),
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
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'getallpets',
        removalPolicy: cdk.RemovalPolicy.DESTROY
      }),
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
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'searchlist',
        removalPolicy: cdk.RemovalPolicy.DESTROY
      }),
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

    // Create a build context directory
    const azMonitorDockerBuildDir = path.join(__dirname, 'azMonitorDockerBuild');
    if (!fs.existsSync(azMonitorDockerBuildDir)) {
      fs.mkdirSync(azMonitorDockerBuildDir, { recursive: true });
    }

    // Create Dockerfile in the build directory
    const dockerfileContentAzMonitorPath = path.join(azMonitorDockerBuildDir, 'Dockerfile');

    const dockerfileContentAzMonitor = `# Start from the official Golang image
FROM --platform=linux/amd64 public.ecr.aws/docker/library/golang:1.23.6-alpine

ENV GOPROXY=https://goproxy.io,direct

# Add necessary tools
RUN apk add --no-cache ca-certificates tzdata git

# Set working directory
WORKDIR /app

# Clone the repository
RUN git clone https://github.com/mrvladis/aws_az_monitor.git .

# Download dependencies
RUN go mod download

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o monitor 

# Create a non-root user
RUN adduser -D appuser
USER appuser

# Set environment variable for polling interval (15 seconds)
ENV POLLING_INTERVAL=15

# Run the application
CMD ["./monitor"]`;

    fs.writeFileSync(dockerfileContentAzMonitorPath, dockerfileContentAzMonitor);

    // Add a container to the task definition using your Docker image
    const azMonitorContainer = azMonitorTaskDefinition.addContainer('azMonitorContainer', {
      image: ecs.ContainerImage.fromAsset(azMonitorDockerBuildDir),
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
