import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as cdk from "aws-cdk-lib";
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { EcsService, EcsServiceProps } from './ecs-service'
import { Construct } from 'constructs'


export interface ListAdoptionServiceProps extends EcsServiceProps {
  databaseSecret: cdk.aws_secretsmanager.ISecret
}

export class ListAdoptionsService extends EcsService {

  constructor(scope: Construct, id: string, props: ListAdoptionServiceProps  ) {
    super(scope, id, props);
    props.databaseSecret.grantRead(this.taskDefinition.taskRole);
  }

  containerImageFromRepository(repositoryURI: string) : ecs.ContainerImage {
    return ecs.ContainerImage.fromRegistry(`${repositoryURI}/pet-listadoptions:latest`)
  }

  createContainerImage() : ecs.ContainerImage {
    return ecs.ContainerImage.fromDockerImageAsset(new DockerImageAsset(this,"petlistadoptions-go", 
    { directory: "./resources/microservices/petlistadoptions-go"}
    ))
  } 
}
