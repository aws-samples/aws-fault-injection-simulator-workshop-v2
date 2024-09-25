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
            // SecondaryRegion provided. Creating Global DynamoDB Table
            tableProps.replicas = [{ region: props.secondaryRegion }];
        } else {
            // SecondaryRegion is not provided. Creating single region DynamoDB Table
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
        // Secondary Region Deployment. Not deploying DynamoDB. Getting DynamoDB information from SSM
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
    defaultPrimaryCIDR: string;
    defaultSecondaryCIDR: string;
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

        rdssecuritygroup.addIngressRule(ec2.Peer.ipv4(props.defaultPrimaryCIDR), ec2.Port.tcp(5432), 'Allow Aurora PG access from within the VPC CIDR range');
        rdssecuritygroup.addIngressRule(ec2.Peer.ipv4(props.defaultSecondaryCIDR), ec2.Port.tcp(5432), 'Allow Aurora PG access from within the VPC CIDR range');

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
        return { secret: auroraCluster.secret, endpoint: auroraCluster.clusterEndpoint.hostname };
    } else {
        if (!props.mainRegion) {
            throw new Error("MainRegion must be provided for secondary region deployment");
        }
        // Secondary Region Deployment. Getting RDS information from SSM
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
export interface CreateVPCWithTransitGatewayProps {
    scope: Construct;
    isPrimaryRegionDeployment: boolean;
    contextId: string;
    defaultPrimaryCIDR: string;
    defaultSecondaryCIDR: string;
    natGateways?: number;
    maxAzs?: number;
    createTransitGateway?: boolean;
}

export interface VPCTransitGatewayResult {
    vpc: ec2.Vpc;
    transitGateway?: ec2.CfnTransitGateway;
    transitGatewayAttachment?: ec2.CfnTransitGatewayAttachment;
    transitGatewayRouteTable?: ec2.CfnTransitGatewayRouteTable;
}

export function createVPCWithTransitGateway(props: CreateVPCWithTransitGatewayProps): VPCTransitGatewayResult {
    const {
        scope,
        isPrimaryRegionDeployment,
        contextId,
        defaultPrimaryCIDR,
        defaultSecondaryCIDR,
        natGateways = 1,
        maxAzs = 2,
        createTransitGateway = true
    } = props;

    let cidrRange: string;
    let asnTGW: number;

    if (isPrimaryRegionDeployment) {
        cidrRange = defaultPrimaryCIDR;
        asnTGW = 64512;
    } else {
        cidrRange = defaultSecondaryCIDR;
        asnTGW = 64612;
    }

    const vpc = new ec2.Vpc(scope, contextId, {
        ipAddresses: ec2.IpAddresses.cidr(cidrRange),
        natGateways: natGateways,
        maxAzs: maxAzs,
    });

    if (!createTransitGateway) {
        return { vpc };
    }

    // Create Transit Gateway
    const transitGateway = new ec2.CfnTransitGateway(scope, `${contextId}TransitGateway`, {
        amazonSideAsn: asnTGW, // Default ASN
        autoAcceptSharedAttachments: 'enable',
        defaultRouteTableAssociation: 'disable',
        defaultRouteTablePropagation: 'disable',
        dnsSupport: 'enable',
        vpnEcmpSupport: 'enable',
        tags: [{ key: 'Name', value: `${contextId}TransitGateway` }]
    });

    // Create Route Table for TGW
    const transitGatewayRouteTable = new ec2.CfnTransitGatewayRouteTable(scope, `${contextId}TransitGatewayRouteTable`, {
        transitGatewayId: transitGateway.ref,
    });
    transitGatewayRouteTable.addDependency(transitGateway);
    // transitGateway.addPropertyOverride('associationDefaultRouteTableId', TransitGatewayRouteTable.ref)
    // transitGateway.addPropertyOverride('propagationDefaultRouteTableId', TransitGatewayRouteTable.ref)


    // Attach VPC to Transit Gateway
    const transitGatewayAttachment = new ec2.CfnTransitGatewayAttachment(scope, `${contextId}TransitGatewayAttachment`, {
        transitGatewayId: transitGateway.ref,
        vpcId: vpc.vpcId,
        subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
        tags: [{ key: 'Name', value: `${contextId}TransitGatewayAttachment` }]
    });
    transitGatewayAttachment.addDependency(transitGateway);

    // Associate Transit Gateway Route Table with the Attachment
    const TransitGatewayRouteTableAssociationVPC = new ec2.CfnTransitGatewayRouteTableAssociation(scope, `${contextId}TransitGatewayRouteTableAssociationVPC`, {
        transitGatewayAttachmentId: transitGatewayAttachment.ref,
        transitGatewayRouteTableId: transitGatewayRouteTable.ref,
    });
    // Create Propagation for Transit Gateway Route Table t
    const TransitGatewayRouteTablePropagationVPC = new ec2.CfnTransitGatewayRouteTablePropagation(scope, `${contextId}TransitGatewayRouteTablePropagationVPC`, {
        transitGatewayAttachmentId: transitGatewayAttachment.ref,
        transitGatewayRouteTableId: transitGatewayRouteTable.ref,
    });

    let privateRoute
    // Add a route to the Transit Gateway in each private subnet's route table
    vpc.privateSubnets.forEach((subnet, index) => {
        privateRoute = new ec2.CfnRoute(scope, `${contextId}TransitGatewayPrivateRoute${index}`, {
            routeTableId: subnet.routeTable.routeTableId,
            destinationCidrBlock: '10.0.0.0/8',
            transitGatewayId: transitGateway.ref
        });
        privateRoute.addDependency(transitGatewayAttachment)
    });

    let publicRoute
    // Add a route to the Transit Gateway in each public subnet's route table
    vpc.publicSubnets.forEach((subnet, index) => {
        publicRoute = new ec2.CfnRoute(scope, `${contextId}TransitGatewayPublicRoute${index}`, {
            routeTableId: subnet.routeTable.routeTableId,
            destinationCidrBlock: '10.0.0.0/8',
            transitGatewayId: transitGateway.ref
        });
        publicRoute.addDependency(transitGatewayAttachment)
    });
    return { vpc, transitGateway, transitGatewayAttachment, transitGatewayRouteTable };
}

export interface CreateTGWRoutesProps {
    scope: Construct;
    secondaryRegion: string;
    mainRegion: string;
    isPrimaryRegionDeployment: boolean;
}

export function createTGWRoutes(props: CreateTGWRoutesProps): void {

    const ssmTGWId = new SSMParameterReader(props.scope, 'ssmTGWId', {
        parameterName: "/petstore/tgwid",
        region: props.mainRegion
    });
    const mainTGWId = ssmTGWId.getParameterValue();
    const ssmTGWAttachmentId = new SSMParameterReader(props.scope, 'ssmTGWAttachmentId', {
        parameterName: "/petstore/tgwattachmentid",
        region: props.mainRegion
    });
    const tgwAttachmentId = ssmTGWAttachmentId.getParameterValue();
    const ssmVPCCIDRMain = new SSMParameterReader(props.scope, 'ssmVPCCIDRMain', {
        parameterName: "/petstore/vpccidr",
        region: props.mainRegion
    });
    const vpcCIDRMain = ssmVPCCIDRMain.getParameterValue();

    const ssmtransitGatewayRouteTableMain = new SSMParameterReader(props.scope, 'ssmtransitGatewayRouteTableMain', {
        parameterName: "/petstore/tgwroutetableid",
        region: props.mainRegion
    });
    const transitGatewayRouteTableIDMain = ssmtransitGatewayRouteTableMain.getParameterValue();

    const ssmVPCCIDRSecond = new SSMParameterReader(props.scope, 'ssmVPCCIDRSecond', {
        parameterName: "/petstore/vpccidr",
        region: props.secondaryRegion
    });
    const vpcCIDRSecond = ssmVPCCIDRSecond.getParameterValue();

    const ssmtransitGatewayRouteTableSecond = new SSMParameterReader(props.scope, 'ssmtransitGatewayRouteTableSecond', {
        parameterName: "/petstore/tgwroutetableid",
        region: props.secondaryRegion
    });
    const transitGatewayRouteTableIDSecond = ssmtransitGatewayRouteTableSecond.getParameterValue();

    if (props.isPrimaryRegionDeployment) {
        new ec2.CfnTransitGatewayRoute(props.scope, 'TransitGatewayRouteMain', {
            destinationCidrBlock: vpcCIDRSecond,
            transitGatewayRouteTableId: transitGatewayRouteTableIDMain,
            blackhole: false,
            transitGatewayAttachmentId: tgwAttachmentId,
        });
        // Associate Transit Gateway Route Table with the Attachment
        const TransitGatewayRouteTableAssociationVPC = new ec2.CfnTransitGatewayRouteTableAssociation(scope, `${contextId}TransitGatewayRouteTableAssociationVPC`, {
            transitGatewayAttachmentId: tgwAttachmentId,
            transitGatewayRouteTableId: transitGatewayRouteTableIDMain,
        });
    } else {
        new ec2.CfnTransitGatewayRoute(props.scope, 'TransitGatewayRouteMain', {
            destinationCidrBlock: vpcCIDRMain,
            transitGatewayRouteTableId: transitGatewayRouteTableIDSecond,
            blackhole: false,
            transitGatewayAttachmentId: tgwAttachmentId,
        });
        // Associate Transit Gateway Route Table with the Attachment
        const TransitGatewayRouteTableAssociationVPC = new ec2.CfnTransitGatewayRouteTableAssociation(scope, `${contextId}TransitGatewayRouteTableAssociationVPC`, {
            transitGatewayAttachmentId: tgwAttachmentId,
            transitGatewayRouteTableId: transitGatewayRouteTableIDSecond,
        });
    }
}