import { Construct } from 'constructs';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import * as cdk from "aws-cdk-lib";
import { ListAdoptionsService } from '../services/list-adoptions-service';
import { PayForAdoptionService } from '../services/pay-for-adoption-service'
import { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import * as ddb from 'aws-cdk-lib/aws-dynamodb'
import { RemovalPolicy, Tags } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam';


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
    repositoryURI?: string;
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
    repositoryURI?: string;
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

// Create DynamoDB Table
export interface CreateDynamoDBTableProps {
    scope: Construct;
}

export function createDynamoDBTable(props: CreateDynamoDBTableProps): string {
    const dynamodb_petadoption = new ddb.TableV2(props.scope, 'ddb_petadoption', {
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
        tags: [{ key: 'DisruptDynamoDb', value: 'Allowed' }]
    });

    dynamodb_petadoption.metric('WriteThrottleEvents', { statistic: "avg" }).createAlarm(props.scope, 'WriteThrottleEvents-BasicAlarm', {
        threshold: 0,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        alarmName: `${dynamodb_petadoption.tableName}-WriteThrottleEvents-BasicAlarm`,
    });

    dynamodb_petadoption.metric('ReadThrottleEvents', { statistic: "avg" }).createAlarm(props.scope, 'ReadThrottleEvents-BasicAlarm', {
        threshold: 0,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        alarmName: `${dynamodb_petadoption.tableName}-ReadThrottleEvents-BasicAlarm`,
    });

    return dynamodb_petadoption.tableName;
}

// Create S3 Buckets
export interface CreateS3BucketProps {
    scope: Construct;
}

export function createFISReportBucket(props: CreateS3BucketProps): s3.Bucket {
    return new s3.Bucket(props.scope, 'fisreportbucket', {
        publicReadAccess: false,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
        versioned: true,
    });
}

export function createAdoptionsBucket(props: CreateS3BucketProps): s3.Bucket {
    const bucket = new s3.Bucket(props.scope, 's3bucket_petadoption', {
        publicReadAccess: false,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
        versioned: true,
    });
    Tags.of(bucket).add("DisruptS3", "Allowed");
    return bucket;
}

// Create RDS Cluster
export interface CreateRDSClusterProps {
    scope: Construct;
    vpc: ec2.IVpc;
    vpcCidr: string;
    rdsUsername?: string;
}

export interface RDSClusterResult {
    secret: cdk.aws_secretsmanager.ISecret;
    endpoint: string;
    clusterIdentifier: string;
    instanceIdentifierWriter: string;
    instanceIdentifierReader: string;
}

export function createRDSCluster(props: CreateRDSClusterProps): RDSClusterResult {
    const rdssecuritygroup = new ec2.SecurityGroup(props.scope, 'petadoptionsrdsSG', {
        vpc: props.vpc
    });
    rdssecuritygroup.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(5432), 'Allow Aurora PG access from within the VPC CIDR range');

    const rdsUsername = props.rdsUsername || "petadmin";
    const auroraCluster = new rds.DatabaseCluster(props.scope, 'Database', {
        credentials: { username: rdsUsername },
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
    return {
        secret: auroraCluster.secret,
        endpoint: auroraCluster.clusterEndpoint.hostname,
        clusterIdentifier: auroraCluster.clusterIdentifier,
        instanceIdentifierWriter: auroraCluster.instanceIdentifiers[0],
        instanceIdentifierReader: auroraCluster.instanceIdentifiers[1]
    };
}

// Create VPC (no Transit Gateway)
export interface CreateVPCProps {
    scope: Construct;
    contextId: string;
    cidr: string;
    natGateways?: number;
    maxAzs?: number;
}

export function createVPC(props: CreateVPCProps): ec2.Vpc {
    const { scope, contextId, cidr, natGateways = 1, maxAzs = 2 } = props;

    return new ec2.Vpc(scope, contextId, {
        ipAddresses: ec2.IpAddresses.cidr(cidr),
        natGateways: natGateways,
        maxAzs: maxAzs,
    });
}
