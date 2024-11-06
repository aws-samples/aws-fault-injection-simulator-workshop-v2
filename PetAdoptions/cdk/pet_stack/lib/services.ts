import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as asg from 'aws-cdk-lib/aws-autoscaling';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sns from 'aws-cdk-lib/aws-sns'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'
import * as s3seeder from 'aws-cdk-lib/aws-s3-deployment'
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
////import * as cloud9 from 'aws-cdk-lib/aws-cloud9';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs'
import { SearchEc2Service } from './services/search-service-ec2'
import { TrafficGeneratorService } from './services/traffic-generator-service'
import { StatusUpdaterService } from './services/status-updater-service'
import { PetAdoptionsStepFn } from './services/stepfn'
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import { CfnJson, RemovalPolicy, Fn, Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { readFileSync } from 'fs';
import 'ts-replace-all'
import { KubectlLayer } from 'aws-cdk-lib/lambda-layer-kubectl';
// import { Cloud9Environment } from './modules/core/cloud9';
import { NodegroupAsgTags } from 'eks-nodegroup-asg-tags-cdk';
import { ServiceStackProps, TargetTag } from './common/services-shared-properties';
import { createListAdoptionsService, createPayForAdoptionService, createOrGetDynamoDBTable, createOrGetRDSCluster, createVPCWithTransitGateway, createOrGetAIMRoleS3Grant } from './common/services-shared';
import { SSMParameterReader } from './common/ssm-parameter-reader';

export class Services extends Stack {
    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        const stack = Stack.of(this);
        const region = stack.region;
        const stackName = id;
        const defaultPrimaryCIDR = this.node.tryGetContext('vpc_cidr_primary') || "10.1.0.0/16";
        const defaultSecondaryCIDR = this.node.tryGetContext('vpc_cidr_secondary') || "10.2.0.0/16";
        const fisLambdaTagName = this.node.tryGetContext('fisLambdaTagName') || 'FISExperimentReady';
        const fisLambdaTagValue = this.node.tryGetContext('fisLambdaTagValue') || 'Yes';
        const fisLambdaExtensionArn = this.node.tryGetContext('fisLambdaExtensionArn')||'arn:aws:lambda:us-east-1:211125607513:layer:aws-fis-extension-x86_64:9';
        const fisLambdaExecWrapper = this.node.tryGetContext('fisLambdaExecWrapper')||'/opt/aws-fis/bootstrap';
        const fisExtensionMetrics = this.node.tryGetContext('fisExtensionMetrics')||'all';

        const fisResourceTag: TargetTag = {
            TagName: fisLambdaTagName,
            TagValue: fisLambdaTagValue
        }


        let isPrimaryRegionDeployment
        if (props.DeploymentType as string == 'primary') {
            // DeploymentType is Primary Region Deployment
            isPrimaryRegionDeployment = true
        } else {
            // DeploymentType is Secondary Region Deployment
            isPrimaryRegionDeployment = false
        }
        var isEventEngine = 'false';
        if (this.node.tryGetContext('is_event_engine') != undefined) {
            isEventEngine = this.node.tryGetContext('is_event_engine');
        }
        // Create SQS resource to send Pet adoption messages to
        const sqsQueue = new sqs.Queue(this, 'sqs_petadoption', {
            visibilityTimeout: Duration.seconds(300)
        });

        // Create SNS and an email topic to send notifications to
        const topic_petadoption = new sns.Topic(this, 'topic_petadoption');
        var topic_email = this.node.tryGetContext('snstopic_email');
        if (topic_email == undefined) {
            topic_email = "someone@example.com";
        }
        topic_petadoption.addSubscription(new subs.EmailSubscription(topic_email));

        // Create VPC
        const VPCwitTGW = createVPCWithTransitGateway({
            scope: this,
            isPrimaryRegionDeployment: isPrimaryRegionDeployment,
            contextId: 'Microservices',
            defaultPrimaryCIDR: defaultPrimaryCIDR,
            defaultSecondaryCIDR: defaultSecondaryCIDR,
            // And optionally override natGateways and maxAzs:
            // natGateways: 2,
            // maxAzs: 3,
        });

        const theVPC = VPCwitTGW.vpc
        const transitGatewayRouteTable = VPCwitTGW.transitGatewayRouteTable

        if (isPrimaryRegionDeployment) { } else {
            const ssmTGWId = new SSMParameterReader(this, 'ssmTGWId', {
                parameterName: "/petstore/tgwid",
                region: props.MainRegion
            });
            const mainTGWId = ssmTGWId.getParameterValue();

            // Create TGW Peering
            const TransitGatewayPeeringAttachment = new ec2.CfnTransitGatewayPeeringAttachment(this, 'MyCfnTransitGatewayPeeringAttachment', {
                peerAccountId: `${props.env?.account}`,
                peerRegion: props.MainRegion as string,
                peerTransitGatewayId: mainTGWId,
                transitGatewayId: `${VPCwitTGW.transitGateway?.attrId}`,
            });
        }

        // Creates an S3 bucket to store pet images
        const s3_observabilitypetadoptions = createOrGetAIMRoleS3Grant({
            scope: this,
            isPrimaryRegionDeployment: isPrimaryRegionDeployment,
            mainRegion: props.MainRegion,
            secondaryRegion: props.SecondaryRegion,
        });

        // Seeds the S3 bucket with pet images
        new s3seeder.BucketDeployment(this, "s3seeder_petadoption", {
            destinationBucket: s3_observabilitypetadoptions.s3Bucket,
            sources: [s3seeder.Source.asset('./resources/kitten.zip'), s3seeder.Source.asset('./resources/puppies.zip'), s3seeder.Source.asset('./resources/bunnies.zip')]
        });

        // Creates the DynamoDB table for Petadoption data
        // Define the DynamoDB table properties 
        const dynamoDBTableName = createOrGetDynamoDBTable({
            scope: this,
            isPrimaryRegionDeployment: isPrimaryRegionDeployment,
            secondaryRegion: props.SecondaryRegion,
            mainRegion: props.MainRegion
        });

        // RDS
        const rdsResult = createOrGetRDSCluster({
            scope: this,
            isPrimaryRegionDeployment: isPrimaryRegionDeployment,
            vpc: theVPC,
            mainRegion: props.MainRegion,
            secondaryRegion: props.SecondaryRegion,
            defaultPrimaryCIDR: defaultPrimaryCIDR,
            defaultSecondaryCIDR: defaultSecondaryCIDR,
            rdsUsername: this.node.tryGetContext('rdsusername')
        });

        const rdsSecret = rdsResult.secret;
        const rdsEndpoint = rdsResult.endpoint;

        const readSSMParamsPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ssm:GetParametersByPath',
                'ssm:GetParameters',
                'ssm:GetParameter',
                'ec2:DescribeVpcs'
            ],
            resources: ['*']
        });

        const ddbSeedPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:BatchWriteItem',
                'dynamodb:ListTables',
                "dynamodb:Scan",
                "dynamodb:Query"
            ],
            resources: ['*']
        });

        const repositoryURI = "public.ecr.aws/one-observability-workshop";

        const ecsServicesSecurityGroup = new ec2.SecurityGroup(this, 'ECSServicesSG', {
            vpc: theVPC
        });

        ecsServicesSecurityGroup.addIngressRule(ec2.Peer.ipv4(theVPC.vpcCidrBlock), ec2.Port.tcp(80));

        const ecsPayForAdoptionCluster = new ecs.Cluster(this, "PayForAdoption", {
            vpc: theVPC,
            containerInsights: true
        });

        // PayForAdoption service definitions-----------------------------------------------------------------------
        const payForAdoptionService = createPayForAdoptionService({
            scope: this,
            id: 'pay-for-adoption-service',
            cluster: ecsPayForAdoptionCluster,
            logGroupName: "/ecs/PayForAdoption",
            cpu: 1024,
            memoryLimitMiB: 2048,
            healthCheck: '/health/status',
            enableSSM: true,
            databaseSecret: rdsSecret,
            desiredTaskCount: 2,
            region: region,
            securityGroup: ecsServicesSecurityGroup,
            // Uncomment the following line if you want to include repositoryURI
            // repositoryURI: repositoryURI,
        });

        payForAdoptionService.taskDefinition.taskRole?.addToPrincipalPolicy(readSSMParamsPolicy);
        payForAdoptionService.taskDefinition.taskRole?.addToPrincipalPolicy(ddbSeedPolicy);


        const ecsPetListAdoptionCluster = new ecs.Cluster(this, "PetListAdoptions", {
            vpc: theVPC,
            containerInsights: true
        });
        // PetListAdoptions service definitions-----------------------------------------------------------------------
        const listAdoptionsService = createListAdoptionsService({
            scope: this,
            id: 'list-adoptions-service',
            cluster: ecsPetListAdoptionCluster,
            logGroupName: "/ecs/PetListAdoptions",
            cpu: 1024,
            memoryLimitMiB: 2048,
            healthCheck: '/health/status',
            instrumentation: 'otel',
            enableSSM: true,
            databaseSecret: rdsSecret,
            desiredTaskCount: 2,
            region: region,
            securityGroup: ecsServicesSecurityGroup
        });

        listAdoptionsService.taskDefinition.taskRole?.addToPrincipalPolicy(readSSMParamsPolicy);

        /*
        const ecsPetSearchCluster = new ecs.Cluster(this, "PetSearch", {
            vpc: theVPC,
            containerInsights: true
        });
        // PetSearch service definitions-----------------------------------------------------------------------
        const searchService = new SearchService(this, 'search-service', {
            cluster: ecsPetSearchCluster,
            logGroupName: "/ecs/PetSearch",
            cpu: 1024,
            memoryLimitMiB: 2048,
            //repositoryURI: repositoryURI,
            healthCheck: '/health/status',
            desiredTaskCount: 2,
            instrumentation: 'otel',
            region: region,
            securityGroup: ecsServicesSecurityGroup
        })
        searchService.taskDefinition.taskRole?.addToPrincipalPolicy(readSSMParamsPolicy);
         
        */

        // PetSearch service Ec2 definitions-----------------------------------------------------------------------
        const ecsEc2PetSearchCluster = new ecs.Cluster(this, "PetSearchEc2", {
            vpc: theVPC,
            containerInsights: true,
        });
        // Replacing with addAsgCapacityProvider as per best practice
        // ecsEc2PetSearchCluster.addCapacity('PetSearchEc2', {
        //     instanceType: new ec2.InstanceType('m5.large'),
        //     desiredCapacity: 2,
        // });

        const ecsEc2PetSearchRole = new iam.Role(this, 'ecsEc2PetSearchRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        });

        ecsEc2PetSearchRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

        const ecsEc2PetSearchlaunchTemplate = new ec2.LaunchTemplate(this, 'ecsEc2PetSearchLaunchTemplate', {
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
            instanceType: new ec2.InstanceType('m5.xlarge'),
            userData: ec2.UserData.forLinux(),
            role: ecsEc2PetSearchRole,
        });

        const ecsEc2PetSearchAutoScalingGroup = new asg.AutoScalingGroup(this, 'ecsEc2PetSearchASG', {
            vpc: theVPC,
            minCapacity: 2,
            maxCapacity: 2,
            desiredCapacity: 2,
            launchTemplate: ecsEc2PetSearchlaunchTemplate,
        });

        const ecsEc2PetSearchCapacityProvider = new ecs.AsgCapacityProvider(this, 'PetSearchAsgCapacityProvider', {
            autoScalingGroup: ecsEc2PetSearchAutoScalingGroup,
            enableManagedScaling: true,
            enableManagedTerminationProtection: false,
        });

        ecsEc2PetSearchCluster.addAsgCapacityProvider(ecsEc2PetSearchCapacityProvider)


        const searchServiceEc2 = new SearchEc2Service(this, 'search-service-ec2', {
            cluster: ecsEc2PetSearchCluster,
            logGroupName: "/ecs/PetSearchEc2",
            cpu: 1024,
            memoryLimitMiB: 2048,
            //repositoryURI: repositoryURI,
            healthCheck: '/health/status',
            desiredTaskCount: 2,
            instrumentation: 'otel',
            region: region,
            securityGroup: ecsServicesSecurityGroup
        })
        searchServiceEc2.taskDefinition.taskRole?.addToPrincipalPolicy(readSSMParamsPolicy);

        // Traffic Generator task definition.
        const trafficGeneratorService = new TrafficGeneratorService(this, 'traffic-generator-service', {
            cluster: ecsPetListAdoptionCluster,
            logGroupName: "/ecs/PetTrafficGenerator",
            cpu: 512,
            memoryLimitMiB: 1024,
            enableSSM: false,
            //repositoryURI: repositoryURI,
            desiredTaskCount: 1,
            region: region,
            securityGroup: ecsServicesSecurityGroup
        })
        trafficGeneratorService.taskDefinition.taskRole?.addToPrincipalPolicy(readSSMParamsPolicy);

        //PetStatusUpdater Lambda Function and APIGW--------------------------------------
        const statusUpdaterService = new StatusUpdaterService(this, 'status-updater-service', {
            region: region,
            tableName: dynamoDBTableName,
            fisResourceTag: fisResourceTag,
            fisLambdaExecWrapper:fisLambdaExecWrapper,
            fisExtensionMetrics:fisExtensionMetrics,
            fisLambdaExtensionArn:fisLambdaExtensionArn
        });

        const albSG = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
            vpc: theVPC,
            securityGroupName: 'ALBSecurityGroup',
            allowAllOutbound: true
        });
        albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

        // PetSite - Create ALB and Target Groups
        const alb = new elbv2.ApplicationLoadBalancer(this, 'PetSiteLoadBalancer', {
            vpc: theVPC,
            internetFacing: true,
            securityGroup: albSG
        });
        trafficGeneratorService.node.addDependency(alb);

        const targetGroup = new elbv2.ApplicationTargetGroup(this, 'PetSiteTargetGroup', {
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            vpc: theVPC,
            targetType: elbv2.TargetType.IP

        });

        new ssm.StringParameter(this, "putParamTargetGroupArn", {
            stringValue: targetGroup.targetGroupArn,
            parameterName: '/eks/petsite/TargetGroupArn'
        })

        const listener = alb.addListener('Listener', {
            port: 80,
            open: true,
            defaultTargetGroups: [targetGroup],
        });

        // PetAdoptionHistory - attach service to path /petadoptionhistory on PetSite ALB
        const petadoptionshistory_targetGroup = new elbv2.ApplicationTargetGroup(this, 'PetAdoptionsHistoryTargetGroup', {
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            vpc: theVPC,
            targetType: elbv2.TargetType.IP,
            healthCheck: {
                path: '/health/status',
            }
        });

        listener.addTargetGroups('PetAdoptionsHistoryTargetGroups', {
            priority: 10,
            conditions: [
                elbv2.ListenerCondition.pathPatterns(['/petadoptionshistory/*']),
            ],
            targetGroups: [petadoptionshistory_targetGroup]
        });

        new ssm.StringParameter(this, "putPetHistoryParamTargetGroupArn", {
            stringValue: petadoptionshistory_targetGroup.targetGroupArn,
            parameterName: '/eks/pethistory/TargetGroupArn'
        });

        // PetSite - EKS Cluster
        const clusterAdmin = new iam.Role(this, 'AdminRole', {
            assumedBy: new iam.AccountRootPrincipal()
        });

        new ssm.StringParameter(this, "putParam", {
            stringValue: clusterAdmin.roleArn,
            parameterName: '/eks/petsite/EKSMasterRoleArn'
        })

        const secretsKey = new kms.Key(this, 'SecretsKey');

        const cluster = new eks.Cluster(this, 'petsite', {
            clusterName: 'PetSite',
            mastersRole: clusterAdmin,
            vpc: theVPC,
            defaultCapacity: 0,
            // defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
            secretsEncryptionKey: secretsKey,
            version: KubernetesVersion.of('1.31'),
            kubectlLayer: new KubectlLayer(this, 'kubectl')
        });

        const eksOptimizedImage = new eks.EksOptimizedImage(/* all optional props */ {
            cpuArch: eks.CpuArch.X86_64,
            kubernetesVersion: '1.31',
            nodeType: eks.NodeType.STANDARD,
        });

        const userData = ec2.UserData.forLinux();
        userData.addCommands(`/etc/eks/bootstrap.sh ${cluster.clusterName} --node-labels AzImpairmentPower=Ready,foo=bar,goo=far`);

        const eksPetSitelt = new ec2.LaunchTemplate(this, 'eksPetSitelt', {
            machineImage: eksOptimizedImage,
            instanceType: new ec2.InstanceType('m5.xlarge'),
            userData: userData,
            //   role: eksPetSiteRole,
        });

        // Adding ClusterNodeGroupRole
        // Add SSM Permissions to the node role and EKS Node required permissions
        let eksPNodeGroupRoleName
        if (isPrimaryRegionDeployment) {
            eksPNodeGroupRoleName = 'eksPetsiteASGClusterNodeGroupRole'
        } else {
            eksPNodeGroupRoleName = 'eksPetsiteASGClusterNodeGroupRole' + props.DeploymentType
        }



        const eksPetsiteASGClusterNodeGroupRole = new iam.Role(this, eksPNodeGroupRoleName, {
            roleName: eksPNodeGroupRoleName,
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'),
            ],
        });
        // Loading evidently policy
        const policyName = 'evidently'; // Adjust the policy name as needed
        const policyDocument = iam.PolicyDocument.fromJson(require('../../../petfood/policy.json'));

        // Attach inline IAM policy to the role
        eksPetsiteASGClusterNodeGroupRole.attachInlinePolicy(new iam.Policy(this, 'EksPetsiteASGInlinePolicy', {
            policyName: policyName,
            document: policyDocument
        }));

        // Create nodeGroup properties
        const eksPetSiteNodegroupProps = {
            cluster: cluster,
            launchTemplateSpec: {
                id: eksPetSitelt.launchTemplateId!,
                version: eksPetSitelt.latestVersionNumber,
            },
            labels: {
                ["AzImpairmentPower"]: "Ready",
            },
            desiredSize: 2,
            maxSize: 2,
            tags: {
                ["AzImpairmentPower"]: "Ready",
            },
            nodeRole: eksPetsiteASGClusterNodeGroupRole,
        };

        // Adding Node Group
        const eksPetsiteASGClusterNodeGroup = new eks.Nodegroup(this, 'eksPetsiteASGClusterNodeGroup', eksPetSiteNodegroupProps);

        // Tagging  Node Group resources https://classic.yarnpkg.com/en/package/eks-nodegroup-asg-tags-cdk
        new NodegroupAsgTags(this, 'petSiteNodeGroupAsgTags', {
            cluster: cluster,
            nodegroup: eksPetsiteASGClusterNodeGroup,
            nodegroupProps: eksPetSiteNodegroupProps,
            setClusterAutoscalerTagsForNodeLabels: true,
            setClusterAutoscalerTagsForNodeTaints: true,
            tags: {
                'AzImpairmentPower': 'Ready',
            },
        });

        const clusterSG = ec2.SecurityGroup.fromSecurityGroupId(this, 'ClusterSG', cluster.clusterSecurityGroupId);
        clusterSG.addIngressRule(albSG, ec2.Port.allTraffic(), 'Allow traffic from the ALB');
        clusterSG.addIngressRule(ec2.Peer.ipv4(theVPC.vpcCidrBlock), ec2.Port.tcp(443), 'Allow local access to k8s api');


        // From https://github.com/aws-samples/ssm-agent-daemonset-installer
        var ssmAgentSetup = yaml.loadAll(readFileSync("./resources/setup-ssm-agent.yaml", "utf8")) as Record<string, any>[];

        const ssmAgentSetupManifest = new eks.KubernetesManifest(this, "ssmAgentdeployment", {
            cluster: cluster,
            manifest: ssmAgentSetup
        });



        // ClusterID is not available for creating the proper conditions https://github.com/aws/aws-cdk/issues/10347
        const clusterId = Fn.select(4, Fn.split('/', cluster.clusterOpenIdConnectIssuerUrl)) // Remove https:// from the URL as workaround to get ClusterID

        const cw_federatedPrincipal = new iam.FederatedPrincipal(
            cluster.openIdConnectProvider.openIdConnectProviderArn,
            {
                StringEquals: new CfnJson(this, "CW_FederatedPrincipalCondition", {
                    value: {
                        [`oidc.eks.${region}.amazonaws.com/id/${clusterId}:aud`]: "sts.amazonaws.com"
                    }
                })
            }
        );
        const cw_trustRelationship = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [cw_federatedPrincipal],
            actions: ["sts:AssumeRoleWithWebIdentity"]
        });

        // Create IAM roles for Service Accounts
        // Cloudwatch Agent SA
        const cwserviceaccount = new iam.Role(this, 'CWServiceAccount', {
            //                assumedBy: eksFederatedPrincipal,
            assumedBy: new iam.AccountRootPrincipal(),
            managedPolicies: [
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'CWServiceAccount-CloudWatchAgentServerPolicy', 'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy')
            ],
        });
        cwserviceaccount.assumeRolePolicy?.addStatements(cw_trustRelationship);

        const xray_federatedPrincipal = new iam.FederatedPrincipal(
            cluster.openIdConnectProvider.openIdConnectProviderArn,
            {
                StringEquals: new CfnJson(this, "Xray_FederatedPrincipalCondition", {
                    value: {
                        [`oidc.eks.${region}.amazonaws.com/id/${clusterId}:aud`]: "sts.amazonaws.com"
                    }
                })
            }
        );
        const xray_trustRelationship = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [xray_federatedPrincipal],
            actions: ["sts:AssumeRoleWithWebIdentity"]
        });

        // X-Ray Agent SA
        const xrayserviceaccount = new iam.Role(this, 'XRayServiceAccount', {
            //                assumedBy: eksFederatedPrincipal,
            assumedBy: new iam.AccountRootPrincipal(),
            managedPolicies: [
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'XRayServiceAccount-AWSXRayDaemonWriteAccess', 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess')
            ],
        });
        xrayserviceaccount.assumeRolePolicy?.addStatements(xray_trustRelationship);

        const loadbalancer_federatedPrincipal = new iam.FederatedPrincipal(
            cluster.openIdConnectProvider.openIdConnectProviderArn,
            {
                StringEquals: new CfnJson(this, "LB_FederatedPrincipalCondition", {
                    value: {
                        [`oidc.eks.${region}.amazonaws.com/id/${clusterId}:aud`]: "sts.amazonaws.com"
                    }
                })
            }
        );
        const loadBalancer_trustRelationship = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [loadbalancer_federatedPrincipal],
            actions: ["sts:AssumeRoleWithWebIdentity"]
        });

        const loadBalancerPolicyDoc = iam.PolicyDocument.fromJson(JSON.parse(readFileSync("./resources/load_balancer/iam_policy.json", "utf8")));
        const loadBalancerPolicy = new iam.ManagedPolicy(this, 'LoadBalancerSAPolicy', { document: loadBalancerPolicyDoc });
        const loadBalancerserviceaccount = new iam.Role(this, 'LoadBalancerServiceAccount', {
            //                assumedBy: eksFederatedPrincipal,
            assumedBy: new iam.AccountRootPrincipal(),
            managedPolicies: [loadBalancerPolicy]
        });

        loadBalancerserviceaccount.assumeRolePolicy?.addStatements(loadBalancer_trustRelationship);

        // Fix for EKS Dashboard access

        const dashboardRoleYaml = yaml.loadAll(readFileSync("./resources/dashboard.yaml", "utf8")) as Record<string, any>[];

        const dashboardRoleArn = this.node.tryGetContext('dashboard_role_arn');
        if ((dashboardRoleArn != undefined) && (dashboardRoleArn.length > 0)) {
            const role = iam.Role.fromRoleArn(this, "DashboardRoleArn", dashboardRoleArn, { mutable: false });
            cluster.awsAuth.addRoleMapping(role, { groups: ["dashboard-view"] });
        }

        if (isEventEngine === 'true') {
            const teamRole = iam.Role.fromRoleArn(this, 'TeamRole', "arn:aws:iam::" + stack.account + ":role/WSParticipantRole");
            cluster.awsAuth.addRoleMapping(teamRole, { groups: ["dashboard-view"] });

            const ssmC9role = new SSMParameterReader(this, 'ssmC9role', {
                parameterName: "/cloud9/c9iamrolearn",
                region: props.MainRegion
            });
            const c9role = ssmC9role.getParameterValue();

            if (c9role != undefined) {
                cluster.awsAuth.addMastersRole(iam.Role.fromRoleArn(this, 'c9role', c9role, { mutable: false }));
            }


        }

        const eksAdminArn = this.node.tryGetContext('admin_role');
        let EKS_ADMIN_ARN = '';
        if ((eksAdminArn != undefined) && (eksAdminArn.length > 0)) {
            const role = iam.Role.fromRoleArn(this, "ekdAdminRoleArn", eksAdminArn, { mutable: false });
            cluster.awsAuth.addMastersRole(role);
            EKS_ADMIN_ARN = eksAdminArn;
        }

        const dahshboardManifest = new eks.KubernetesManifest(this, "k8sdashboardrbac", {
            cluster: cluster,
            manifest: dashboardRoleYaml
        });


        var xRayYaml = yaml.loadAll(readFileSync("./resources/k8s_petsite/xray-daemon-config.yaml", "utf8")) as Record<string, any>[];

        xRayYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = new CfnJson(this, "xray_Role", { value: `${xrayserviceaccount.roleArn}` });

        const xrayManifest = new eks.KubernetesManifest(this, "xraydeployment", {
            cluster: cluster,
            manifest: xRayYaml
        });

        var loadBalancerServiceAccountYaml = yaml.loadAll(readFileSync("./resources/load_balancer/service_account.yaml", "utf8")) as Record<string, any>[];
        loadBalancerServiceAccountYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = new CfnJson(this, "loadBalancer_Role", { value: `${loadBalancerserviceaccount.roleArn}` });

        const loadBalancerServiceAccount = new eks.KubernetesManifest(this, "loadBalancerServiceAccount", {
            cluster: cluster,
            manifest: loadBalancerServiceAccountYaml
        });

        const waitForLBServiceAccount = new eks.KubernetesObjectValue(this, 'LBServiceAccount', {
            cluster: cluster,
            objectName: "alb-ingress-controller",
            objectType: "serviceaccount",
            objectNamespace: "kube-system",
            jsonPath: "@"
        });

        const loadBalancerCRDYaml = yaml.loadAll(readFileSync("./resources/load_balancer/crds.yaml", "utf8")) as Record<string, any>[];
        const loadBalancerCRDManifest = new eks.KubernetesManifest(this, "loadBalancerCRD", {
            cluster: cluster,
            manifest: loadBalancerCRDYaml
        });


        const awsLoadBalancerManifest = new eks.HelmChart(this, "AWSLoadBalancerController", {
            cluster: cluster,
            chart: "aws-load-balancer-controller",
            repository: "https://aws.github.io/eks-charts",
            namespace: "kube-system",
            values: {
                clusterName: "PetSite",
                serviceAccount: {
                    create: false,
                    name: "alb-ingress-controller"
                },
                wait: true
            }
        });
        awsLoadBalancerManifest.node.addDependency(loadBalancerCRDManifest);
        awsLoadBalancerManifest.node.addDependency(loadBalancerServiceAccount);
        awsLoadBalancerManifest.node.addDependency(waitForLBServiceAccount);

        // NOTE: amazon-cloudwatch namespace is created here!!
        var fluentbitYaml = yaml.loadAll(readFileSync("./resources/cwagent-fluent-bit-quickstart.yaml", "utf8")) as Record<string, any>[];
        fluentbitYaml[1].metadata.annotations["eks.amazonaws.com/role-arn"] = new CfnJson(this, "fluentbit_Role", { value: `${cwserviceaccount.roleArn}` });

        fluentbitYaml[4].data["cwagentconfig.json"] = JSON.stringify({
            agent: {
                region: region
            },
            logs: {
                metrics_collected: {
                    kubernetes: {
                        cluster_name: "PetSite",
                        metrics_collection_interval: 60
                    }
                },
                force_flush_interval: 5

            }

        });

        fluentbitYaml[6].data["cluster.name"] = "PetSite";
        fluentbitYaml[6].data["logs.region"] = region;
        fluentbitYaml[7].metadata.annotations["eks.amazonaws.com/role-arn"] = new CfnJson(this, "cloudwatch_Role", { value: `${cwserviceaccount.roleArn}` });

        // The `cluster-info` configmap is used by the current Python implementation for the `AwsEksResourceDetector`
        fluentbitYaml[12].data["cluster.name"] = "PetSite";
        fluentbitYaml[12].data["logs.region"] = region;

        const fluentbitManifest = new eks.KubernetesManifest(this, "cloudwatcheployment", {
            cluster: cluster,
            manifest: fluentbitYaml
        });

        // CloudWatch agent for prometheus metrics
        var prometheusYaml = yaml.loadAll(readFileSync("./resources/prometheus-eks.yaml", "utf8")) as Record<string, any>[];

        prometheusYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = new CfnJson(this, "prometheus_Role", { value: `${cwserviceaccount.roleArn}` });

        const prometheusManifest = new eks.KubernetesManifest(this, "prometheusdeployment", {
            cluster: cluster,
            manifest: prometheusYaml
        });

        prometheusManifest.node.addDependency(fluentbitManifest); // Namespace creation dependency


        var dashboardBody = readFileSync("./resources/cw_dashboard_fluent_bit.json", "utf-8");
        dashboardBody = dashboardBody.replaceAll("{{YOUR_CLUSTER_NAME}}", "PetSite");
        dashboardBody = dashboardBody.replaceAll("{{YOUR_AWS_REGION}}", region);
        
        
        let fluentBitDashboardName

        if (isPrimaryRegionDeployment) {
            fluentBitDashboardName = 'EKS_FluentBit_Dashboard'
        } else {
            fluentBitDashboardName = 'EKS_FluentBit_Dashboard' + props.DeploymentType
        }

        const fluentBitDashboard = new cloudwatch.CfnDashboard(this, fluentBitDashboardName, {
            dashboardName: fluentBitDashboardName,
            dashboardBody: dashboardBody
        });

        const customWidgetResourceControllerPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ecs:ListServices',
                'ecs:UpdateService',
                'eks:DescribeNodegroup',
                'eks:ListNodegroups',
                'eks:DescribeUpdate',
                'eks:UpdateNodegroupConfig',
                'ecs:DescribeServices',
                'eks:DescribeCluster',
                'eks:ListClusters',
                'ecs:ListClusters'
            ],
            resources: ['*']
        });
        var customWidgetLambdaRole = new iam.Role(this, 'customWidgetLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });
        customWidgetLambdaRole.addToPrincipalPolicy(customWidgetResourceControllerPolicy);

        var petsiteApplicationResourceController = new lambda.Function(this, 'petsite-application-resource-controler', {
            code: lambda.Code.fromAsset(path.join(__dirname, '/../resources/resource-controller-widget')),
            handler: 'petsite-application-resource-controler.lambda_handler',
            memorySize: 128,
            runtime: lambda.Runtime.PYTHON_3_9,
            role: customWidgetLambdaRole,
            timeout: Duration.minutes(10)
        });
        petsiteApplicationResourceController.addEnvironment("EKS_CLUSTER_NAME", cluster.clusterName);
        /*
        petsiteApplicationResourceController.addEnvironment("ECS_CLUSTER_ARNS", ecsPayForAdoptionCluster.clusterArn + "," +
            ecsPetListAdoptionCluster.clusterArn + "," + ecsPetSearchCluster.clusterArn);
        */
        petsiteApplicationResourceController.addEnvironment("ECS_CLUSTER_ARNS", ecsPayForAdoptionCluster.clusterArn + "," +
            ecsPetListAdoptionCluster.clusterArn + "," + ecsEc2PetSearchCluster.clusterArn);

        var customWidgetFunction = new lambda.Function(this, 'cloudwatch-custom-widget', {
            code: lambda.Code.fromAsset(path.join(__dirname, '/../resources/resource-controller-widget')),
            handler: 'cloudwatch-custom-widget.lambda_handler',
            memorySize: 128,
            runtime: lambda.Runtime.PYTHON_3_9,
            role: customWidgetLambdaRole,
            timeout: Duration.seconds(60)
        });
        customWidgetFunction.addEnvironment("CONTROLER_LAMBDA_ARN", petsiteApplicationResourceController.functionArn);
        customWidgetFunction.addEnvironment("EKS_CLUSTER_NAME", cluster.clusterName);
        /*
        customWidgetFunction.addEnvironment("ECS_CLUSTER_ARNS", ecsPayForAdoptionCluster.clusterArn + "," +
            ecsPetListAdoptionCluster.clusterArn + "," + ecsPetSearchCluster.clusterArn);
        */
        customWidgetFunction.addEnvironment("ECS_CLUSTER_ARNS", ecsPayForAdoptionCluster.clusterArn + "," +
            ecsPetListAdoptionCluster.clusterArn + "," + ecsEc2PetSearchCluster.clusterArn);

        var costControlDashboardBody = readFileSync("./resources/cw_dashboard_cost_control.json", "utf-8");
        costControlDashboardBody = costControlDashboardBody.replaceAll("{{YOUR_LAMBDA_ARN}}", customWidgetFunction.functionArn);

        let petSiteCostControlDashboardName

        if (isPrimaryRegionDeployment) {
            petSiteCostControlDashboardName = 'PetSite_Cost_Control_Dashboard'
        } else {
            petSiteCostControlDashboardName = 'PetSite_Cost_Control_Dashboard' + props.DeploymentType
        }

        const petSiteCostControlDashboard = new cloudwatch.CfnDashboard(this, petSiteCostControlDashboardName, {
            dashboardName: petSiteCostControlDashboardName,
            dashboardBody: costControlDashboardBody
        });


        this.createOuputs(new Map(Object.entries({
            'CWServiceAccountArn': cwserviceaccount.roleArn,
            'EKS_ADMIN_ARN': EKS_ADMIN_ARN,
            'XRayServiceAccountArn': xrayserviceaccount.roleArn,
            'OIDCProviderUrl': cluster.clusterOpenIdConnectIssuerUrl,
            'OIDCProviderArn': cluster.openIdConnectProvider.openIdConnectProviderArn,
            'PetSiteUrl': `http://${alb.loadBalancerDnsName}`
        })));


        const petAdoptionsStepFn = new PetAdoptionsStepFn(this, 'StepFn', {
            env: {
                account: props.env?.account,
                region: region
            }
        });

        this.createSsmParameters(new Map(Object.entries({
            '/petstore/trafficdelaytime': "1",
            '/petstore/rumscript': " ",
            '/petstore/petadoptionsstepfnarn': petAdoptionsStepFn.stepFn.stateMachineArn,
            '/petstore/updateadoptionstatusurl': statusUpdaterService.api.url,
            '/petstore/queueurl': sqsQueue.queueUrl,
            '/petstore/snsarn': topic_petadoption.topicArn,
            '/petstore/dynamodbtablename': dynamoDBTableName,
            '/petstore/s3bucketname': s3_observabilitypetadoptions.s3Bucket.bucketName,
            '/petstore/s3bucketarn': s3_observabilitypetadoptions.s3Bucket.bucketArn,
            '/petstore/s3iamroleresplication': s3_observabilitypetadoptions.s3IAMReplicationRole.roleArn,
            '/petstore/searchapiurl': `http://${searchServiceEc2.service.loadBalancer.loadBalancerDnsName}/api/search?`,
            '/petstore/searchimage': searchServiceEc2.container.imageName,
            '/petstore/petlistadoptionsurl': `http://${listAdoptionsService.service.loadBalancer.loadBalancerDnsName}/api/adoptionlist/`,
            '/petstore/petlistadoptionsmetricsurl': `http://${listAdoptionsService.service.loadBalancer.loadBalancerDnsName}/metrics`,
            '/petstore/paymentapiurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/api/home/completeadoption`,
            '/petstore/payforadoptionmetricsurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/metrics`,
            '/petstore/cleanupadoptionsurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/api/home/cleanupadoptions`,
            '/petstore/petsearch-collector-manual-config': readFileSync("./resources/collector/ecs-xray-manual.yaml", "utf8"),
            '/petstore/rdssecretarn': `${rdsSecret.secretArn}`,
            '/petstore/rdssecretname': `${rdsSecret.secretName}`,
            '/petstore/rdsendpoint': rdsEndpoint,
            '/petstore/stackname': stackName,
            '/petstore/tgwid': `${VPCwitTGW.transitGateway?.attrId}`,
            '/petstore/tgwroutetableid': `${transitGatewayRouteTable?.ref}`,
            // '/petstore/tgwassociationDefaultRouteTableId': `${VPCwitTGW.transitGateway?.associationDefaultRouteTableId}`,
            // '/petstore/tgwpropagationDefaultRouteTableId': `${VPCwitTGW.transitGateway?.propagationDefaultRouteTableId}`,
            '/petstore/vpcid': `${VPCwitTGW.vpc.vpcId}`,
            '/petstore/vpccidr': `${VPCwitTGW.vpc.vpcCidrBlock}`,
            '/petstore/petsiteurl': `http://${alb.loadBalancerDnsName}`,
            '/petstore/pethistoryurl': `http://${alb.loadBalancerDnsName}/petadoptionshistory`,
            '/eks/petsite/OIDCProviderUrl': cluster.clusterOpenIdConnectIssuerUrl,
            '/eks/petsite/OIDCProviderArn': cluster.openIdConnectProvider.openIdConnectProviderArn,
            '/petstore/errormode1': "false"
        })));

        this.createOuputs(new Map(Object.entries({
            'QueueURL': sqsQueue.queueUrl,
            'UpdateAdoptionStatusurl': statusUpdaterService.api.url,
            'SNSTopicARN': topic_petadoption.topicArn,
            'RDSServerName': rdsEndpoint
        })));
    }

    private createSsmParameters(params: Map<string, string>) {
        params.forEach((value, key) => {
            //const id = key.replace('/', '_');
            new ssm.StringParameter(this, key, { parameterName: key, stringValue: value });
        });
    }

    private createOuputs(params: Map<string, string>) {
        params.forEach((value, key) => {
            new CfnOutput(this, key, { value: value })
        });
    }
}
