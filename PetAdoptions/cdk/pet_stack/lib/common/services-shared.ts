import { Construct } from 'constructs';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import * as cdk from "aws-cdk-lib";
import { ListAdoptionsService } from '../services/list-adoptions-service'; // Assuming this is the correct import
import { PayForAdoptionService } from '../services/pay-for-adoption-service'
import { SSMParameterReader } from './ssm-parameter-reader';
import { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import * as ddb from 'aws-cdk-lib/aws-dynamodb'



//Create ListAdoptionsService
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

// Create PayForAdoptionService
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

// Create Or GetDynamoDBTableProps
export interface CreateOrGetDynamoDBTableProps {
    scope: Construct;
    isPrimaryRegionDeployment: boolean;
    secondaryRegion?: string;
    mainRegion?: string;
}

export function createOrGetDynamoDBTable(props: CreateOrGetDynamoDBTableProps): string {
    let dynamoDBTableName = 'undefined';
  
    if (props.isPrimaryRegionDeployment) {
      let tableProps: any = {
        partitionKey: {
          name: 'pettype',
          type: ddb.AttributeType.STRING
        },
        sortKey: {
          name: 'petid',
          type: ddb.AttributeType.STRING
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billing: ddb.Billing.onDemand(),
      };
  
      if (props.secondaryRegion) {
        console.log(`SecondaryRegion provided as [${props.secondaryRegion}]. Creating Global DynamoDB Table`);
        tableProps.replicas = [{ region: props.secondaryRegion }];
      } else {
        console.log("SecondaryRegion is not provided. Creating single region DynamoDB Table");
      }
  
      const dynamodb_petadoption = new ddb.TableV2(props.scope, 'ddb_petadoption', tableProps);
  
      // Create Write Throttle Events Alarm
      dynamodb_petadoption.metric('WriteThrottleEvents', { statistic: "avg" }).createAlarm(props.scope, 'WriteThrottleEvents-BasicAlarm', {
        threshold: 0,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        alarmName: `${dynamodb_petadoption.tableName}-WriteThrottleEvents-BasicAlarm`,
      });
  
      // Create Read Throttle Events Alarm
      dynamodb_petadoption.metric('ReadThrottleEvents', { statistic: "avg" }).createAlarm(props.scope, 'ReadThrottleEvents-BasicAlarm', {
        threshold: 0,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        alarmName: `${dynamodb_petadoption.tableName}-ReadThrottleEvents-BasicAlarm`,
      });
  
      dynamoDBTableName = dynamodb_petadoption.tableName;
    } else {
      console.log("Secondary Region Deployment. Not deploying DynamoDB. Getting DynamoDB information from SSM");
      if (!props.mainRegion) {
        throw new Error("MainRegion must be provided for secondary region deployment");
      }
      const ssmDynamoDBTableName = new SSMParameterReader(props.scope, 'dynamodbtablename', {
        parameterName: "/petstore/dynamodbtablename",
        region: props.mainRegion
      });
      dynamoDBTableName = ssmDynamoDBTableName.getParameterValue();
    }
  
    return dynamoDBTableName;
  }

// Create Or Get RDSCluster

export interface CreateOrGetRDSClusterProps {
  scope: Construct;
  isPrimaryRegionDeployment: boolean;
  vpc: ec2.IVpc;
  secondaryRegion?: string;
  mainRegion?: string;
  rdsUsername?: string;
}

export interface RDSClusterResult {
  secret: cdk.aws_secretsmanager.ISecret;
  endpoint: string;
}

export function createOrGetRDSCluster(props: CreateOrGetRDSClusterProps): RDSClusterResult {
  if (props.isPrimaryRegionDeployment) {
    const rdssecuritygroup = new ec2.SecurityGroup(props.scope, 'petadoptionsrdsSG', {
      vpc: props.vpc
    });


    const rdsUsername = props.rdsUsername || "petadmin";

    const auroraCluster = new rds.DatabaseCluster(props.scope, 'Database', {
      credentials: {
        username: rdsUsername,
        replicaRegions: props.secondaryRegion ? [{ region: props.secondaryRegion }] : undefined,
      },
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_13_9 }),
      writer: rds.ClusterInstance.provisioned('writer', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
      }),
      readers: [
        rds.ClusterInstance.provisioned('reader', {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
        }),
      ],
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(props.scope, 'ParameterGroup', 'default.aurora-postgresql13'),
      vpc: props.vpc,
      securityGroups: [rdssecuritygroup],
      defaultDatabaseName: 'adoptions'
    });

    if (auroraCluster.secret === undefined) {
      throw new Error("RDS Doesn't have a secret");
    }

    return { secret: auroraCluster.secret, endpoint: auroraCluster.clusterEndpoint.hostname};
  } else {
    if (!props.mainRegion) {
      throw new Error("MainRegion must be provided for secondary region deployment");
    }

    console.log("Secondary Region Deployment. Getting RDS information from SSM");
    
    const ssmrdsSecretName = new SSMParameterReader(props.scope, 'rdsSecretName', {
      parameterName: "/petstore/rdssecretname",
      region: props.mainRegion
    });
    const rdsSecretName = ssmrdsSecretName.getParameterValue();
    const rdsSecret = secretsmanager.Secret.fromSecretNameV2(props.scope, 'rdsSecret', rdsSecretName);

    const ssmrdsEndpointName = new SSMParameterReader(props.scope, 'ssmrdsEndpointName', {
      parameterName: "/petstore/rdsendpoint",
      region: props.mainRegion
    });
    const rdsEndpoint = ssmrdsEndpointName.getParameterValue();

    return { secret: rdsSecret, endpoint: rdsEndpoint };
  }
}

// Create VPC
export interface CreateVPCProps {
  scope: Construct;
  isPrimaryRegionDeployment: boolean;
  contextId: string;
  defaultPrimaryCIDR?: string;
  defaultSecondaryCIDR?: string;
  natGateways?: number;
  maxAzs?: number;
}

export function createVPC(props: CreateVPCProps): ec2.Vpc {
  const {
    scope,
    isPrimaryRegionDeployment,
    contextId,
    defaultPrimaryCIDR = "10.1.0.0/16",
    defaultSecondaryCIDR = "10.2.0.0/16",
    natGateways = 1,
    maxAzs = 2
  } = props;

  let cidrRange: string;

  if (isPrimaryRegionDeployment) {
    cidrRange = scope.node.tryGetContext('vpc_cidr_primary') || defaultPrimaryCIDR;
  } else {
    cidrRange = scope.node.tryGetContext('vpc_cidr_secondary') || defaultSecondaryCIDR;
  }

  return new ec2.Vpc(scope, contextId, {
    ipAddresses: ec2.IpAddresses.cidr(cidrRange),
    natGateways: natGateways,
    maxAzs: maxAzs,
  });
}

