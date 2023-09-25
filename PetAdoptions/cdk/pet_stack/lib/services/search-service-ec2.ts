import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { EcsEc2Service, EcsEc2ServiceProps } from './ecs-ec2-service'
import { Construct } from 'constructs'

export class SearchEc2Service extends EcsEc2Service {

  constructor(scope: Construct, id: string, props: EcsEc2ServiceProps  ) {
    super(scope, id, props);

    this.taskDefinition.taskRole?.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'AmazonDynamoDBReadOnlyAccess', 'arn:aws:iam::aws:policy/AmazonDynamoDBReadOnlyAccess'));
    this.taskDefinition.taskRole?.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'AmazonS3ReadOnlyAccess', 'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'));
  }

  containerImageFromRepository(repositoryURI: string) : ecs.ContainerImage {
    return ecs.ContainerImage.fromRegistry(`${repositoryURI}/pet-search-java:latest`)
  }

  createContainerImage() : ecs.ContainerImage {
    return ecs.ContainerImage.fromDockerImageAsset(new DockerImageAsset(this,"search-service", {
      directory: "./resources/microservices/petsearch-java"
    }))
  }
}
