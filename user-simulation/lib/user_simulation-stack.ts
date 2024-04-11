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
      image: ecs.ContainerImage.fromAsset('./lib/dogAdopt'), 
      logging: new ecs.AwsLogDriver({ streamPrefix: 'dogAdopt' }),
    });
    
    // Configure container settings, environment variables, etc.
    dogAdoptContainer.addPortMappings({ containerPort: 80 });

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
      image: ecs.ContainerImage.fromAsset('./lib/getallpets'), 
      logging: new ecs.AwsLogDriver({ streamPrefix: 'getallpets' }),
    });
    
    // Configure container settings, environment variables, etc.
    getAllPetsContainer.addPortMappings({ containerPort: 80 });

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
      image: ecs.ContainerImage.fromAsset('./lib/searchlist'), 
      logging: new ecs.AwsLogDriver({ streamPrefix: 'searchlist' }),
    });
    
    // Configure container settings, environment variables, etc.
    searchListContainer.addPortMappings({ containerPort: 80 });

    // Create dogAdoptService
    new ecs.FargateService(this, 'dogAdoptService', {
      cluster,
      taskDefinition: dogAdoptTaskDefinition,
      desiredCount: 5, 
    });

    // Create getAllPetsService
    new ecs.FargateService(this, 'getAllPetsService', {
      cluster,
      taskDefinition: getAllPetsTaskDefinition,
      desiredCount: 5, 
    });

    // Create searchListService
    new ecs.FargateService(this, 'searchListService', {
      cluster,
      taskDefinition: searchListTaskDefinition,
      desiredCount: 5, 
    });
  }
}