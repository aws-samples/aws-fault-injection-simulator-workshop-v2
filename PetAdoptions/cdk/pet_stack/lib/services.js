"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Services = void 0;
const iam = require("aws-cdk-lib/aws-iam");
const ec2 = require("aws-cdk-lib/aws-ec2");
const asg = require("aws-cdk-lib/aws-autoscaling");
const ecs = require("aws-cdk-lib/aws-ecs");
const sns = require("aws-cdk-lib/aws-sns");
const sqs = require("aws-cdk-lib/aws-sqs");
const subs = require("aws-cdk-lib/aws-sns-subscriptions");
const ddb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const s3seeder = require("aws-cdk-lib/aws-s3-deployment");
const rds = require("aws-cdk-lib/aws-rds");
const ssm = require("aws-cdk-lib/aws-ssm");
const kms = require("aws-cdk-lib/aws-kms");
const eks = require("aws-cdk-lib/aws-eks");
const yaml = require("js-yaml");
const path = require("path");
const lambda = require("aws-cdk-lib/aws-lambda");
const elbv2 = require("aws-cdk-lib/aws-elasticloadbalancingv2");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const pay_for_adoption_service_1 = require("./services/pay-for-adoption-service");
const list_adoptions_service_1 = require("./services/list-adoptions-service");
const search_service_ec2_1 = require("./services/search-service-ec2");
const traffic_generator_service_1 = require("./services/traffic-generator-service");
const status_updater_service_1 = require("./services/status-updater-service");
const stepfn_1 = require("./services/stepfn");
const aws_eks_1 = require("aws-cdk-lib/aws-eks");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const fs_1 = require("fs");
require("ts-replace-all");
const aws_cloudwatch_1 = require("aws-cdk-lib/aws-cloudwatch");
const lambda_layer_kubectl_1 = require("aws-cdk-lib/lambda-layer-kubectl");
const cloud9_1 = require("./modules/core/cloud9");
const eks_nodegroup_asg_tags_cdk_1 = require("eks-nodegroup-asg-tags-cdk");
class Services extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        super(scope, id, props);
        var isEventEngine = 'false';
        if (this.node.tryGetContext('is_event_engine') != undefined) {
            isEventEngine = this.node.tryGetContext('is_event_engine');
        }
        const stackName = id;
        // Create SQS resource to send Pet adoption messages to
        const sqsQueue = new sqs.Queue(this, 'sqs_petadoption', {
            visibilityTimeout: aws_cdk_lib_1.Duration.seconds(300)
        });
        // Create SNS and an email topic to send notifications to
        const topic_petadoption = new sns.Topic(this, 'topic_petadoption');
        var topic_email = this.node.tryGetContext('snstopic_email');
        if (topic_email == undefined) {
            topic_email = "someone@example.com";
        }
        topic_petadoption.addSubscription(new subs.EmailSubscription(topic_email));
        // Creates an S3 bucket to store pet images
        const s3_observabilitypetadoptions = new s3.Bucket(this, 's3bucket_petadoption', {
            publicReadAccess: false,
            autoDeleteObjects: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // Creates the DynamoDB table for Petadoption data
        const dynamodb_petadoption = new ddb.Table(this, 'ddb_petadoption', {
            partitionKey: {
                name: 'pettype',
                type: ddb.AttributeType.STRING
            },
            sortKey: {
                name: 'petid',
                type: ddb.AttributeType.STRING
            },
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            billingMode: ddb.BillingMode.PAY_PER_REQUEST,
        });
        dynamodb_petadoption.metric('WriteThrottleEvents', { statistic: "avg" }).createAlarm(this, 'WriteThrottleEvents-BasicAlarm', {
            threshold: 0,
            treatMissingData: aws_cloudwatch_1.TreatMissingData.NOT_BREACHING,
            comparisonOperator: aws_cloudwatch_1.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            alarmName: `${dynamodb_petadoption.tableName}-WriteThrottleEvents-BasicAlarm`,
        });
        dynamodb_petadoption.metric('ReadThrottleEvents', { statistic: "avg" }).createAlarm(this, 'ReadThrottleEvents-BasicAlarm', {
            threshold: 0,
            treatMissingData: aws_cloudwatch_1.TreatMissingData.NOT_BREACHING,
            comparisonOperator: aws_cloudwatch_1.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            alarmName: `${dynamodb_petadoption.tableName}-ReadThrottleEvents-BasicAlarm`,
        });
        // Seeds the S3 bucket with pet images
        new s3seeder.BucketDeployment(this, "s3seeder_petadoption", {
            destinationBucket: s3_observabilitypetadoptions,
            sources: [s3seeder.Source.asset('./resources/kitten.zip'), s3seeder.Source.asset('./resources/puppies.zip'), s3seeder.Source.asset('./resources/bunnies.zip')]
        });
        var cidrRange = this.node.tryGetContext('vpc_cidr');
        if (cidrRange == undefined) {
            cidrRange = "11.0.0.0/16";
        }
        // The VPC where all the microservices will be deployed into
        const theVPC = new ec2.Vpc(this, 'Microservices', {
            ipAddresses: ec2.IpAddresses.cidr(cidrRange),
            // cidr: cidrRange,
            natGateways: 1,
            maxAzs: 2,
        });
        // Adding tags to the VPC for AzImpairmentPower
        //cdk.Tags.of(theVPC).add('AzImpairmentPower', 'DisruptSubnet');
        // Create RDS Aurora PG cluster
        const rdssecuritygroup = new ec2.SecurityGroup(this, 'petadoptionsrdsSG', {
            vpc: theVPC
        });
        rdssecuritygroup.addIngressRule(ec2.Peer.ipv4(theVPC.vpcCidrBlock), ec2.Port.tcp(5432), 'Allow Aurora PG access from within the VPC CIDR range');
        var rdsUsername = this.node.tryGetContext('rdsusername');
        if (rdsUsername == undefined) {
            rdsUsername = "petadmin";
        }
        const auroraCluster = new rds.DatabaseCluster(this, 'Database', {
            engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_13_9 }),
            writer: rds.ClusterInstance.provisioned('writer', {
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE4),
            }),
            readers: [
                rds.ClusterInstance.provisioned('reader', {
                    instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE4),
                }),
            ],
            parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql13'),
            vpc: theVPC,
            securityGroups: [rdssecuritygroup],
            defaultDatabaseName: 'adoptions'
            // scaling: {
            //     autoPause: Duration.minutes(60),
            //     minCapacity: rds.AuroraCapacityUnit.ACU_2,
            //     maxCapacity: rds.AuroraCapacityUnit.ACU_8,
            // }
        });
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
        const stack = aws_cdk_lib_1.Stack.of(this);
        const region = stack.region;
        const ecsServicesSecurityGroup = new ec2.SecurityGroup(this, 'ECSServicesSG', {
            vpc: theVPC
        });
        ecsServicesSecurityGroup.addIngressRule(ec2.Peer.ipv4(theVPC.vpcCidrBlock), ec2.Port.tcp(80));
        const ecsPayForAdoptionCluster = new ecs.Cluster(this, "PayForAdoption", {
            vpc: theVPC,
            containerInsights: true
        });
        // PayForAdoption service definitions-----------------------------------------------------------------------
        const payForAdoptionService = new pay_for_adoption_service_1.PayForAdoptionService(this, 'pay-for-adoption-service', {
            cluster: ecsPayForAdoptionCluster,
            logGroupName: "/ecs/PayForAdoption",
            cpu: 1024,
            memoryLimitMiB: 2048,
            healthCheck: '/health/status',
            enableSSM: true,
            // build locally
            //repositoryURI: repositoryURI,
            database: auroraCluster,
            desiredTaskCount: 2,
            region: region,
            securityGroup: ecsServicesSecurityGroup
        });
        (_a = payForAdoptionService.taskDefinition.taskRole) === null || _a === void 0 ? void 0 : _a.addToPrincipalPolicy(readSSMParamsPolicy);
        (_b = payForAdoptionService.taskDefinition.taskRole) === null || _b === void 0 ? void 0 : _b.addToPrincipalPolicy(ddbSeedPolicy);
        const ecsPetListAdoptionCluster = new ecs.Cluster(this, "PetListAdoptions", {
            vpc: theVPC,
            containerInsights: true
        });
        // PetListAdoptions service definitions-----------------------------------------------------------------------
        const listAdoptionsService = new list_adoptions_service_1.ListAdoptionsService(this, 'list-adoptions-service', {
            cluster: ecsPetListAdoptionCluster,
            logGroupName: "/ecs/PetListAdoptions",
            cpu: 1024,
            memoryLimitMiB: 2048,
            healthCheck: '/health/status',
            instrumentation: 'otel',
            enableSSM: true,
            // build locally
            //repositoryURI: repositoryURI,
            database: auroraCluster,
            desiredTaskCount: 2,
            region: region,
            securityGroup: ecsServicesSecurityGroup
        });
        (_c = listAdoptionsService.taskDefinition.taskRole) === null || _c === void 0 ? void 0 : _c.addToPrincipalPolicy(readSSMParamsPolicy);
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
            enableManagedTerminationProtection: false,
        });
        ecsEc2PetSearchCluster.addAsgCapacityProvider(ecsEc2PetSearchCapacityProvider);
        const searchServiceEc2 = new search_service_ec2_1.SearchEc2Service(this, 'search-service-ec2', {
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
        });
        (_d = searchServiceEc2.taskDefinition.taskRole) === null || _d === void 0 ? void 0 : _d.addToPrincipalPolicy(readSSMParamsPolicy);
        // Traffic Generator task definition.
        const trafficGeneratorService = new traffic_generator_service_1.TrafficGeneratorService(this, 'traffic-generator-service', {
            cluster: ecsPetListAdoptionCluster,
            logGroupName: "/ecs/PetTrafficGenerator",
            cpu: 512,
            memoryLimitMiB: 1024,
            enableSSM: false,
            //repositoryURI: repositoryURI,
            desiredTaskCount: 1,
            region: region,
            securityGroup: ecsServicesSecurityGroup
        });
        (_e = trafficGeneratorService.taskDefinition.taskRole) === null || _e === void 0 ? void 0 : _e.addToPrincipalPolicy(readSSMParamsPolicy);
        //PetStatusUpdater Lambda Function and APIGW--------------------------------------
        const statusUpdaterService = new status_updater_service_1.StatusUpdaterService(this, 'status-updater-service', {
            tableName: dynamodb_petadoption.tableName
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
        });
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
        });
        const secretsKey = new kms.Key(this, 'SecretsKey');
        const cluster = new eks.Cluster(this, 'petsite', {
            clusterName: 'PetSite',
            mastersRole: clusterAdmin,
            vpc: theVPC,
            defaultCapacity: 0,
            // defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
            secretsEncryptionKey: secretsKey,
            version: aws_eks_1.KubernetesVersion.of('1.27'),
            kubectlLayer: new lambda_layer_kubectl_1.KubectlLayer(this, 'kubectl')
        });
        const eksOptimizedImage = new eks.EksOptimizedImage(/* all optional props */ {
            cpuArch: eks.CpuArch.X86_64,
            kubernetesVersion: '1.27',
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
        const eksPetsiteASGClusterNodeGroupRole = new iam.Role(this, 'eksPetsiteASGClusterNodeGroupRole', {
            roleName: 'eksPetsiteASGClusterNodeGroupRole',
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'),
            ],
        });
        // Create nodeGroup properties
        const eksPetSiteNodegroupProps = {
            cluster: cluster,
            launchTemplateSpec: {
                id: eksPetSitelt.launchTemplateId,
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
        new eks_nodegroup_asg_tags_cdk_1.NodegroupAsgTags(this, 'petSiteNodeGroupAsgTags', {
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
        var ssmAgentSetup = yaml.loadAll((0, fs_1.readFileSync)("./resources/setup-ssm-agent.yaml", "utf8"));
        const ssmAgentSetupManifest = new eks.KubernetesManifest(this, "ssmAgentdeployment", {
            cluster: cluster,
            manifest: ssmAgentSetup
        });
        // ClusterID is not available for creating the proper conditions https://github.com/aws/aws-cdk/issues/10347
        const clusterId = aws_cdk_lib_1.Fn.select(4, aws_cdk_lib_1.Fn.split('/', cluster.clusterOpenIdConnectIssuerUrl)); // Remove https:// from the URL as workaround to get ClusterID
        const cw_federatedPrincipal = new iam.FederatedPrincipal(cluster.openIdConnectProvider.openIdConnectProviderArn, {
            StringEquals: new aws_cdk_lib_1.CfnJson(this, "CW_FederatedPrincipalCondition", {
                value: {
                    [`oidc.eks.${region}.amazonaws.com/id/${clusterId}:aud`]: "sts.amazonaws.com"
                }
            })
        });
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
        (_f = cwserviceaccount.assumeRolePolicy) === null || _f === void 0 ? void 0 : _f.addStatements(cw_trustRelationship);
        const xray_federatedPrincipal = new iam.FederatedPrincipal(cluster.openIdConnectProvider.openIdConnectProviderArn, {
            StringEquals: new aws_cdk_lib_1.CfnJson(this, "Xray_FederatedPrincipalCondition", {
                value: {
                    [`oidc.eks.${region}.amazonaws.com/id/${clusterId}:aud`]: "sts.amazonaws.com"
                }
            })
        });
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
        (_g = xrayserviceaccount.assumeRolePolicy) === null || _g === void 0 ? void 0 : _g.addStatements(xray_trustRelationship);
        const loadbalancer_federatedPrincipal = new iam.FederatedPrincipal(cluster.openIdConnectProvider.openIdConnectProviderArn, {
            StringEquals: new aws_cdk_lib_1.CfnJson(this, "LB_FederatedPrincipalCondition", {
                value: {
                    [`oidc.eks.${region}.amazonaws.com/id/${clusterId}:aud`]: "sts.amazonaws.com"
                }
            })
        });
        const loadBalancer_trustRelationship = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [loadbalancer_federatedPrincipal],
            actions: ["sts:AssumeRoleWithWebIdentity"]
        });
        const loadBalancerPolicyDoc = iam.PolicyDocument.fromJson(JSON.parse((0, fs_1.readFileSync)("./resources/load_balancer/iam_policy.json", "utf8")));
        const loadBalancerPolicy = new iam.ManagedPolicy(this, 'LoadBalancerSAPolicy', { document: loadBalancerPolicyDoc });
        const loadBalancerserviceaccount = new iam.Role(this, 'LoadBalancerServiceAccount', {
            //                assumedBy: eksFederatedPrincipal,
            assumedBy: new iam.AccountRootPrincipal(),
            managedPolicies: [loadBalancerPolicy]
        });
        (_h = loadBalancerserviceaccount.assumeRolePolicy) === null || _h === void 0 ? void 0 : _h.addStatements(loadBalancer_trustRelationship);
        // Fix for EKS Dashboard access
        const dashboardRoleYaml = yaml.loadAll((0, fs_1.readFileSync)("./resources/dashboard.yaml", "utf8"));
        const dashboardRoleArn = this.node.tryGetContext('dashboard_role_arn');
        if ((dashboardRoleArn != undefined) && (dashboardRoleArn.length > 0)) {
            const role = iam.Role.fromRoleArn(this, "DashboardRoleArn", dashboardRoleArn, { mutable: false });
            cluster.awsAuth.addRoleMapping(role, { groups: ["dashboard-view"] });
        }
        if (isEventEngine === 'true') {
            var c9Env = new cloud9_1.Cloud9Environment(this, 'Cloud9Environment', {
                vpcId: theVPC.vpcId,
                subnetId: theVPC.publicSubnets[0].subnetId,
                cloud9OwnerArn: "assumed-role/WSParticipantRole/Participant",
                templateFile: __dirname + "/../../../../cloud9-cfn.yaml"
            });
            var c9role = c9Env.c9Role;
            // Dynamically check if AWSCloud9SSMAccessRole and AWSCloud9SSMInstanceProfile exists
            const c9SSMRole = new iam.Role(this, 'AWSCloud9SSMAccessRole', {
                path: '/service-role/',
                roleName: 'AWSCloud9SSMAccessRole',
                assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal("ec2.amazonaws.com"), new iam.ServicePrincipal("cloud9.amazonaws.com")),
                managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AWSCloud9SSMInstanceProfile"), iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")]
            });
            const teamRole = iam.Role.fromRoleArn(this, 'TeamRole', "arn:aws:iam::" + stack.account + ":role/WSParticipantRole");
            cluster.awsAuth.addRoleMapping(teamRole, { groups: ["dashboard-view"] });
            if (c9role != undefined) {
                cluster.awsAuth.addMastersRole(iam.Role.fromRoleArn(this, 'c9role', c9role.attrArn, { mutable: false }));
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
        var xRayYaml = yaml.loadAll((0, fs_1.readFileSync)("./resources/k8s_petsite/xray-daemon-config.yaml", "utf8"));
        xRayYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = new aws_cdk_lib_1.CfnJson(this, "xray_Role", { value: `${xrayserviceaccount.roleArn}` });
        const xrayManifest = new eks.KubernetesManifest(this, "xraydeployment", {
            cluster: cluster,
            manifest: xRayYaml
        });
        var loadBalancerServiceAccountYaml = yaml.loadAll((0, fs_1.readFileSync)("./resources/load_balancer/service_account.yaml", "utf8"));
        loadBalancerServiceAccountYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = new aws_cdk_lib_1.CfnJson(this, "loadBalancer_Role", { value: `${loadBalancerserviceaccount.roleArn}` });
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
        const loadBalancerCRDYaml = yaml.loadAll((0, fs_1.readFileSync)("./resources/load_balancer/crds.yaml", "utf8"));
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
        var fluentbitYaml = yaml.loadAll((0, fs_1.readFileSync)("./resources/cwagent-fluent-bit-quickstart.yaml", "utf8"));
        fluentbitYaml[1].metadata.annotations["eks.amazonaws.com/role-arn"] = new aws_cdk_lib_1.CfnJson(this, "fluentbit_Role", { value: `${cwserviceaccount.roleArn}` });
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
        fluentbitYaml[7].metadata.annotations["eks.amazonaws.com/role-arn"] = new aws_cdk_lib_1.CfnJson(this, "cloudwatch_Role", { value: `${cwserviceaccount.roleArn}` });
        // The `cluster-info` configmap is used by the current Python implementation for the `AwsEksResourceDetector`
        fluentbitYaml[12].data["cluster.name"] = "PetSite";
        fluentbitYaml[12].data["logs.region"] = region;
        const fluentbitManifest = new eks.KubernetesManifest(this, "cloudwatcheployment", {
            cluster: cluster,
            manifest: fluentbitYaml
        });
        // CloudWatch agent for prometheus metrics
        var prometheusYaml = yaml.loadAll((0, fs_1.readFileSync)("./resources/prometheus-eks.yaml", "utf8"));
        prometheusYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = new aws_cdk_lib_1.CfnJson(this, "prometheus_Role", { value: `${cwserviceaccount.roleArn}` });
        const prometheusManifest = new eks.KubernetesManifest(this, "prometheusdeployment", {
            cluster: cluster,
            manifest: prometheusYaml
        });
        prometheusManifest.node.addDependency(fluentbitManifest); // Namespace creation dependency
        var dashboardBody = (0, fs_1.readFileSync)("./resources/cw_dashboard_fluent_bit.json", "utf-8");
        dashboardBody = dashboardBody.replaceAll("{{YOUR_CLUSTER_NAME}}", "PetSite");
        dashboardBody = dashboardBody.replaceAll("{{YOUR_AWS_REGION}}", region);
        const fluentBitDashboard = new cloudwatch.CfnDashboard(this, "FluentBitDashboard", {
            dashboardName: "EKS_FluentBit_Dashboard",
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
            timeout: aws_cdk_lib_1.Duration.minutes(10)
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
            timeout: aws_cdk_lib_1.Duration.seconds(60)
        });
        customWidgetFunction.addEnvironment("CONTROLER_LAMBDA_ARN", petsiteApplicationResourceController.functionArn);
        customWidgetFunction.addEnvironment("EKS_CLUSTER_NAME", cluster.clusterName);
        /*
        customWidgetFunction.addEnvironment("ECS_CLUSTER_ARNS", ecsPayForAdoptionCluster.clusterArn + "," +
            ecsPetListAdoptionCluster.clusterArn + "," + ecsPetSearchCluster.clusterArn);
        */
        customWidgetFunction.addEnvironment("ECS_CLUSTER_ARNS", ecsPayForAdoptionCluster.clusterArn + "," +
            ecsPetListAdoptionCluster.clusterArn + "," + ecsEc2PetSearchCluster.clusterArn);
        var costControlDashboardBody = (0, fs_1.readFileSync)("./resources/cw_dashboard_cost_control.json", "utf-8");
        costControlDashboardBody = costControlDashboardBody.replaceAll("{{YOUR_LAMBDA_ARN}}", customWidgetFunction.functionArn);
        const petSiteCostControlDashboard = new cloudwatch.CfnDashboard(this, "PetSiteCostControlDashboard", {
            dashboardName: "PetSite_Cost_Control_Dashboard",
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
        const petAdoptionsStepFn = new stepfn_1.PetAdoptionsStepFn(this, 'StepFn');
        this.createSsmParameters(new Map(Object.entries({
            '/petstore/trafficdelaytime': "1",
            '/petstore/rumscript': " ",
            '/petstore/petadoptionsstepfnarn': petAdoptionsStepFn.stepFn.stateMachineArn,
            '/petstore/updateadoptionstatusurl': statusUpdaterService.api.url,
            '/petstore/queueurl': sqsQueue.queueUrl,
            '/petstore/snsarn': topic_petadoption.topicArn,
            '/petstore/dynamodbtablename': dynamodb_petadoption.tableName,
            '/petstore/s3bucketname': s3_observabilitypetadoptions.bucketName,
            '/petstore/searchapiurl': `http://${searchServiceEc2.service.loadBalancer.loadBalancerDnsName}/api/search?`,
            '/petstore/searchimage': searchServiceEc2.container.imageName,
            '/petstore/petlistadoptionsurl': `http://${listAdoptionsService.service.loadBalancer.loadBalancerDnsName}/api/adoptionlist/`,
            '/petstore/petlistadoptionsmetricsurl': `http://${listAdoptionsService.service.loadBalancer.loadBalancerDnsName}/metrics`,
            '/petstore/paymentapiurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/api/home/completeadoption`,
            '/petstore/payforadoptionmetricsurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/metrics`,
            '/petstore/cleanupadoptionsurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/api/home/cleanupadoptions`,
            '/petstore/petsearch-collector-manual-config': (0, fs_1.readFileSync)("./resources/collector/ecs-xray-manual.yaml", "utf8"),
            '/petstore/rdssecretarn': `${(_j = auroraCluster.secret) === null || _j === void 0 ? void 0 : _j.secretArn}`,
            '/petstore/rdsendpoint': auroraCluster.clusterEndpoint.hostname,
            '/petstore/stackname': stackName,
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
            'RDSServerName': auroraCluster.clusterEndpoint.hostname
        })));
    }
    createSsmParameters(params) {
        params.forEach((value, key) => {
            //const id = key.replace('/', '_');
            new ssm.StringParameter(this, key, { parameterName: key, stringValue: value });
        });
    }
    createOuputs(params) {
        params.forEach((value, key) => {
            new aws_cdk_lib_1.CfnOutput(this, key, { value: value });
        });
    }
}
exports.Services = Services;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXJ2aWNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLG1EQUFtRDtBQUNuRCwyQ0FBMkM7QUFDM0MsMkNBQTBDO0FBQzFDLDJDQUEwQztBQUMxQywwREFBeUQ7QUFDekQsZ0RBQStDO0FBQy9DLHlDQUF3QztBQUN4QywwREFBeUQ7QUFDekQsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLGdDQUFnQztBQUNoQyw2QkFBNkI7QUFDN0IsaURBQWlEO0FBQ2pELGdFQUFnRTtBQUVoRSx5REFBeUQ7QUFNekQsa0ZBQTJFO0FBQzNFLDhFQUF3RTtBQUV4RSxzRUFBZ0U7QUFDaEUsb0ZBQThFO0FBQzlFLDhFQUF3RTtBQUN4RSw4Q0FBc0Q7QUFDdEQsaURBQXdEO0FBQ3hELDZDQUFpRztBQUNqRywyQkFBa0M7QUFDbEMsMEJBQXVCO0FBQ3ZCLCtEQUFrRjtBQUNsRiwyRUFBZ0U7QUFDaEUsa0RBQTBEO0FBQzFELDJFQUE4RDtBQUU5RCxNQUFhLFFBQVMsU0FBUSxtQkFBSztJQUMvQixZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCOztRQUN4RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixJQUFJLGFBQWEsR0FBRyxPQUFPLENBQUM7UUFDNUIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQzFELGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFFckIsdURBQXVEO1FBQ3ZELE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxD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RUFBRSxFQUFFLGFBQWEsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDbkYsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRU8sWUFBWSxDQUFDLE1BQTJCO1FBQzVDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLEVBQUU7WUFDMUIsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQTtRQUM5QyxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQXB6QkQsNEJBb3pCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGFzZyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXV0b3NjYWxpbmcnO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnXG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcydcbmltcG9ydCAqIGFzIHN1YnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJ1xuaW1wb3J0ICogYXMgZGRiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYidcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMydcbmltcG9ydCAqIGFzIHMzc2VlZGVyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50J1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xuaW1wb3J0ICogYXMgZWtzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1la3MnO1xuaW1wb3J0ICogYXMgeWFtbCBmcm9tICdqcy15YW1sJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBlbGJ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2Mic7XG5pbXBvcnQgKiBhcyBjbG91ZDkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkOSc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGVjciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyJztcbmltcG9ydCAqIGFzIGVjcmFzc2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyLWFzc2V0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnXG5pbXBvcnQgeyBQYXlGb3JBZG9wdGlvblNlcnZpY2UgfSBmcm9tICcuL3NlcnZpY2VzL3BheS1mb3ItYWRvcHRpb24tc2VydmljZSdcbmltcG9ydCB7IExpc3RBZG9wdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9saXN0LWFkb3B0aW9ucy1zZXJ2aWNlJ1xuaW1wb3J0IHsgU2VhcmNoU2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvc2VhcmNoLXNlcnZpY2UnXG5pbXBvcnQgeyBTZWFyY2hFYzJTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9zZWFyY2gtc2VydmljZS1lYzInXG5pbXBvcnQgeyBUcmFmZmljR2VuZXJhdG9yU2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvdHJhZmZpYy1nZW5lcmF0b3Itc2VydmljZSdcbmltcG9ydCB7IFN0YXR1c1VwZGF0ZXJTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9zdGF0dXMtdXBkYXRlci1zZXJ2aWNlJ1xuaW1wb3J0IHsgUGV0QWRvcHRpb25zU3RlcEZuIH0gZnJvbSAnLi9zZXJ2aWNlcy9zdGVwZm4nXG5pbXBvcnQgeyBLdWJlcm5ldGVzVmVyc2lvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1la3MnO1xuaW1wb3J0IHsgQ2ZuSnNvbiwgUmVtb3ZhbFBvbGljeSwgRm4sIER1cmF0aW9uLCBTdGFjaywgU3RhY2tQcm9wcywgQ2ZuT3V0cHV0IH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICd0cy1yZXBsYWNlLWFsbCdcbmltcG9ydCB7IFRyZWF0TWlzc2luZ0RhdGEsIENvbXBhcmlzb25PcGVyYXRvciB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCB7IEt1YmVjdGxMYXllciB9IGZyb20gJ2F3cy1jZGstbGliL2xhbWJkYS1sYXllci1rdWJlY3RsJztcbmltcG9ydCB7IENsb3VkOUVudmlyb25tZW50IH0gZnJvbSAnLi9tb2R1bGVzL2NvcmUvY2xvdWQ5JztcbmltcG9ydCB7IE5vZGVncm91cEFzZ1RhZ3MgfSBmcm9tICdla3Mtbm9kZWdyb3VwLWFzZy10YWdzLWNkayc7XG5cbmV4cG9ydCBjbGFzcyBTZXJ2aWNlcyBleHRlbmRzIFN0YWNrIHtcbiAgICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFN0YWNrUHJvcHMpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAgICAgdmFyIGlzRXZlbnRFbmdpbmUgPSAnZmFsc2UnO1xuICAgICAgICBpZiAodGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2lzX2V2ZW50X2VuZ2luZScpICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaXNFdmVudEVuZ2luZSA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdpc19ldmVudF9lbmdpbmUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN0YWNrTmFtZSA9IGlkO1xuXG4gICAgICAgIC8vIENyZWF0ZSBTUVMgcmVzb3VyY2UgdG8gc2VuZCBQZXQgYWRvcHRpb24gbWVzc2FnZXMgdG9cbiAgICAgICAgY29uc3Qgc3FzUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdzcXNfcGV0YWRvcHRpb24nLCB7XG4gICAgICAgICAgICB2aXNpYmlsaXR5VGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMDApXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIENyZWF0ZSBTTlMgYW5kIGFuIGVtYWlsIHRvcGljIHRvIHNlbmQgbm90aWZpY2F0aW9ucyB0b1xuICAgICAgICBjb25zdCB0b3BpY19wZXRhZG9wdGlvbiA9IG5ldyBzbnMuVG9waWModGhpcywgJ3RvcGljX3BldGFkb3B0aW9uJyk7XG4gICAgICAgIHZhciB0b3BpY19lbWFpbCA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdzbnN0b3BpY19lbWFpbCcpO1xuICAgICAgICBpZiAodG9waWNfZW1haWwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0b3BpY19lbWFpbCA9IFwic29tZW9uZUBleGFtcGxlLmNvbVwiO1xuICAgICAgICB9XG4gICAgICAgIHRvcGljX3BldGFkb3B0aW9uLmFkZFN1YnNjcmlwdGlvbihuZXcgc3Vicy5FbWFpbFN1YnNjcmlwdGlvbih0b3BpY19lbWFpbCkpO1xuXG4gICAgICAgIC8vIENyZWF0ZXMgYW4gUzMgYnVja2V0IHRvIHN0b3JlIHBldCBpbWFnZXNcbiAgICAgICAgY29uc3QgczNfb2JzZXJ2YWJpbGl0eXBldGFkb3B0aW9ucyA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ3MzYnVja2V0X3BldGFkb3B0aW9uJywge1xuICAgICAgICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQ3JlYXRlcyB0aGUgRHluYW1vREIgdGFibGUgZm9yIFBldGFkb3B0aW9uIGRhdGFcbiAgICAgICAgY29uc3QgZHluYW1vZGJfcGV0YWRvcHRpb24gPSBuZXcgZGRiLlRhYmxlKHRoaXMsICdkZGJfcGV0YWRvcHRpb24nLCB7XG4gICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAncGV0dHlwZScsXG4gICAgICAgICAgICAgICAgdHlwZTogZGRiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc29ydEtleToge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdwZXRpZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogZGRiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICAgICAgYmlsbGluZ01vZGU6IGRkYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGR5bmFtb2RiX3BldGFkb3B0aW9uLm1ldHJpYygnV3JpdGVUaHJvdHRsZUV2ZW50cycsIHsgc3RhdGlzdGljOiBcImF2Z1wiIH0pLmNyZWF0ZUFsYXJtKHRoaXMsICdXcml0ZVRocm90dGxlRXZlbnRzLUJhc2ljQWxhcm0nLCB7XG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDAsXG4gICAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBUcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IENvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgICAgICBhbGFybU5hbWU6IGAke2R5bmFtb2RiX3BldGFkb3B0aW9uLnRhYmxlTmFtZX0tV3JpdGVUaHJvdHRsZUV2ZW50cy1CYXNpY0FsYXJtYCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZHluYW1vZGJfcGV0YWRvcHRpb24ubWV0cmljKCdSZWFkVGhyb3R0bGVFdmVudHMnLCB7IHN0YXRpc3RpYzogXCJhdmdcIiB9KS5jcmVhdGVBbGFybSh0aGlzLCAnUmVhZFRocm90dGxlRXZlbnRzLUJhc2ljQWxhcm0nLCB7XG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDAsXG4gICAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBUcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IENvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgICAgICBhbGFybU5hbWU6IGAke2R5bmFtb2RiX3BldGFkb3B0aW9uLnRhYmxlTmFtZX0tUmVhZFRocm90dGxlRXZlbnRzLUJhc2ljQWxhcm1gLFxuICAgICAgICB9KTtcblxuXG4gICAgICAgIC8vIFNlZWRzIHRoZSBTMyBidWNrZXQgd2l0aCBwZXQgaW1hZ2VzXG4gICAgICAgIG5ldyBzM3NlZWRlci5CdWNrZXREZXBsb3ltZW50KHRoaXMsIFwiczNzZWVkZXJfcGV0YWRvcHRpb25cIiwge1xuICAgICAgICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IHMzX29ic2VydmFiaWxpdHlwZXRhZG9wdGlvbnMsXG4gICAgICAgICAgICBzb3VyY2VzOiBbczNzZWVkZXIuU291cmNlLmFzc2V0KCcuL3Jlc291cmNlcy9raXR0ZW4uemlwJyksIHMzc2VlZGVyLlNvdXJjZS5hc3NldCgnLi9yZXNvdXJjZXMvcHVwcGllcy56aXAnKSwgczNzZWVkZXIuU291cmNlLmFzc2V0KCcuL3Jlc291cmNlcy9idW5uaWVzLnppcCcpXVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIHZhciBjaWRyUmFuZ2UgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgndnBjX2NpZHInKTtcbiAgICAgICAgaWYgKGNpZHJSYW5nZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNpZHJSYW5nZSA9IFwiMTEuMC4wLjAvMTZcIjtcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGUgVlBDIHdoZXJlIGFsbCB0aGUgbWljcm9zZXJ2aWNlcyB3aWxsIGJlIGRlcGxveWVkIGludG9cbiAgICAgICAgY29uc3QgdGhlVlBDID0gbmV3IGVjMi5WcGModGhpcywgJ01pY3Jvc2VydmljZXMnLCB7XG4gICAgICAgICAgICBpcEFkZHJlc3NlczogZWMyLklwQWRkcmVzc2VzLmNpZHIoY2lkclJhbmdlKSxcbiAgICAgICAgICAgIC8vIGNpZHI6IGNpZHJSYW5nZSxcbiAgICAgICAgICAgIG5hdEdhdGV3YXlzOiAxLFxuICAgICAgICAgICAgbWF4QXpzOiAyLFxuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZGluZyB0YWdzIHRvIHRoZSBWUEMgZm9yIEF6SW1wYWlybWVudFBvd2VyXG4gICAgICAgIC8vY2RrLlRhZ3Mub2YodGhlVlBDKS5hZGQoJ0F6SW1wYWlybWVudFBvd2VyJywgJ0Rpc3J1cHRTdWJuZXQnKTtcblxuICAgICAgICAvLyBDcmVhdGUgUkRTIEF1cm9yYSBQRyBjbHVzdGVyXG4gICAgICAgIGNvbnN0IHJkc3NlY3VyaXR5Z3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ3BldGFkb3B0aW9uc3Jkc1NHJywge1xuICAgICAgICAgICAgdnBjOiB0aGVWUENcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmRzc2VjdXJpdHlncm91cC5hZGRJbmdyZXNzUnVsZShlYzIuUGVlci5pcHY0KHRoZVZQQy52cGNDaWRyQmxvY2spLCBlYzIuUG9ydC50Y3AoNTQzMiksICdBbGxvdyBBdXJvcmEgUEcgYWNjZXNzIGZyb20gd2l0aGluIHRoZSBWUEMgQ0lEUiByYW5nZScpO1xuXG4gICAgICAgIHZhciByZHNVc2VybmFtZSA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdyZHN1c2VybmFtZScpO1xuICAgICAgICBpZiAocmRzVXNlcm5hbWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZHNVc2VybmFtZSA9IFwicGV0YWRtaW5cIlxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXVyb3JhQ2x1c3RlciA9IG5ldyByZHMuRGF0YWJhc2VDbHVzdGVyKHRoaXMsICdEYXRhYmFzZScsIHtcblxuICAgICAgICAgICAgZW5naW5lOiByZHMuRGF0YWJhc2VDbHVzdGVyRW5naW5lLmF1cm9yYVBvc3RncmVzKHsgdmVyc2lvbjogcmRzLkF1cm9yYVBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTNfOSB9KSxcbiAgICAgICAgICAgIHdyaXRlcjogcmRzLkNsdXN0ZXJJbnN0YW5jZS5wcm92aXNpb25lZCgnd3JpdGVyJywge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5SNkcsIGVjMi5JbnN0YW5jZVNpemUuWExBUkdFNCksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHJlYWRlcnM6IFtcbiAgICAgICAgICAgICAgICByZHMuQ2x1c3Rlckluc3RhbmNlLnByb3Zpc2lvbmVkKCdyZWFkZXInLCB7XG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5SNkcsIGVjMi5JbnN0YW5jZVNpemUuWExBUkdFNCksXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHBhcmFtZXRlckdyb3VwOiByZHMuUGFyYW1ldGVyR3JvdXAuZnJvbVBhcmFtZXRlckdyb3VwTmFtZSh0aGlzLCAnUGFyYW1ldGVyR3JvdXAnLCAnZGVmYXVsdC5hdXJvcmEtcG9zdGdyZXNxbDEzJyksXG4gICAgICAgICAgICB2cGM6IHRoZVZQQyxcbiAgICAgICAgICAgIHNlY3VyaXR5R3JvdXBzOiBbcmRzc2VjdXJpdHlncm91cF0sXG4gICAgICAgICAgICBkZWZhdWx0RGF0YWJhc2VOYW1lOiAnYWRvcHRpb25zJ1xuICAgICAgICAgICAgLy8gc2NhbGluZzoge1xuICAgICAgICAgICAgLy8gICAgIGF1dG9QYXVzZTogRHVyYXRpb24ubWludXRlcyg2MCksXG4gICAgICAgICAgICAvLyAgICAgbWluQ2FwYWNpdHk6IHJkcy5BdXJvcmFDYXBhY2l0eVVuaXQuQUNVXzIsXG4gICAgICAgICAgICAvLyAgICAgbWF4Q2FwYWNpdHk6IHJkcy5BdXJvcmFDYXBhY2l0eVVuaXQuQUNVXzgsXG4gICAgICAgICAgICAvLyB9XG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICBjb25zdCByZWFkU1NNUGFyYW1zUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyc0J5UGF0aCcsXG4gICAgICAgICAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgICAgICAgICAnc3NtOkdldFBhcmFtZXRlcicsXG4gICAgICAgICAgICAgICAgJ2VjMjpEZXNjcmliZVZwY3MnXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGNvbnN0IGRkYlNlZWRQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoV3JpdGVJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6TGlzdFRhYmxlcycsXG4gICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpTY2FuXCIsXG4gICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpRdWVyeVwiXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCByZXBvc2l0b3J5VVJJID0gXCJwdWJsaWMuZWNyLmF3cy9vbmUtb2JzZXJ2YWJpbGl0eS13b3Jrc2hvcFwiO1xuXG4gICAgICAgIGNvbnN0IHN0YWNrID0gU3RhY2sub2YodGhpcyk7XG4gICAgICAgIGNvbnN0IHJlZ2lvbiA9IHN0YWNrLnJlZ2lvbjtcblxuICAgICAgICBjb25zdCBlY3NTZXJ2aWNlc1NlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0VDU1NlcnZpY2VzU0cnLCB7XG4gICAgICAgICAgICB2cGM6IHRoZVZQQ1xuICAgICAgICB9KTtcblxuICAgICAgICBlY3NTZXJ2aWNlc1NlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoZWMyLlBlZXIuaXB2NCh0aGVWUEMudnBjQ2lkckJsb2NrKSwgZWMyLlBvcnQudGNwKDgwKSk7XG5cbiAgICAgICAgY29uc3QgZWNzUGF5Rm9yQWRvcHRpb25DbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsIFwiUGF5Rm9yQWRvcHRpb25cIiwge1xuICAgICAgICAgICAgdnBjOiB0aGVWUEMsXG4gICAgICAgICAgICBjb250YWluZXJJbnNpZ2h0czogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBQYXlGb3JBZG9wdGlvbiBzZXJ2aWNlIGRlZmluaXRpb25zLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgY29uc3QgcGF5Rm9yQWRvcHRpb25TZXJ2aWNlID0gbmV3IFBheUZvckFkb3B0aW9uU2VydmljZSh0aGlzLCAncGF5LWZvci1hZG9wdGlvbi1zZXJ2aWNlJywge1xuICAgICAgICAgICAgY2x1c3RlcjogZWNzUGF5Rm9yQWRvcHRpb25DbHVzdGVyLFxuICAgICAgICAgICAgbG9nR3JvdXBOYW1lOiBcIi9lY3MvUGF5Rm9yQWRvcHRpb25cIixcbiAgICAgICAgICAgIGNwdTogMTAyNCxcbiAgICAgICAgICAgIG1lbW9yeUxpbWl0TWlCOiAyMDQ4LFxuICAgICAgICAgICAgaGVhbHRoQ2hlY2s6ICcvaGVhbHRoL3N0YXR1cycsXG4gICAgICAgICAgICBlbmFibGVTU006IHRydWUsXG4gICAgICAgICAgICAvLyBidWlsZCBsb2NhbGx5XG4gICAgICAgICAgICAvL3JlcG9zaXRvcnlVUkk6IHJlcG9zaXRvcnlVUkksXG4gICAgICAgICAgICBkYXRhYmFzZTogYXVyb3JhQ2x1c3RlcixcbiAgICAgICAgICAgIGRlc2lyZWRUYXNrQ291bnQ6IDIsXG4gICAgICAgICAgICByZWdpb246IHJlZ2lvbixcbiAgICAgICAgICAgIHNlY3VyaXR5R3JvdXA6IGVjc1NlcnZpY2VzU2VjdXJpdHlHcm91cFxuICAgICAgICB9KTtcbiAgICAgICAgcGF5Rm9yQWRvcHRpb25TZXJ2aWNlLnRhc2tEZWZpbml0aW9uLnRhc2tSb2xlPy5hZGRUb1ByaW5jaXBhbFBvbGljeShyZWFkU1NNUGFyYW1zUG9saWN5KTtcbiAgICAgICAgcGF5Rm9yQWRvcHRpb25TZXJ2aWNlLnRhc2tEZWZpbml0aW9uLnRhc2tSb2xlPy5hZGRUb1ByaW5jaXBhbFBvbGljeShkZGJTZWVkUG9saWN5KTtcblxuXG4gICAgICAgIGNvbnN0IGVjc1BldExpc3RBZG9wdGlvbkNsdXN0ZXIgPSBuZXcgZWNzLkNsdXN0ZXIodGhpcywgXCJQZXRMaXN0QWRvcHRpb25zXCIsIHtcbiAgICAgICAgICAgIHZwYzogdGhlVlBDLFxuICAgICAgICAgICAgY29udGFpbmVySW5zaWdodHM6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIFBldExpc3RBZG9wdGlvbnMgc2VydmljZSBkZWZpbml0aW9ucy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIGNvbnN0IGxpc3RBZG9wdGlvbnNTZXJ2aWNlID0gbmV3IExpc3RBZG9wdGlvbnNTZXJ2aWNlKHRoaXMsICdsaXN0LWFkb3B0aW9ucy1zZXJ2aWNlJywge1xuICAgICAgICAgICAgY2x1c3RlcjogZWNzUGV0TGlzdEFkb3B0aW9uQ2x1c3RlcixcbiAgICAgICAgICAgIGxvZ0dyb3VwTmFtZTogXCIvZWNzL1BldExpc3RBZG9wdGlvbnNcIixcbiAgICAgICAgICAgIGNwdTogMTAyNCxcbiAgICAgICAgICAgIG1lbW9yeUxpbWl0TWlCOiAyMDQ4LFxuICAgICAgICAgICAgaGVhbHRoQ2hlY2s6ICcvaGVhbHRoL3N0YXR1cycsXG4gICAgICAgICAgICBpbnN0cnVtZW50YXRpb246ICdvdGVsJyxcbiAgICAgICAgICAgIGVuYWJsZVNTTTogdHJ1ZSxcbiAgICAgICAgICAgIC8vIGJ1aWxkIGxvY2FsbHlcbiAgICAgICAgICAgIC8vcmVwb3NpdG9yeVVSSTogcmVwb3NpdG9yeVVSSSxcbiAgICAgICAgICAgIGRhdGFiYXNlOiBhdXJvcmFDbHVzdGVyLFxuICAgICAgICAgICAgZGVzaXJlZFRhc2tDb3VudDogMixcbiAgICAgICAgICAgIHJlZ2lvbjogcmVnaW9uLFxuICAgICAgICAgICAgc2VjdXJpdHlHcm91cDogZWNzU2VydmljZXNTZWN1cml0eUdyb3VwXG4gICAgICAgIH0pO1xuICAgICAgICBsaXN0QWRvcHRpb25zU2VydmljZS50YXNrRGVmaW5pdGlvbi50YXNrUm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3kocmVhZFNTTVBhcmFtc1BvbGljeSk7XG5cbiAgICAgICAgLypcbiAgICAgICAgY29uc3QgZWNzUGV0U2VhcmNoQ2x1c3RlciA9IG5ldyBlY3MuQ2x1c3Rlcih0aGlzLCBcIlBldFNlYXJjaFwiLCB7XG4gICAgICAgICAgICB2cGM6IHRoZVZQQyxcbiAgICAgICAgICAgIGNvbnRhaW5lckluc2lnaHRzOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICAvLyBQZXRTZWFyY2ggc2VydmljZSBkZWZpbml0aW9ucy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIGNvbnN0IHNlYXJjaFNlcnZpY2UgPSBuZXcgU2VhcmNoU2VydmljZSh0aGlzLCAnc2VhcmNoLXNlcnZpY2UnLCB7XG4gICAgICAgICAgICBjbHVzdGVyOiBlY3NQZXRTZWFyY2hDbHVzdGVyLFxuICAgICAgICAgICAgbG9nR3JvdXBOYW1lOiBcIi9lY3MvUGV0U2VhcmNoXCIsXG4gICAgICAgICAgICBjcHU6IDEwMjQsXG4gICAgICAgICAgICBtZW1vcnlMaW1pdE1pQjogMjA0OCxcbiAgICAgICAgICAgIC8vcmVwb3NpdG9yeVVSSTogcmVwb3NpdG9yeVVSSSxcbiAgICAgICAgICAgIGhlYWx0aENoZWNrOiAnL2hlYWx0aC9zdGF0dXMnLFxuICAgICAgICAgICAgZGVzaXJlZFRhc2tDb3VudDogMixcbiAgICAgICAgICAgIGluc3RydW1lbnRhdGlvbjogJ290ZWwnLFxuICAgICAgICAgICAgcmVnaW9uOiByZWdpb24sXG4gICAgICAgICAgICBzZWN1cml0eUdyb3VwOiBlY3NTZXJ2aWNlc1NlY3VyaXR5R3JvdXBcbiAgICAgICAgfSlcbiAgICAgICAgc2VhcmNoU2VydmljZS50YXNrRGVmaW5pdGlvbi50YXNrUm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3kocmVhZFNTTVBhcmFtc1BvbGljeSk7XG4gICAgICAgICBcbiAgICAgICAgKi9cblxuICAgICAgICAvLyBQZXRTZWFyY2ggc2VydmljZSBFYzIgZGVmaW5pdGlvbnMtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBjb25zdCBlY3NFYzJQZXRTZWFyY2hDbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsIFwiUGV0U2VhcmNoRWMyXCIsIHtcbiAgICAgICAgICAgIHZwYzogdGhlVlBDLFxuICAgICAgICAgICAgY29udGFpbmVySW5zaWdodHM6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgICAvLyBSZXBsYWNpbmcgd2l0aCBhZGRBc2dDYXBhY2l0eVByb3ZpZGVyIGFzIHBlciBiZXN0IHByYWN0aWNlXG4gICAgICAgIC8vIGVjc0VjMlBldFNlYXJjaENsdXN0ZXIuYWRkQ2FwYWNpdHkoJ1BldFNlYXJjaEVjMicsIHtcbiAgICAgICAgLy8gICAgIGluc3RhbmNlVHlwZTogbmV3IGVjMi5JbnN0YW5jZVR5cGUoJ201LmxhcmdlJyksXG4gICAgICAgIC8vICAgICBkZXNpcmVkQ2FwYWNpdHk6IDIsXG4gICAgICAgIC8vIH0pO1xuXG4gICAgICAgIGNvbnN0IGVjc0VjMlBldFNlYXJjaFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ2Vjc0VjMlBldFNlYXJjaFJvbGUnLCB7XG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWMyLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZWNzRWMyUGV0U2VhcmNoUm9sZS5hZGRNYW5hZ2VkUG9saWN5KGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU1NNTWFuYWdlZEluc3RhbmNlQ29yZScpKTtcblxuXG5cbiAgICAgICAgY29uc3QgZWNzRWMyUGV0U2VhcmNobGF1bmNoVGVtcGxhdGUgPSBuZXcgZWMyLkxhdW5jaFRlbXBsYXRlKHRoaXMsICdlY3NFYzJQZXRTZWFyY2hMYXVuY2hUZW1wbGF0ZScsIHtcbiAgICAgICAgICAgIG1hY2hpbmVJbWFnZTogZWNzLkVjc09wdGltaXplZEltYWdlLmFtYXpvbkxpbnV4MigpLFxuICAgICAgICAgICAgaW5zdGFuY2VUeXBlOiBuZXcgZWMyLkluc3RhbmNlVHlwZSgnbTUueGxhcmdlJyksXG4gICAgICAgICAgICB1c2VyRGF0YTogZWMyLlVzZXJEYXRhLmZvckxpbnV4KCksXG4gICAgICAgICAgICByb2xlOiBlY3NFYzJQZXRTZWFyY2hSb2xlLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBlY3NFYzJQZXRTZWFyY2hBdXRvU2NhbGluZ0dyb3VwID0gbmV3IGFzZy5BdXRvU2NhbGluZ0dyb3VwKHRoaXMsICdlY3NFYzJQZXRTZWFyY2hBU0cnLCB7XG4gICAgICAgICAgICB2cGM6IHRoZVZQQyxcbiAgICAgICAgICAgIG1pbkNhcGFjaXR5OiAyLFxuICAgICAgICAgICAgbWF4Q2FwYWNpdHk6IDIsXG4gICAgICAgICAgICBkZXNpcmVkQ2FwYWNpdHk6IDIsXG4gICAgICAgICAgICBsYXVuY2hUZW1wbGF0ZTogZWNzRWMyUGV0U2VhcmNobGF1bmNoVGVtcGxhdGUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGVjc0VjMlBldFNlYXJjaENhcGFjaXR5UHJvdmlkZXIgPSBuZXcgZWNzLkFzZ0NhcGFjaXR5UHJvdmlkZXIodGhpcywgJ1BldFNlYXJjaEFzZ0NhcGFjaXR5UHJvdmlkZXInLCB7XG4gICAgICAgICAgICBhdXRvU2NhbGluZ0dyb3VwOiBlY3NFYzJQZXRTZWFyY2hBdXRvU2NhbGluZ0dyb3VwLFxuICAgICAgICAgICAgZW5hYmxlTWFuYWdlZFRlcm1pbmF0aW9uUHJvdGVjdGlvbjogZmFsc2UsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGVjc0VjMlBldFNlYXJjaENsdXN0ZXIuYWRkQXNnQ2FwYWNpdHlQcm92aWRlcihlY3NFYzJQZXRTZWFyY2hDYXBhY2l0eVByb3ZpZGVyKVxuXG5cbiAgICAgICAgY29uc3Qgc2VhcmNoU2VydmljZUVjMiA9IG5ldyBTZWFyY2hFYzJTZXJ2aWNlKHRoaXMsICdzZWFyY2gtc2VydmljZS1lYzInLCB7XG4gICAgICAgICAgICBjbHVzdGVyOiBlY3NFYzJQZXRTZWFyY2hDbHVzdGVyLFxuICAgICAgICAgICAgbG9nR3JvdXBOYW1lOiBcIi9lY3MvUGV0U2VhcmNoRWMyXCIsXG4gICAgICAgICAgICBjcHU6IDEwMjQsXG4gICAgICAgICAgICBtZW1vcnlMaW1pdE1pQjogMjA0OCxcbiAgICAgICAgICAgIC8vcmVwb3NpdG9yeVVSSTogcmVwb3NpdG9yeVVSSSxcbiAgICAgICAgICAgIGhlYWx0aENoZWNrOiAnL2hlYWx0aC9zdGF0dXMnLFxuICAgICAgICAgICAgZGVzaXJlZFRhc2tDb3VudDogMixcbiAgICAgICAgICAgIGluc3RydW1lbnRhdGlvbjogJ290ZWwnLFxuICAgICAgICAgICAgcmVnaW9uOiByZWdpb24sXG4gICAgICAgICAgICBzZWN1cml0eUdyb3VwOiBlY3NTZXJ2aWNlc1NlY3VyaXR5R3JvdXBcbiAgICAgICAgfSlcbiAgICAgICAgc2VhcmNoU2VydmljZUVjMi50YXNrRGVmaW5pdGlvbi50YXNrUm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3kocmVhZFNTTVBhcmFtc1BvbGljeSk7XG5cbiAgICAgICAgLy8gVHJhZmZpYyBHZW5lcmF0b3IgdGFzayBkZWZpbml0aW9uLlxuICAgICAgICBjb25zdCB0cmFmZmljR2VuZXJhdG9yU2VydmljZSA9IG5ldyBUcmFmZmljR2VuZXJhdG9yU2VydmljZSh0aGlzLCAndHJhZmZpYy1nZW5lcmF0b3Itc2VydmljZScsIHtcbiAgICAgICAgICAgIGNsdXN0ZXI6IGVjc1BldExpc3RBZG9wdGlvbkNsdXN0ZXIsXG4gICAgICAgICAgICBsb2dHcm91cE5hbWU6IFwiL2Vjcy9QZXRUcmFmZmljR2VuZXJhdG9yXCIsXG4gICAgICAgICAgICBjcHU6IDUxMixcbiAgICAgICAgICAgIG1lbW9yeUxpbWl0TWlCOiAxMDI0LFxuICAgICAgICAgICAgZW5hYmxlU1NNOiBmYWxzZSxcbiAgICAgICAgICAgIC8vcmVwb3NpdG9yeVVSSTogcmVwb3NpdG9yeVVSSSxcbiAgICAgICAgICAgIGRlc2lyZWRUYXNrQ291bnQ6IDEsXG4gICAgICAgICAgICByZWdpb246IHJlZ2lvbixcbiAgICAgICAgICAgIHNlY3VyaXR5R3JvdXA6IGVjc1NlcnZpY2VzU2VjdXJpdHlHcm91cFxuICAgICAgICB9KVxuICAgICAgICB0cmFmZmljR2VuZXJhdG9yU2VydmljZS50YXNrRGVmaW5pdGlvbi50YXNrUm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3kocmVhZFNTTVBhcmFtc1BvbGljeSk7XG5cbiAgICAgICAgLy9QZXRTdGF0dXNVcGRhdGVyIExhbWJkYSBGdW5jdGlvbiBhbmQgQVBJR1ctLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBjb25zdCBzdGF0dXNVcGRhdGVyU2VydmljZSA9IG5ldyBTdGF0dXNVcGRhdGVyU2VydmljZSh0aGlzLCAnc3RhdHVzLXVwZGF0ZXItc2VydmljZScsIHtcbiAgICAgICAgICAgIHRhYmxlTmFtZTogZHluYW1vZGJfcGV0YWRvcHRpb24udGFibGVOYW1lXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgY29uc3QgYWxiU0cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0FMQlNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICAgICAgICB2cGM6IHRoZVZQQyxcbiAgICAgICAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiAnQUxCU2VjdXJpdHlHcm91cCcsXG4gICAgICAgICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBhbGJTRy5hZGRJbmdyZXNzUnVsZShlYzIuUGVlci5hbnlJcHY0KCksIGVjMi5Qb3J0LnRjcCg4MCkpO1xuXG4gICAgICAgIC8vIFBldFNpdGUgLSBDcmVhdGUgQUxCIGFuZCBUYXJnZXQgR3JvdXBzXG4gICAgICAgIGNvbnN0IGFsYiA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcih0aGlzLCAnUGV0U2l0ZUxvYWRCYWxhbmNlcicsIHtcbiAgICAgICAgICAgIHZwYzogdGhlVlBDLFxuICAgICAgICAgICAgaW50ZXJuZXRGYWNpbmc6IHRydWUsXG4gICAgICAgICAgICBzZWN1cml0eUdyb3VwOiBhbGJTR1xuICAgICAgICB9KTtcbiAgICAgICAgdHJhZmZpY0dlbmVyYXRvclNlcnZpY2Uubm9kZS5hZGREZXBlbmRlbmN5KGFsYik7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLCAnUGV0U2l0ZVRhcmdldEdyb3VwJywge1xuICAgICAgICAgICAgcG9ydDogODAsXG4gICAgICAgICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgICAgICAgdnBjOiB0aGVWUEMsXG4gICAgICAgICAgICB0YXJnZXRUeXBlOiBlbGJ2Mi5UYXJnZXRUeXBlLklQXG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgXCJwdXRQYXJhbVRhcmdldEdyb3VwQXJuXCIsIHtcbiAgICAgICAgICAgIHN0cmluZ1ZhbHVlOiB0YXJnZXRHcm91cC50YXJnZXRHcm91cEFybixcbiAgICAgICAgICAgIHBhcmFtZXRlck5hbWU6ICcvZWtzL3BldHNpdGUvVGFyZ2V0R3JvdXBBcm4nXG4gICAgICAgIH0pXG5cbiAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBhbGIuYWRkTGlzdGVuZXIoJ0xpc3RlbmVyJywge1xuICAgICAgICAgICAgcG9ydDogODAsXG4gICAgICAgICAgICBvcGVuOiB0cnVlLFxuICAgICAgICAgICAgZGVmYXVsdFRhcmdldEdyb3VwczogW3RhcmdldEdyb3VwXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUGV0QWRvcHRpb25IaXN0b3J5IC0gYXR0YWNoIHNlcnZpY2UgdG8gcGF0aCAvcGV0YWRvcHRpb25oaXN0b3J5IG9uIFBldFNpdGUgQUxCXG4gICAgICAgIGNvbnN0IHBldGFkb3B0aW9uc2hpc3RvcnlfdGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLCAnUGV0QWRvcHRpb25zSGlzdG9yeVRhcmdldEdyb3VwJywge1xuICAgICAgICAgICAgcG9ydDogODAsXG4gICAgICAgICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgICAgICAgdnBjOiB0aGVWUEMsXG4gICAgICAgICAgICB0YXJnZXRUeXBlOiBlbGJ2Mi5UYXJnZXRUeXBlLklQLFxuICAgICAgICAgICAgaGVhbHRoQ2hlY2s6IHtcbiAgICAgICAgICAgICAgICBwYXRoOiAnL2hlYWx0aC9zdGF0dXMnLFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBsaXN0ZW5lci5hZGRUYXJnZXRHcm91cHMoJ1BldEFkb3B0aW9uc0hpc3RvcnlUYXJnZXRHcm91cHMnLCB7XG4gICAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgICAgICBjb25kaXRpb25zOiBbXG4gICAgICAgICAgICAgICAgZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFsnL3BldGFkb3B0aW9uc2hpc3RvcnkvKiddKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB0YXJnZXRHcm91cHM6IFtwZXRhZG9wdGlvbnNoaXN0b3J5X3RhcmdldEdyb3VwXVxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCBcInB1dFBldEhpc3RvcnlQYXJhbVRhcmdldEdyb3VwQXJuXCIsIHtcbiAgICAgICAgICAgIHN0cmluZ1ZhbHVlOiBwZXRhZG9wdGlvbnNoaXN0b3J5X3RhcmdldEdyb3VwLnRhcmdldEdyb3VwQXJuLFxuICAgICAgICAgICAgcGFyYW1ldGVyTmFtZTogJy9la3MvcGV0aGlzdG9yeS9UYXJnZXRHcm91cEFybidcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUGV0U2l0ZSAtIEVLUyBDbHVzdGVyXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJBZG1pbiA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQWRtaW5Sb2xlJywge1xuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkFjY291bnRSb290UHJpbmNpcGFsKClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgXCJwdXRQYXJhbVwiLCB7XG4gICAgICAgICAgICBzdHJpbmdWYWx1ZTogY2x1c3RlckFkbWluLnJvbGVBcm4sXG4gICAgICAgICAgICBwYXJhbWV0ZXJOYW1lOiAnL2Vrcy9wZXRzaXRlL0VLU01hc3RlclJvbGVBcm4nXG4gICAgICAgIH0pXG5cbiAgICAgICAgY29uc3Qgc2VjcmV0c0tleSA9IG5ldyBrbXMuS2V5KHRoaXMsICdTZWNyZXRzS2V5Jyk7XG4gICAgICAgIGNvbnN0IGNsdXN0ZXIgPSBuZXcgZWtzLkNsdXN0ZXIodGhpcywgJ3BldHNpdGUnLCB7XG4gICAgICAgICAgICBjbHVzdGVyTmFtZTogJ1BldFNpdGUnLFxuICAgICAgICAgICAgbWFzdGVyc1JvbGU6IGNsdXN0ZXJBZG1pbixcbiAgICAgICAgICAgIHZwYzogdGhlVlBDLFxuICAgICAgICAgICAgZGVmYXVsdENhcGFjaXR5OiAwLFxuICAgICAgICAgICAgLy8gZGVmYXVsdENhcGFjaXR5SW5zdGFuY2U6IGVjMi5JbnN0YW5jZVR5cGUub2YoZWMyLkluc3RhbmNlQ2xhc3MuTTUsIGVjMi5JbnN0YW5jZVNpemUuWExBUkdFKSxcbiAgICAgICAgICAgIHNlY3JldHNFbmNyeXB0aW9uS2V5OiBzZWNyZXRzS2V5LFxuICAgICAgICAgICAgdmVyc2lvbjogS3ViZXJuZXRlc1ZlcnNpb24ub2YoJzEuMjcnKSxcbiAgICAgICAgICAgIGt1YmVjdGxMYXllcjogbmV3IEt1YmVjdGxMYXllcih0aGlzLCAna3ViZWN0bCcpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGVrc09wdGltaXplZEltYWdlID0gbmV3IGVrcy5Fa3NPcHRpbWl6ZWRJbWFnZSgvKiBhbGwgb3B0aW9uYWwgcHJvcHMgKi8ge1xuICAgICAgICAgICAgY3B1QXJjaDogZWtzLkNwdUFyY2guWDg2XzY0LFxuICAgICAgICAgICAga3ViZXJuZXRlc1ZlcnNpb246ICcxLjI3JyxcbiAgICAgICAgICAgIG5vZGVUeXBlOiBla3MuTm9kZVR5cGUuU1RBTkRBUkQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHVzZXJEYXRhID0gZWMyLlVzZXJEYXRhLmZvckxpbnV4KCk7XG4gICAgICAgIHVzZXJEYXRhLmFkZENvbW1hbmRzKGAvZXRjL2Vrcy9ib290c3RyYXAuc2ggJHtjbHVzdGVyLmNsdXN0ZXJOYW1lfSAtLW5vZGUtbGFiZWxzIEF6SW1wYWlybWVudFBvd2VyPVJlYWR5LGZvbz1iYXIsZ29vPWZhcmApO1xuXG4gICAgICAgIGNvbnN0IGVrc1BldFNpdGVsdCA9IG5ldyBlYzIuTGF1bmNoVGVtcGxhdGUodGhpcywgJ2Vrc1BldFNpdGVsdCcsIHtcbiAgICAgICAgICAgIG1hY2hpbmVJbWFnZTogZWtzT3B0aW1pemVkSW1hZ2UsXG4gICAgICAgICAgICBpbnN0YW5jZVR5cGU6IG5ldyBlYzIuSW5zdGFuY2VUeXBlKCdtNS54bGFyZ2UnKSxcbiAgICAgICAgICAgIHVzZXJEYXRhOiB1c2VyRGF0YSxcbiAgICAgICAgICAgIC8vICAgcm9sZTogZWtzUGV0U2l0ZVJvbGUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZGluZyBDbHVzdGVyTm9kZUdyb3VwUm9sZVxuICAgICAgICAvLyBBZGQgU1NNIFBlcm1pc3Npb25zIHRvIHRoZSBub2RlIHJvbGUgYW5kIEVLUyBOb2RlIHJlcXVpcmVkIHBlcm1pc3Npb25zXG4gICAgICAgIGNvbnN0IGVrc1BldHNpdGVBU0dDbHVzdGVyTm9kZUdyb3VwUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnZWtzUGV0c2l0ZUFTR0NsdXN0ZXJOb2RlR3JvdXBSb2xlJywge1xuICAgICAgICAgICAgcm9sZU5hbWU6ICdla3NQZXRzaXRlQVNHQ2x1c3Rlck5vZGVHcm91cFJvbGUnLFxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2VjMi5hbWF6b25hd3MuY29tJyksXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvblNTTU1hbmFnZWRJbnN0YW5jZUNvcmUnKSxcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvbkVLU1dvcmtlck5vZGVQb2xpY3knKSxcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvbkVDMkNvbnRhaW5lclJlZ2lzdHJ5UmVhZE9ubHknKSxcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvbkVLU19DTklfUG9saWN5JyksXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICAgICAgLy8gQ3JlYXRlIG5vZGVHcm91cCBwcm9wZXJ0aWVzXG4gICAgICAgIGNvbnN0IGVrc1BldFNpdGVOb2RlZ3JvdXBQcm9wcyA9IHtcbiAgICAgICAgICAgIGNsdXN0ZXI6IGNsdXN0ZXIsXG4gICAgICAgICAgICBsYXVuY2hUZW1wbGF0ZVNwZWM6IHtcbiAgICAgICAgICAgICAgICBpZDogZWtzUGV0U2l0ZWx0LmxhdW5jaFRlbXBsYXRlSWQhLFxuICAgICAgICAgICAgICAgIHZlcnNpb246IGVrc1BldFNpdGVsdC5sYXRlc3RWZXJzaW9uTnVtYmVyLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxhYmVsczoge1xuICAgICAgICAgICAgICAgIFtcIkF6SW1wYWlybWVudFBvd2VyXCJdOiBcIlJlYWR5XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGVzaXJlZFNpemU6IDIsXG4gICAgICAgICAgICBtYXhTaXplOiAyLFxuICAgICAgICAgICAgdGFnczoge1xuICAgICAgICAgICAgICAgIFtcIkF6SW1wYWlybWVudFBvd2VyXCJdOiBcIlJlYWR5XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVJvbGU6IGVrc1BldHNpdGVBU0dDbHVzdGVyTm9kZUdyb3VwUm9sZSxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGRpbmcgTm9kZSBHcm91cFxuICAgICAgICBjb25zdCBla3NQZXRzaXRlQVNHQ2x1c3Rlck5vZGVHcm91cCA9IG5ldyBla3MuTm9kZWdyb3VwKHRoaXMsICdla3NQZXRzaXRlQVNHQ2x1c3Rlck5vZGVHcm91cCcsIGVrc1BldFNpdGVOb2RlZ3JvdXBQcm9wcyk7XG5cbiAgICAgICAgLy8gVGFnZ2luZyAgTm9kZSBHcm91cCByZXNvdXJjZXMgaHR0cHM6Ly9jbGFzc2ljLnlhcm5wa2cuY29tL2VuL3BhY2thZ2UvZWtzLW5vZGVncm91cC1hc2ctdGFncy1jZGtcbiAgICAgICAgbmV3IE5vZGVncm91cEFzZ1RhZ3ModGhpcywgJ3BldFNpdGVOb2RlR3JvdXBBc2dUYWdzJywge1xuICAgICAgICAgICAgY2x1c3RlcjogY2x1c3RlcixcbiAgICAgICAgICAgIG5vZGVncm91cDogZWtzUGV0c2l0ZUFTR0NsdXN0ZXJOb2RlR3JvdXAsXG4gICAgICAgICAgICBub2RlZ3JvdXBQcm9wczogZWtzUGV0U2l0ZU5vZGVncm91cFByb3BzLFxuICAgICAgICAgICAgc2V0Q2x1c3RlckF1dG9zY2FsZXJUYWdzRm9yTm9kZUxhYmVsczogdHJ1ZSxcbiAgICAgICAgICAgIHNldENsdXN0ZXJBdXRvc2NhbGVyVGFnc0Zvck5vZGVUYWludHM6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgICAgICAgJ0F6SW1wYWlybWVudFBvd2VyJzogJ1JlYWR5JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJTRyA9IGVjMi5TZWN1cml0eUdyb3VwLmZyb21TZWN1cml0eUdyb3VwSWQodGhpcywgJ0NsdXN0ZXJTRycsIGNsdXN0ZXIuY2x1c3RlclNlY3VyaXR5R3JvdXBJZCk7XG4gICAgICAgIGNsdXN0ZXJTRy5hZGRJbmdyZXNzUnVsZShhbGJTRywgZWMyLlBvcnQuYWxsVHJhZmZpYygpLCAnQWxsb3cgdHJhZmZpYyBmcm9tIHRoZSBBTEInKTtcbiAgICAgICAgY2x1c3RlclNHLmFkZEluZ3Jlc3NSdWxlKGVjMi5QZWVyLmlwdjQodGhlVlBDLnZwY0NpZHJCbG9jayksIGVjMi5Qb3J0LnRjcCg0NDMpLCAnQWxsb3cgbG9jYWwgYWNjZXNzIHRvIGs4cyBhcGknKTtcblxuXG4gICAgICAgIC8vIEZyb20gaHR0cHM6Ly9naXRodWIuY29tL2F3cy1zYW1wbGVzL3NzbS1hZ2VudC1kYWVtb25zZXQtaW5zdGFsbGVyXG4gICAgICAgIHZhciBzc21BZ2VudFNldHVwID0geWFtbC5sb2FkQWxsKHJlYWRGaWxlU3luYyhcIi4vcmVzb3VyY2VzL3NldHVwLXNzbS1hZ2VudC55YW1sXCIsIFwidXRmOFwiKSkgYXMgUmVjb3JkPHN0cmluZywgYW55PltdO1xuXG4gICAgICAgIGNvbnN0IHNzbUFnZW50U2V0dXBNYW5pZmVzdCA9IG5ldyBla3MuS3ViZXJuZXRlc01hbmlmZXN0KHRoaXMsIFwic3NtQWdlbnRkZXBsb3ltZW50XCIsIHtcbiAgICAgICAgICAgIGNsdXN0ZXI6IGNsdXN0ZXIsXG4gICAgICAgICAgICBtYW5pZmVzdDogc3NtQWdlbnRTZXR1cFxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgLy8gQ2x1c3RlcklEIGlzIG5vdCBhdmFpbGFibGUgZm9yIGNyZWF0aW5nIHRoZSBwcm9wZXIgY29uZGl0aW9ucyBodHRwczovL2dpdGh1Yi5jb20vYXdzL2F3cy1jZGsvaXNzdWVzLzEwMzQ3XG4gICAgICAgIGNvbnN0IGNsdXN0ZXJJZCA9IEZuLnNlbGVjdCg0LCBGbi5zcGxpdCgnLycsIGNsdXN0ZXIuY2x1c3Rlck9wZW5JZENvbm5lY3RJc3N1ZXJVcmwpKSAvLyBSZW1vdmUgaHR0cHM6Ly8gZnJvbSB0aGUgVVJMIGFzIHdvcmthcm91bmQgdG8gZ2V0IENsdXN0ZXJJRFxuXG4gICAgICAgIGNvbnN0IGN3X2ZlZGVyYXRlZFByaW5jaXBhbCA9IG5ldyBpYW0uRmVkZXJhdGVkUHJpbmNpcGFsKFxuICAgICAgICAgICAgY2x1c3Rlci5vcGVuSWRDb25uZWN0UHJvdmlkZXIub3BlbklkQ29ubmVjdFByb3ZpZGVyQXJuLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFN0cmluZ0VxdWFsczogbmV3IENmbkpzb24odGhpcywgXCJDV19GZWRlcmF0ZWRQcmluY2lwYWxDb25kaXRpb25cIiwge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgW2BvaWRjLmVrcy4ke3JlZ2lvbn0uYW1hem9uYXdzLmNvbS9pZC8ke2NsdXN0ZXJJZH06YXVkYF06IFwic3RzLmFtYXpvbmF3cy5jb21cIlxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgY3dfdHJ1c3RSZWxhdGlvbnNoaXAgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBwcmluY2lwYWxzOiBbY3dfZmVkZXJhdGVkUHJpbmNpcGFsXSxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcInN0czpBc3N1bWVSb2xlV2l0aFdlYklkZW50aXR5XCJdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIENyZWF0ZSBJQU0gcm9sZXMgZm9yIFNlcnZpY2UgQWNjb3VudHNcbiAgICAgICAgLy8gQ2xvdWR3YXRjaCBBZ2VudCBTQVxuICAgICAgICBjb25zdCBjd3NlcnZpY2VhY2NvdW50ID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdDV1NlcnZpY2VBY2NvdW50Jywge1xuICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgYXNzdW1lZEJ5OiBla3NGZWRlcmF0ZWRQcmluY2lwYWwsXG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uQWNjb3VudFJvb3RQcmluY2lwYWwoKSxcbiAgICAgICAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21NYW5hZ2VkUG9saWN5QXJuKHRoaXMsICdDV1NlcnZpY2VBY2NvdW50LUNsb3VkV2F0Y2hBZ2VudFNlcnZlclBvbGljeScsICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9DbG91ZFdhdGNoQWdlbnRTZXJ2ZXJQb2xpY3knKVxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgICAgIGN3c2VydmljZWFjY291bnQuYXNzdW1lUm9sZVBvbGljeT8uYWRkU3RhdGVtZW50cyhjd190cnVzdFJlbGF0aW9uc2hpcCk7XG5cbiAgICAgICAgY29uc3QgeHJheV9mZWRlcmF0ZWRQcmluY2lwYWwgPSBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgICAgIGNsdXN0ZXIub3BlbklkQ29ubmVjdFByb3ZpZGVyLm9wZW5JZENvbm5lY3RQcm92aWRlckFybixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBTdHJpbmdFcXVhbHM6IG5ldyBDZm5Kc29uKHRoaXMsIFwiWHJheV9GZWRlcmF0ZWRQcmluY2lwYWxDb25kaXRpb25cIiwge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgW2BvaWRjLmVrcy4ke3JlZ2lvbn0uYW1hem9uYXdzLmNvbS9pZC8ke2NsdXN0ZXJJZH06YXVkYF06IFwic3RzLmFtYXpvbmF3cy5jb21cIlxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgeHJheV90cnVzdFJlbGF0aW9uc2hpcCA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIHByaW5jaXBhbHM6IFt4cmF5X2ZlZGVyYXRlZFByaW5jaXBhbF0sXG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eVwiXVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBYLVJheSBBZ2VudCBTQVxuICAgICAgICBjb25zdCB4cmF5c2VydmljZWFjY291bnQgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1hSYXlTZXJ2aWNlQWNjb3VudCcsIHtcbiAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgIGFzc3VtZWRCeTogZWtzRmVkZXJhdGVkUHJpbmNpcGFsLFxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkFjY291bnRSb290UHJpbmNpcGFsKCksXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tTWFuYWdlZFBvbGljeUFybih0aGlzLCAnWFJheVNlcnZpY2VBY2NvdW50LUFXU1hSYXlEYWVtb25Xcml0ZUFjY2VzcycsICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9BV1NYUmF5RGFlbW9uV3JpdGVBY2Nlc3MnKVxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgICAgIHhyYXlzZXJ2aWNlYWNjb3VudC5hc3N1bWVSb2xlUG9saWN5Py5hZGRTdGF0ZW1lbnRzKHhyYXlfdHJ1c3RSZWxhdGlvbnNoaXApO1xuXG4gICAgICAgIGNvbnN0IGxvYWRiYWxhbmNlcl9mZWRlcmF0ZWRQcmluY2lwYWwgPSBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgICAgIGNsdXN0ZXIub3BlbklkQ29ubmVjdFByb3ZpZGVyLm9wZW5JZENvbm5lY3RQcm92aWRlckFybixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBTdHJpbmdFcXVhbHM6IG5ldyBDZm5Kc29uKHRoaXMsIFwiTEJfRmVkZXJhdGVkUHJpbmNpcGFsQ29uZGl0aW9uXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFtgb2lkYy5la3MuJHtyZWdpb259LmFtYXpvbmF3cy5jb20vaWQvJHtjbHVzdGVySWR9OmF1ZGBdOiBcInN0cy5hbWF6b25hd3MuY29tXCJcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGxvYWRCYWxhbmNlcl90cnVzdFJlbGF0aW9uc2hpcCA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIHByaW5jaXBhbHM6IFtsb2FkYmFsYW5jZXJfZmVkZXJhdGVkUHJpbmNpcGFsXSxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcInN0czpBc3N1bWVSb2xlV2l0aFdlYklkZW50aXR5XCJdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGxvYWRCYWxhbmNlclBvbGljeURvYyA9IGlhbS5Qb2xpY3lEb2N1bWVudC5mcm9tSnNvbihKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhcIi4vcmVzb3VyY2VzL2xvYWRfYmFsYW5jZXIvaWFtX3BvbGljeS5qc29uXCIsIFwidXRmOFwiKSkpO1xuICAgICAgICBjb25zdCBsb2FkQmFsYW5jZXJQb2xpY3kgPSBuZXcgaWFtLk1hbmFnZWRQb2xpY3kodGhpcywgJ0xvYWRCYWxhbmNlclNBUG9saWN5JywgeyBkb2N1bWVudDogbG9hZEJhbGFuY2VyUG9saWN5RG9jIH0pO1xuICAgICAgICBjb25zdCBsb2FkQmFsYW5jZXJzZXJ2aWNlYWNjb3VudCA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTG9hZEJhbGFuY2VyU2VydmljZUFjY291bnQnLCB7XG4gICAgICAgICAgICAvLyAgICAgICAgICAgICAgICBhc3N1bWVkQnk6IGVrc0ZlZGVyYXRlZFByaW5jaXBhbCxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5BY2NvdW50Um9vdFByaW5jaXBhbCgpLFxuICAgICAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbbG9hZEJhbGFuY2VyUG9saWN5XVxuICAgICAgICB9KTtcblxuICAgICAgICBsb2FkQmFsYW5jZXJzZXJ2aWNlYWNjb3VudC5hc3N1bWVSb2xlUG9saWN5Py5hZGRTdGF0ZW1lbnRzKGxvYWRCYWxhbmNlcl90cnVzdFJlbGF0aW9uc2hpcCk7XG5cbiAgICAgICAgLy8gRml4IGZvciBFS1MgRGFzaGJvYXJkIGFjY2Vzc1xuXG4gICAgICAgIGNvbnN0IGRhc2hib2FyZFJvbGVZYW1sID0geWFtbC5sb2FkQWxsKHJlYWRGaWxlU3luYyhcIi4vcmVzb3VyY2VzL2Rhc2hib2FyZC55YW1sXCIsIFwidXRmOFwiKSkgYXMgUmVjb3JkPHN0cmluZywgYW55PltdO1xuXG4gICAgICAgIGNvbnN0IGRhc2hib2FyZFJvbGVBcm4gPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnZGFzaGJvYXJkX3JvbGVfYXJuJyk7XG4gICAgICAgIGlmICgoZGFzaGJvYXJkUm9sZUFybiAhPSB1bmRlZmluZWQpICYmIChkYXNoYm9hcmRSb2xlQXJuLmxlbmd0aCA+IDApKSB7XG4gICAgICAgICAgICBjb25zdCByb2xlID0gaWFtLlJvbGUuZnJvbVJvbGVBcm4odGhpcywgXCJEYXNoYm9hcmRSb2xlQXJuXCIsIGRhc2hib2FyZFJvbGVBcm4sIHsgbXV0YWJsZTogZmFsc2UgfSk7XG4gICAgICAgICAgICBjbHVzdGVyLmF3c0F1dGguYWRkUm9sZU1hcHBpbmcocm9sZSwgeyBncm91cHM6IFtcImRhc2hib2FyZC12aWV3XCJdIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzRXZlbnRFbmdpbmUgPT09ICd0cnVlJykge1xuICAgICAgICAgICAgdmFyIGM5RW52ID0gbmV3IENsb3VkOUVudmlyb25tZW50KHRoaXMsICdDbG91ZDlFbnZpcm9ubWVudCcsIHtcbiAgICAgICAgICAgICAgICB2cGNJZDogdGhlVlBDLnZwY0lkLFxuICAgICAgICAgICAgICAgIHN1Ym5ldElkOiB0aGVWUEMucHVibGljU3VibmV0c1swXS5zdWJuZXRJZCxcbiAgICAgICAgICAgICAgICBjbG91ZDlPd25lckFybjogXCJhc3N1bWVkLXJvbGUvV1NQYXJ0aWNpcGFudFJvbGUvUGFydGljaXBhbnRcIixcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZUZpbGU6IF9fZGlybmFtZSArIFwiLy4uLy4uLy4uLy4uL2Nsb3VkOS1jZm4ueWFtbFwiXG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2YXIgYzlyb2xlID0gYzlFbnYuYzlSb2xlO1xuXG4gICAgICAgICAgICAvLyBEeW5hbWljYWxseSBjaGVjayBpZiBBV1NDbG91ZDlTU01BY2Nlc3NSb2xlIGFuZCBBV1NDbG91ZDlTU01JbnN0YW5jZVByb2ZpbGUgZXhpc3RzXG4gICAgICAgICAgICBjb25zdCBjOVNTTVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FXU0Nsb3VkOVNTTUFjY2Vzc1JvbGUnLCB7XG4gICAgICAgICAgICAgICAgcGF0aDogJy9zZXJ2aWNlLXJvbGUvJyxcbiAgICAgICAgICAgICAgICByb2xlTmFtZTogJ0FXU0Nsb3VkOVNTTUFjY2Vzc1JvbGUnLFxuICAgICAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5Db21wb3NpdGVQcmluY2lwYWwobmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiZWMyLmFtYXpvbmF3cy5jb21cIiksIG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImNsb3VkOS5hbWF6b25hd3MuY29tXCIpKSxcbiAgICAgICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJBV1NDbG91ZDlTU01JbnN0YW5jZVByb2ZpbGVcIiksIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcIkFkbWluaXN0cmF0b3JBY2Nlc3NcIildXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgdGVhbVJvbGUgPSBpYW0uUm9sZS5mcm9tUm9sZUFybih0aGlzLCAnVGVhbVJvbGUnLCBcImFybjphd3M6aWFtOjpcIiArIHN0YWNrLmFjY291bnQgKyBcIjpyb2xlL1dTUGFydGljaXBhbnRSb2xlXCIpO1xuICAgICAgICAgICAgY2x1c3Rlci5hd3NBdXRoLmFkZFJvbGVNYXBwaW5nKHRlYW1Sb2xlLCB7IGdyb3VwczogW1wiZGFzaGJvYXJkLXZpZXdcIl0gfSk7XG5cblxuICAgICAgICAgICAgaWYgKGM5cm9sZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjbHVzdGVyLmF3c0F1dGguYWRkTWFzdGVyc1JvbGUoaWFtLlJvbGUuZnJvbVJvbGVBcm4odGhpcywgJ2M5cm9sZScsIGM5cm9sZS5hdHRyQXJuLCB7IG11dGFibGU6IGZhbHNlIH0pKTtcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBla3NBZG1pbkFybiA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdhZG1pbl9yb2xlJyk7XG4gICAgICAgIGxldCBFS1NfQURNSU5fQVJOID0gJyc7XG4gICAgICAgIGlmICgoZWtzQWRtaW5Bcm4gIT0gdW5kZWZpbmVkKSAmJiAoZWtzQWRtaW5Bcm4ubGVuZ3RoID4gMCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvbGUgPSBpYW0uUm9sZS5mcm9tUm9sZUFybih0aGlzLCBcImVrZEFkbWluUm9sZUFyblwiLCBla3NBZG1pbkFybiwgeyBtdXRhYmxlOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIGNsdXN0ZXIuYXdzQXV0aC5hZGRNYXN0ZXJzUm9sZShyb2xlKTtcbiAgICAgICAgICAgIEVLU19BRE1JTl9BUk4gPSBla3NBZG1pbkFybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRhaHNoYm9hcmRNYW5pZmVzdCA9IG5ldyBla3MuS3ViZXJuZXRlc01hbmlmZXN0KHRoaXMsIFwiazhzZGFzaGJvYXJkcmJhY1wiLCB7XG4gICAgICAgICAgICBjbHVzdGVyOiBjbHVzdGVyLFxuICAgICAgICAgICAgbWFuaWZlc3Q6IGRhc2hib2FyZFJvbGVZYW1sXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgdmFyIHhSYXlZYW1sID0geWFtbC5sb2FkQWxsKHJlYWRGaWxlU3luYyhcIi4vcmVzb3VyY2VzL2s4c19wZXRzaXRlL3hyYXktZGFlbW9uLWNvbmZpZy55YW1sXCIsIFwidXRmOFwiKSkgYXMgUmVjb3JkPHN0cmluZywgYW55PltdO1xuXG4gICAgICAgIHhSYXlZYW1sWzBdLm1ldGFkYXRhLmFubm90YXRpb25zW1wiZWtzLmFtYXpvbmF3cy5jb20vcm9sZS1hcm5cIl0gPSBuZXcgQ2ZuSnNvbih0aGlzLCBcInhyYXlfUm9sZVwiLCB7IHZhbHVlOiBgJHt4cmF5c2VydmljZWFjY291bnQucm9sZUFybn1gIH0pO1xuXG4gICAgICAgIGNvbnN0IHhyYXlNYW5pZmVzdCA9IG5ldyBla3MuS3ViZXJuZXRlc01hbmlmZXN0KHRoaXMsIFwieHJheWRlcGxveW1lbnRcIiwge1xuICAgICAgICAgICAgY2x1c3RlcjogY2x1c3RlcixcbiAgICAgICAgICAgIG1hbmlmZXN0OiB4UmF5WWFtbFxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgbG9hZEJhbGFuY2VyU2VydmljZUFjY291bnRZYW1sID0geWFtbC5sb2FkQWxsKHJlYWRGaWxlU3luYyhcIi4vcmVzb3VyY2VzL2xvYWRfYmFsYW5jZXIvc2VydmljZV9hY2NvdW50LnlhbWxcIiwgXCJ1dGY4XCIpKSBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+W107XG4gICAgICAgIGxvYWRCYWxhbmNlclNlcnZpY2VBY2NvdW50WWFtbFswXS5tZXRhZGF0YS5hbm5vdGF0aW9uc1tcImVrcy5hbWF6b25hd3MuY29tL3JvbGUtYXJuXCJdID0gbmV3IENmbkpzb24odGhpcywgXCJsb2FkQmFsYW5jZXJfUm9sZVwiLCB7IHZhbHVlOiBgJHtsb2FkQmFsYW5jZXJzZXJ2aWNlYWNjb3VudC5yb2xlQXJufWAgfSk7XG5cbiAgICAgICAgY29uc3QgbG9hZEJhbGFuY2VyU2VydmljZUFjY291bnQgPSBuZXcgZWtzLkt1YmVybmV0ZXNNYW5pZmVzdCh0aGlzLCBcImxvYWRCYWxhbmNlclNlcnZpY2VBY2NvdW50XCIsIHtcbiAgICAgICAgICAgIGNsdXN0ZXI6IGNsdXN0ZXIsXG4gICAgICAgICAgICBtYW5pZmVzdDogbG9hZEJhbGFuY2VyU2VydmljZUFjY291bnRZYW1sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHdhaXRGb3JMQlNlcnZpY2VBY2NvdW50ID0gbmV3IGVrcy5LdWJlcm5ldGVzT2JqZWN0VmFsdWUodGhpcywgJ0xCU2VydmljZUFjY291bnQnLCB7XG4gICAgICAgICAgICBjbHVzdGVyOiBjbHVzdGVyLFxuICAgICAgICAgICAgb2JqZWN0TmFtZTogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICAgICAgICBvYmplY3RUeXBlOiBcInNlcnZpY2VhY2NvdW50XCIsXG4gICAgICAgICAgICBvYmplY3ROYW1lc3BhY2U6IFwia3ViZS1zeXN0ZW1cIixcbiAgICAgICAgICAgIGpzb25QYXRoOiBcIkBcIlxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBsb2FkQmFsYW5jZXJDUkRZYW1sID0geWFtbC5sb2FkQWxsKHJlYWRGaWxlU3luYyhcIi4vcmVzb3VyY2VzL2xvYWRfYmFsYW5jZXIvY3Jkcy55YW1sXCIsIFwidXRmOFwiKSkgYXMgUmVjb3JkPHN0cmluZywgYW55PltdO1xuICAgICAgICBjb25zdCBsb2FkQmFsYW5jZXJDUkRNYW5pZmVzdCA9IG5ldyBla3MuS3ViZXJuZXRlc01hbmlmZXN0KHRoaXMsIFwibG9hZEJhbGFuY2VyQ1JEXCIsIHtcbiAgICAgICAgICAgIGNsdXN0ZXI6IGNsdXN0ZXIsXG4gICAgICAgICAgICBtYW5pZmVzdDogbG9hZEJhbGFuY2VyQ1JEWWFtbFxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGNvbnN0IGF3c0xvYWRCYWxhbmNlck1hbmlmZXN0ID0gbmV3IGVrcy5IZWxtQ2hhcnQodGhpcywgXCJBV1NMb2FkQmFsYW5jZXJDb250cm9sbGVyXCIsIHtcbiAgICAgICAgICAgIGNsdXN0ZXI6IGNsdXN0ZXIsXG4gICAgICAgICAgICBjaGFydDogXCJhd3MtbG9hZC1iYWxhbmNlci1jb250cm9sbGVyXCIsXG4gICAgICAgICAgICByZXBvc2l0b3J5OiBcImh0dHBzOi8vYXdzLmdpdGh1Yi5pby9la3MtY2hhcnRzXCIsXG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwia3ViZS1zeXN0ZW1cIixcbiAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgIGNsdXN0ZXJOYW1lOiBcIlBldFNpdGVcIixcbiAgICAgICAgICAgICAgICBzZXJ2aWNlQWNjb3VudDoge1xuICAgICAgICAgICAgICAgICAgICBjcmVhdGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcImFsYi1pbmdyZXNzLWNvbnRyb2xsZXJcIlxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgd2FpdDogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXdzTG9hZEJhbGFuY2VyTWFuaWZlc3Qubm9kZS5hZGREZXBlbmRlbmN5KGxvYWRCYWxhbmNlckNSRE1hbmlmZXN0KTtcbiAgICAgICAgYXdzTG9hZEJhbGFuY2VyTWFuaWZlc3Qubm9kZS5hZGREZXBlbmRlbmN5KGxvYWRCYWxhbmNlclNlcnZpY2VBY2NvdW50KTtcbiAgICAgICAgYXdzTG9hZEJhbGFuY2VyTWFuaWZlc3Qubm9kZS5hZGREZXBlbmRlbmN5KHdhaXRGb3JMQlNlcnZpY2VBY2NvdW50KTtcblxuICAgICAgICAvLyBOT1RFOiBhbWF6b24tY2xvdWR3YXRjaCBuYW1lc3BhY2UgaXMgY3JlYXRlZCBoZXJlISFcbiAgICAgICAgdmFyIGZsdWVudGJpdFlhbWwgPSB5YW1sLmxvYWRBbGwocmVhZEZpbGVTeW5jKFwiLi9yZXNvdXJjZXMvY3dhZ2VudC1mbHVlbnQtYml0LXF1aWNrc3RhcnQueWFtbFwiLCBcInV0ZjhcIikpIGFzIFJlY29yZDxzdHJpbmcsIGFueT5bXTtcbiAgICAgICAgZmx1ZW50Yml0WWFtbFsxXS5tZXRhZGF0YS5hbm5vdGF0aW9uc1tcImVrcy5hbWF6b25hd3MuY29tL3JvbGUtYXJuXCJdID0gbmV3IENmbkpzb24odGhpcywgXCJmbHVlbnRiaXRfUm9sZVwiLCB7IHZhbHVlOiBgJHtjd3NlcnZpY2VhY2NvdW50LnJvbGVBcm59YCB9KTtcblxuICAgICAgICBmbHVlbnRiaXRZYW1sWzRdLmRhdGFbXCJjd2FnZW50Y29uZmlnLmpzb25cIl0gPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBhZ2VudDoge1xuICAgICAgICAgICAgICAgIHJlZ2lvbjogcmVnaW9uXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbG9nczoge1xuICAgICAgICAgICAgICAgIG1ldHJpY3NfY29sbGVjdGVkOiB7XG4gICAgICAgICAgICAgICAgICAgIGt1YmVybmV0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJfbmFtZTogXCJQZXRTaXRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRyaWNzX2NvbGxlY3Rpb25faW50ZXJ2YWw6IDYwXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZvcmNlX2ZsdXNoX2ludGVydmFsOiA1XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgICAgICBmbHVlbnRiaXRZYW1sWzZdLmRhdGFbXCJjbHVzdGVyLm5hbWVcIl0gPSBcIlBldFNpdGVcIjtcbiAgICAgICAgZmx1ZW50Yml0WWFtbFs2XS5kYXRhW1wibG9ncy5yZWdpb25cIl0gPSByZWdpb247XG4gICAgICAgIGZsdWVudGJpdFlhbWxbN10ubWV0YWRhdGEuYW5ub3RhdGlvbnNbXCJla3MuYW1hem9uYXdzLmNvbS9yb2xlLWFyblwiXSA9IG5ldyBDZm5Kc29uKHRoaXMsIFwiY2xvdWR3YXRjaF9Sb2xlXCIsIHsgdmFsdWU6IGAke2N3c2VydmljZWFjY291bnQucm9sZUFybn1gIH0pO1xuXG4gICAgICAgIC8vIFRoZSBgY2x1c3Rlci1pbmZvYCBjb25maWdtYXAgaXMgdXNlZCBieSB0aGUgY3VycmVudCBQeXRob24gaW1wbGVtZW50YXRpb24gZm9yIHRoZSBgQXdzRWtzUmVzb3VyY2VEZXRlY3RvcmBcbiAgICAgICAgZmx1ZW50Yml0WWFtbFsxMl0uZGF0YVtcImNsdXN0ZXIubmFtZVwiXSA9IFwiUGV0U2l0ZVwiO1xuICAgICAgICBmbHVlbnRiaXRZYW1sWzEyXS5kYXRhW1wibG9ncy5yZWdpb25cIl0gPSByZWdpb247XG5cbiAgICAgICAgY29uc3QgZmx1ZW50Yml0TWFuaWZlc3QgPSBuZXcgZWtzLkt1YmVybmV0ZXNNYW5pZmVzdCh0aGlzLCBcImNsb3Vkd2F0Y2hlcGxveW1lbnRcIiwge1xuICAgICAgICAgICAgY2x1c3RlcjogY2x1c3RlcixcbiAgICAgICAgICAgIG1hbmlmZXN0OiBmbHVlbnRiaXRZYW1sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIENsb3VkV2F0Y2ggYWdlbnQgZm9yIHByb21ldGhldXMgbWV0cmljc1xuICAgICAgICB2YXIgcHJvbWV0aGV1c1lhbWwgPSB5YW1sLmxvYWRBbGwocmVhZEZpbGVTeW5jKFwiLi9yZXNvdXJjZXMvcHJvbWV0aGV1cy1la3MueWFtbFwiLCBcInV0ZjhcIikpIGFzIFJlY29yZDxzdHJpbmcsIGFueT5bXTtcblxuICAgICAgICBwcm9tZXRoZXVzWWFtbFswXS5tZXRhZGF0YS5hbm5vdGF0aW9uc1tcImVrcy5hbWF6b25hd3MuY29tL3JvbGUtYXJuXCJdID0gbmV3IENmbkpzb24odGhpcywgXCJwcm9tZXRoZXVzX1JvbGVcIiwgeyB2YWx1ZTogYCR7Y3dzZXJ2aWNlYWNjb3VudC5yb2xlQXJufWAgfSk7XG5cbiAgICAgICAgY29uc3QgcHJvbWV0aGV1c01hbmlmZXN0ID0gbmV3IGVrcy5LdWJlcm5ldGVzTWFuaWZlc3QodGhpcywgXCJwcm9tZXRoZXVzZGVwbG95bWVudFwiLCB7XG4gICAgICAgICAgICBjbHVzdGVyOiBjbHVzdGVyLFxuICAgICAgICAgICAgbWFuaWZlc3Q6IHByb21ldGhldXNZYW1sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHByb21ldGhldXNNYW5pZmVzdC5ub2RlLmFkZERlcGVuZGVuY3koZmx1ZW50Yml0TWFuaWZlc3QpOyAvLyBOYW1lc3BhY2UgY3JlYXRpb24gZGVwZW5kZW5jeVxuXG5cbiAgICAgICAgdmFyIGRhc2hib2FyZEJvZHkgPSByZWFkRmlsZVN5bmMoXCIuL3Jlc291cmNlcy9jd19kYXNoYm9hcmRfZmx1ZW50X2JpdC5qc29uXCIsIFwidXRmLThcIik7XG4gICAgICAgIGRhc2hib2FyZEJvZHkgPSBkYXNoYm9hcmRCb2R5LnJlcGxhY2VBbGwoXCJ7e1lPVVJfQ0xVU1RFUl9OQU1FfX1cIiwgXCJQZXRTaXRlXCIpO1xuICAgICAgICBkYXNoYm9hcmRCb2R5ID0gZGFzaGJvYXJkQm9keS5yZXBsYWNlQWxsKFwie3tZT1VSX0FXU19SRUdJT059fVwiLCByZWdpb24pO1xuXG4gICAgICAgIGNvbnN0IGZsdWVudEJpdERhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkNmbkRhc2hib2FyZCh0aGlzLCBcIkZsdWVudEJpdERhc2hib2FyZFwiLCB7XG4gICAgICAgICAgICBkYXNoYm9hcmROYW1lOiBcIkVLU19GbHVlbnRCaXRfRGFzaGJvYXJkXCIsXG4gICAgICAgICAgICBkYXNoYm9hcmRCb2R5OiBkYXNoYm9hcmRCb2R5XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGN1c3RvbVdpZGdldFJlc291cmNlQ29udHJvbGxlclBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnZWNzOkxpc3RTZXJ2aWNlcycsXG4gICAgICAgICAgICAgICAgJ2VjczpVcGRhdGVTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgICAnZWtzOkRlc2NyaWJlTm9kZWdyb3VwJyxcbiAgICAgICAgICAgICAgICAnZWtzOkxpc3ROb2RlZ3JvdXBzJyxcbiAgICAgICAgICAgICAgICAnZWtzOkRlc2NyaWJlVXBkYXRlJyxcbiAgICAgICAgICAgICAgICAnZWtzOlVwZGF0ZU5vZGVncm91cENvbmZpZycsXG4gICAgICAgICAgICAgICAgJ2VjczpEZXNjcmliZVNlcnZpY2VzJyxcbiAgICAgICAgICAgICAgICAnZWtzOkRlc2NyaWJlQ2x1c3RlcicsXG4gICAgICAgICAgICAgICAgJ2VrczpMaXN0Q2x1c3RlcnMnLFxuICAgICAgICAgICAgICAgICdlY3M6TGlzdENsdXN0ZXJzJ1xuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgICAgfSk7XG4gICAgICAgIHZhciBjdXN0b21XaWRnZXRMYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdjdXN0b21XaWRnZXRMYW1iZGFSb2xlJywge1xuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIH0pO1xuICAgICAgICBjdXN0b21XaWRnZXRMYW1iZGFSb2xlLmFkZFRvUHJpbmNpcGFsUG9saWN5KGN1c3RvbVdpZGdldFJlc291cmNlQ29udHJvbGxlclBvbGljeSk7XG5cbiAgICAgICAgdmFyIHBldHNpdGVBcHBsaWNhdGlvblJlc291cmNlQ29udHJvbGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ3BldHNpdGUtYXBwbGljYXRpb24tcmVzb3VyY2UtY29udHJvbGVyJywge1xuICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcvLi4vcmVzb3VyY2VzL3Jlc291cmNlLWNvbnRyb2xsZXItd2lkZ2V0JykpLFxuICAgICAgICAgICAgaGFuZGxlcjogJ3BldHNpdGUtYXBwbGljYXRpb24tcmVzb3VyY2UtY29udHJvbGVyLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgICAgICAgIG1lbW9yeVNpemU6IDEyOCxcbiAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzksXG4gICAgICAgICAgICByb2xlOiBjdXN0b21XaWRnZXRMYW1iZGFSb2xlLFxuICAgICAgICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxMClcbiAgICAgICAgfSk7XG4gICAgICAgIHBldHNpdGVBcHBsaWNhdGlvblJlc291cmNlQ29udHJvbGxlci5hZGRFbnZpcm9ubWVudChcIkVLU19DTFVTVEVSX05BTUVcIiwgY2x1c3Rlci5jbHVzdGVyTmFtZSk7XG4gICAgICAgIC8qXG4gICAgICAgIHBldHNpdGVBcHBsaWNhdGlvblJlc291cmNlQ29udHJvbGxlci5hZGRFbnZpcm9ubWVudChcIkVDU19DTFVTVEVSX0FSTlNcIiwgZWNzUGF5Rm9yQWRvcHRpb25DbHVzdGVyLmNsdXN0ZXJBcm4gKyBcIixcIiArXG4gICAgICAgICAgICBlY3NQZXRMaXN0QWRvcHRpb25DbHVzdGVyLmNsdXN0ZXJBcm4gKyBcIixcIiArIGVjc1BldFNlYXJjaENsdXN0ZXIuY2x1c3RlckFybik7XG4gICAgICAgICovXG4gICAgICAgIHBldHNpdGVBcHBsaWNhdGlvblJlc291cmNlQ29udHJvbGxlci5hZGRFbnZpcm9ubWVudChcIkVDU19DTFVTVEVSX0FSTlNcIiwgZWNzUGF5Rm9yQWRvcHRpb25DbHVzdGVyLmNsdXN0ZXJBcm4gKyBcIixcIiArXG4gICAgICAgICAgICBlY3NQZXRMaXN0QWRvcHRpb25DbHVzdGVyLmNsdXN0ZXJBcm4gKyBcIixcIiArIGVjc0VjMlBldFNlYXJjaENsdXN0ZXIuY2x1c3RlckFybik7XG5cbiAgICAgICAgdmFyIGN1c3RvbVdpZGdldEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnY2xvdWR3YXRjaC1jdXN0b20td2lkZ2V0Jywge1xuICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcvLi4vcmVzb3VyY2VzL3Jlc291cmNlLWNvbnRyb2xsZXItd2lkZ2V0JykpLFxuICAgICAgICAgICAgaGFuZGxlcjogJ2Nsb3Vkd2F0Y2gtY3VzdG9tLXdpZGdldC5sYW1iZGFfaGFuZGxlcicsXG4gICAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM185LFxuICAgICAgICAgICAgcm9sZTogY3VzdG9tV2lkZ2V0TGFtYmRhUm9sZSxcbiAgICAgICAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoNjApXG4gICAgICAgIH0pO1xuICAgICAgICBjdXN0b21XaWRnZXRGdW5jdGlvbi5hZGRFbnZpcm9ubWVudChcIkNPTlRST0xFUl9MQU1CREFfQVJOXCIsIHBldHNpdGVBcHBsaWNhdGlvblJlc291cmNlQ29udHJvbGxlci5mdW5jdGlvbkFybik7XG4gICAgICAgIGN1c3RvbVdpZGdldEZ1bmN0aW9uLmFkZEVudmlyb25tZW50KFwiRUtTX0NMVVNURVJfTkFNRVwiLCBjbHVzdGVyLmNsdXN0ZXJOYW1lKTtcbiAgICAgICAgLypcbiAgICAgICAgY3VzdG9tV2lkZ2V0RnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoXCJFQ1NfQ0xVU1RFUl9BUk5TXCIsIGVjc1BheUZvckFkb3B0aW9uQ2x1c3Rlci5jbHVzdGVyQXJuICsgXCIsXCIgK1xuICAgICAgICAgICAgZWNzUGV0TGlzdEFkb3B0aW9uQ2x1c3Rlci5jbHVzdGVyQXJuICsgXCIsXCIgKyBlY3NQZXRTZWFyY2hDbHVzdGVyLmNsdXN0ZXJBcm4pO1xuICAgICAgICAqL1xuICAgICAgICBjdXN0b21XaWRnZXRGdW5jdGlvbi5hZGRFbnZpcm9ubWVudChcIkVDU19DTFVTVEVSX0FSTlNcIiwgZWNzUGF5Rm9yQWRvcHRpb25DbHVzdGVyLmNsdXN0ZXJBcm4gKyBcIixcIiArXG4gICAgICAgICAgICBlY3NQZXRMaXN0QWRvcHRpb25DbHVzdGVyLmNsdXN0ZXJBcm4gKyBcIixcIiArIGVjc0VjMlBldFNlYXJjaENsdXN0ZXIuY2x1c3RlckFybik7XG5cbiAgICAgICAgdmFyIGNvc3RDb250cm9sRGFzaGJvYXJkQm9keSA9IHJlYWRGaWxlU3luYyhcIi4vcmVzb3VyY2VzL2N3X2Rhc2hib2FyZF9jb3N0X2NvbnRyb2wuanNvblwiLCBcInV0Zi04XCIpO1xuICAgICAgICBjb3N0Q29udHJvbERhc2hib2FyZEJvZHkgPSBjb3N0Q29udHJvbERhc2hib2FyZEJvZHkucmVwbGFjZUFsbChcInt7WU9VUl9MQU1CREFfQVJOfX1cIiwgY3VzdG9tV2lkZ2V0RnVuY3Rpb24uZnVuY3Rpb25Bcm4pO1xuXG4gICAgICAgIGNvbnN0IHBldFNpdGVDb3N0Q29udHJvbERhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkNmbkRhc2hib2FyZCh0aGlzLCBcIlBldFNpdGVDb3N0Q29udHJvbERhc2hib2FyZFwiLCB7XG4gICAgICAgICAgICBkYXNoYm9hcmROYW1lOiBcIlBldFNpdGVfQ29zdF9Db250cm9sX0Rhc2hib2FyZFwiLFxuICAgICAgICAgICAgZGFzaGJvYXJkQm9keTogY29zdENvbnRyb2xEYXNoYm9hcmRCb2R5XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgdGhpcy5jcmVhdGVPdXB1dHMobmV3IE1hcChPYmplY3QuZW50cmllcyh7XG4gICAgICAgICAgICAnQ1dTZXJ2aWNlQWNjb3VudEFybic6IGN3c2VydmljZWFjY291bnQucm9sZUFybixcbiAgICAgICAgICAgICdFS1NfQURNSU5fQVJOJzogRUtTX0FETUlOX0FSTixcbiAgICAgICAgICAgICdYUmF5U2VydmljZUFjY291bnRBcm4nOiB4cmF5c2VydmljZWFjY291bnQucm9sZUFybixcbiAgICAgICAgICAgICdPSURDUHJvdmlkZXJVcmwnOiBjbHVzdGVyLmNsdXN0ZXJPcGVuSWRDb25uZWN0SXNzdWVyVXJsLFxuICAgICAgICAgICAgJ09JRENQcm92aWRlckFybic6IGNsdXN0ZXIub3BlbklkQ29ubmVjdFByb3ZpZGVyLm9wZW5JZENvbm5lY3RQcm92aWRlckFybixcbiAgICAgICAgICAgICdQZXRTaXRlVXJsJzogYGh0dHA6Ly8ke2FsYi5sb2FkQmFsYW5jZXJEbnNOYW1lfWBcbiAgICAgICAgfSkpKTtcblxuXG4gICAgICAgIGNvbnN0IHBldEFkb3B0aW9uc1N0ZXBGbiA9IG5ldyBQZXRBZG9wdGlvbnNTdGVwRm4odGhpcywgJ1N0ZXBGbicpO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlU3NtUGFyYW1ldGVycyhuZXcgTWFwKE9iamVjdC5lbnRyaWVzKHtcbiAgICAgICAgICAgICcvcGV0c3RvcmUvdHJhZmZpY2RlbGF5dGltZSc6IFwiMVwiLFxuICAgICAgICAgICAgJy9wZXRzdG9yZS9ydW1zY3JpcHQnOiBcIiBcIixcbiAgICAgICAgICAgICcvcGV0c3RvcmUvcGV0YWRvcHRpb25zc3RlcGZuYXJuJzogcGV0QWRvcHRpb25zU3RlcEZuLnN0ZXBGbi5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICAgICAgICAnL3BldHN0b3JlL3VwZGF0ZWFkb3B0aW9uc3RhdHVzdXJsJzogc3RhdHVzVXBkYXRlclNlcnZpY2UuYXBpLnVybCxcbiAgICAgICAgICAgICcvcGV0c3RvcmUvcXVldWV1cmwnOiBzcXNRdWV1ZS5xdWV1ZVVybCxcbiAgICAgICAgICAgICcvcGV0c3RvcmUvc25zYXJuJzogdG9waWNfcGV0YWRvcHRpb24udG9waWNBcm4sXG4gICAgICAgICAgICAnL3BldHN0b3JlL2R5bmFtb2RidGFibGVuYW1lJzogZHluYW1vZGJfcGV0YWRvcHRpb24udGFibGVOYW1lLFxuICAgICAgICAgICAgJy9wZXRzdG9yZS9zM2J1Y2tldG5hbWUnOiBzM19vYnNlcnZhYmlsaXR5cGV0YWRvcHRpb25zLmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICAnL3BldHN0b3JlL3NlYXJjaGFwaXVybCc6IGBodHRwOi8vJHtzZWFyY2hTZXJ2aWNlRWMyLnNlcnZpY2UubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9L2FwaS9zZWFyY2g/YCxcbiAgICAgICAgICAgICcvcGV0c3RvcmUvc2VhcmNoaW1hZ2UnOiBzZWFyY2hTZXJ2aWNlRWMyLmNvbnRhaW5lci5pbWFnZU5hbWUsXG4gICAgICAgICAgICAnL3BldHN0b3JlL3BldGxpc3RhZG9wdGlvbnN1cmwnOiBgaHR0cDovLyR7bGlzdEFkb3B0aW9uc1NlcnZpY2Uuc2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX0vYXBpL2Fkb3B0aW9ubGlzdC9gLFxuICAgICAgICAgICAgJy9wZXRzdG9yZS9wZXRsaXN0YWRvcHRpb25zbWV0cmljc3VybCc6IGBodHRwOi8vJHtsaXN0QWRvcHRpb25zU2VydmljZS5zZXJ2aWNlLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lfS9tZXRyaWNzYCxcbiAgICAgICAgICAgICcvcGV0c3RvcmUvcGF5bWVudGFwaXVybCc6IGBodHRwOi8vJHtwYXlGb3JBZG9wdGlvblNlcnZpY2Uuc2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX0vYXBpL2hvbWUvY29tcGxldGVhZG9wdGlvbmAsXG4gICAgICAgICAgICAnL3BldHN0b3JlL3BheWZvcmFkb3B0aW9ubWV0cmljc3VybCc6IGBodHRwOi8vJHtwYXlGb3JBZG9wdGlvblNlcnZpY2Uuc2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX0vbWV0cmljc2AsXG4gICAgICAgICAgICAnL3BldHN0b3JlL2NsZWFudXBhZG9wdGlvbnN1cmwnOiBgaHR0cDovLyR7cGF5Rm9yQWRvcHRpb25TZXJ2aWNlLnNlcnZpY2UubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9L2FwaS9ob21lL2NsZWFudXBhZG9wdGlvbnNgLFxuICAgICAgICAgICAgJy9wZXRzdG9yZS9wZXRzZWFyY2gtY29sbGVjdG9yLW1hbnVhbC1jb25maWcnOiByZWFkRmlsZVN5bmMoXCIuL3Jlc291cmNlcy9jb2xsZWN0b3IvZWNzLXhyYXktbWFudWFsLnlhbWxcIiwgXCJ1dGY4XCIpLFxuICAgICAgICAgICAgJy9wZXRzdG9yZS9yZHNzZWNyZXRhcm4nOiBgJHthdXJvcmFDbHVzdGVyLnNlY3JldD8uc2VjcmV0QXJufWAsXG4gICAgICAgICAgICAnL3BldHN0b3JlL3Jkc2VuZHBvaW50JzogYXVyb3JhQ2x1c3Rlci5jbHVzdGVyRW5kcG9pbnQuaG9zdG5hbWUsXG4gICAgICAgICAgICAnL3BldHN0b3JlL3N0YWNrbmFtZSc6IHN0YWNrTmFtZSxcbiAgICAgICAgICAgICcvcGV0c3RvcmUvcGV0c2l0ZXVybCc6IGBodHRwOi8vJHthbGIubG9hZEJhbGFuY2VyRG5zTmFtZX1gLFxuICAgICAgICAgICAgJy9wZXRzdG9yZS9wZXRoaXN0b3J5dXJsJzogYGh0dHA6Ly8ke2FsYi5sb2FkQmFsYW5jZXJEbnNOYW1lfS9wZXRhZG9wdGlvbnNoaXN0b3J5YCxcbiAgICAgICAgICAgICcvZWtzL3BldHNpdGUvT0lEQ1Byb3ZpZGVyVXJsJzogY2x1c3Rlci5jbHVzdGVyT3BlbklkQ29ubmVjdElzc3VlclVybCxcbiAgICAgICAgICAgICcvZWtzL3BldHNpdGUvT0lEQ1Byb3ZpZGVyQXJuJzogY2x1c3Rlci5vcGVuSWRDb25uZWN0UHJvdmlkZXIub3BlbklkQ29ubmVjdFByb3ZpZGVyQXJuLFxuICAgICAgICAgICAgJy9wZXRzdG9yZS9lcnJvcm1vZGUxJzogXCJmYWxzZVwiXG4gICAgICAgIH0pKSk7XG5cbiAgICAgICAgdGhpcy5jcmVhdGVPdXB1dHMobmV3IE1hcChPYmplY3QuZW50cmllcyh7XG4gICAgICAgICAgICAnUXVldWVVUkwnOiBzcXNRdWV1ZS5xdWV1ZVVybCxcbiAgICAgICAgICAgICdVcGRhdGVBZG9wdGlvblN0YXR1c3VybCc6IHN0YXR1c1VwZGF0ZXJTZXJ2aWNlLmFwaS51cmwsXG4gICAgICAgICAgICAnU05TVG9waWNBUk4nOiB0b3BpY19wZXRhZG9wdGlvbi50b3BpY0FybixcbiAgICAgICAgICAgICdSRFNTZXJ2ZXJOYW1lJzogYXVyb3JhQ2x1c3Rlci5jbHVzdGVyRW5kcG9pbnQuaG9zdG5hbWVcbiAgICAgICAgfSkpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZVNzbVBhcmFtZXRlcnMocGFyYW1zOiBNYXA8c3RyaW5nLCBzdHJpbmc+KSB7XG4gICAgICAgIHBhcmFtcy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAvL2NvbnN0IGlkID0ga2V5LnJlcGxhY2UoJy8nLCAnXycpO1xuICAgICAgICAgICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywga2V5LCB7IHBhcmFtZXRlck5hbWU6IGtleSwgc3RyaW5nVmFsdWU6IHZhbHVlIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZU91cHV0cyhwYXJhbXM6IE1hcDxzdHJpbmcsIHN0cmluZz4pIHtcbiAgICAgICAgcGFyYW1zLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywga2V5LCB7IHZhbHVlOiB2YWx1ZSB9KVxuICAgICAgICB9KTtcbiAgICB9XG59XG4iXX0=