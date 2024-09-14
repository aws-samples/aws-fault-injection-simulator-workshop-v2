import { Construct } from 'constructs';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import * as cdk from "aws-cdk-lib";
import { ListAdoptionsService } from '../services/list-adoptions-service'; // Assuming this is the correct import
import { PayForAdoptionService } from '../services/pay-for-adoption-service'

export interface CreateListAdoptionsServiceProps {
  scope: Construct;
  id: string;
  cluster: Cluster;
  logGroupName: string;
  cpu: number;
  memoryLimitMiB: number;
  healthCheck: string;
  instrumentation: string;
  enableSSM: boolean;
  databaseSecret: cdk.aws_secretsmanager.ISecret;
  desiredTaskCount: number;
  region: string;
  securityGroup: SecurityGroup;
  repositoryURI?: string; // Optional parameter
}

export function createListAdoptionsService(props: CreateListAdoptionsServiceProps): ListAdoptionsService {
  return new ListAdoptionsService(props.scope, props.id, {
    cluster: props.cluster,
    logGroupName: props.logGroupName,
    cpu: props.cpu,
    memoryLimitMiB: props.memoryLimitMiB,
    healthCheck: props.healthCheck,
    instrumentation: props.instrumentation,
    enableSSM: props.enableSSM,
    databaseSecret: props.databaseSecret,
    desiredTaskCount: props.desiredTaskCount,
    region: props.region,
    securityGroup: props.securityGroup,
    ...(props.repositoryURI && { repositoryURI: props.repositoryURI }),
  });
}

export interface CreatePayForAdoptionServiceProps {
    scope: Construct;
    id: string;
    cluster: Cluster;
    logGroupName: string;
    cpu: number;
    memoryLimitMiB: number;
    healthCheck: string;
    enableSSM: boolean;
    databaseSecret: cdk.aws_secretsmanager.ISecret;
    desiredTaskCount: number;
    region: string;
    securityGroup: SecurityGroup;
    repositoryURI?: string; // Optional parameter
  }
  
  export function createPayForAdoptionService(props: CreatePayForAdoptionServiceProps): PayForAdoptionService {
    return new PayForAdoptionService(props.scope, props.id, {
      cluster: props.cluster,
      logGroupName: props.logGroupName,
      cpu: props.cpu,
      memoryLimitMiB: props.memoryLimitMiB,
      healthCheck: props.healthCheck,
      enableSSM: props.enableSSM,
      databaseSecret: props.databaseSecret,
      desiredTaskCount: props.desiredTaskCount,
      region: props.region,
      securityGroup: props.securityGroup,
      ...(props.repositoryURI && { repositoryURI: props.repositoryURI }),
    });
  }

