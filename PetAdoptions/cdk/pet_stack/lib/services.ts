import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as asg from 'aws-cdk-lib/aws-autoscaling';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sns from 'aws-cdk-lib/aws-sns'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'
import * as ddb from 'aws-cdk-lib/aws-dynamodb'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3seeder from 'aws-cdk-lib/aws-s3-deployment'
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
////import * as cloud9 from 'aws-cdk-lib/aws-cloud9';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecrassets from 'aws-cdk-lib/aws-ecr-assets';
import * as cdk from "aws-cdk-lib";

import { Construct } from 'constructs'
import { PayForAdoptionService } from './services/pay-for-adoption-service'
import { ListAdoptionsService } from './services/list-adoptions-service'
import { SearchService } from './services/search-service'
import { SearchEc2Service } from './services/search-service-ec2'
import { TrafficGeneratorService } from './services/traffic-generator-service'
import { StatusUpdaterService } from './services/status-updater-service'
import { PetAdoptionsStepFn } from './services/stepfn'
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import { CfnJson, RemovalPolicy, Fn, Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { readFileSync } from 'fs';
import 'ts-replace-all'
import { TreatMissingData, ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { KubectlLayer } from 'aws-cdk-lib/lambda-layer-kubectl';
// import { Cloud9Environment } from './modules/core/cloud9';
import { NodegroupAsgTags } from 'eks-nodegroup-asg-tags-cdk';
import { ServiceStackProps } from '../lib/common/shared-properties';
import { SSMParameterReader } from '../lib/common/ssm-parameter-reader';

export class Services extends Stack {
    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);
        let isPrimaryRegionDeployment

        // checking if stack has been called to deploy the primary or secondary region
        // if (!props?.env?.region && !props?.MainRegion) {
        //     throw Error('No props passed. Could not resolve region. Please pass it with the region environment variable.');
        // } else {
        //     if (props.DeploymentType as string == 'primary') {
        //         console.log("Primary Region Deployment Selected")
        //         console.log("DeploymentType Selected", props.DeploymentType)
        //         console.log("Deployment Region provided as [", props?.env?.region, "]. Primary Region provided as [", props?.MainRegion, "]{")
        //         isPrimaryRegionDeployment = true
        //     } else if (props.DeploymentType as string == 'secondary') {
        //         isPrimaryRegionDeployment = false
        //         console.log("Secondary Region Deployment Selected")
        //         console.log("DeploymentType Selected", props.DeploymentType)
        //         console.log("Deployment Region provided as [", props?.env?.region, "]. Primary Region provided as [", props?.MainRegion, "]{")
        //     } else {
        //         throw Error('No DeploymentType passed. Please pass either "primary" or "secondary" as the DeploymentType.');
        //     }
        // }

        if (props.DeploymentType as string == 'primary') {
            console.log("DeploymentType provided as [",props.DeploymentType,"]" )
            isPrimaryRegionDeployment = true
            console.log("isPrimaryRegionDeployment set as [",isPrimaryRegionDeployment,"]" )
        } else {
            console.log("DeploymentType provided as [",props.DeploymentType,"]" )
            isPrimaryRegionDeployment = false
            console.log("isPrimaryRegionDeployment set as [",isPrimaryRegionDeployment,"]" )
        }


        var isEventEngine = 'false';
        if (this.node.tryGetContext('is_event_engine') != undefined) {
            isEventEngine = this.node.tryGetContext('is_event_engine');
        }

        const stackName = id;

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


        // Creates an S3 bucket to store pet images


        const s3_observabilitypetadoptions = new s3.Bucket(this, 's3bucket_petadoption', {
            publicReadAccess: false,
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        // Creates the DynamoDB table for Petadoption data
        // Define the DynamoDB table properties 
        let dynamodb_petadoption: ddb.TableV2;
        let dynamoDBTableName = 'undefined';

        if (isPrimaryRegionDeployment) {
            console.log("Primary Region Deployment; deploying DynamoDB")
            let tableProps: any = {
                partitionKey: {
                    name: 'pettype',
                    type: ddb.AttributeType.STRING
                },
                sortKey: {
                    name: 'petid',
                    type: ddb.AttributeType.STRING
                },
                removalPolicy: RemovalPolicy.DESTROY,
                billing: ddb.Billing.onDemand(),
                // billing: ddb.Billing.provisioned({
                //     readCapacity: ddb.Capacity.fixed(10),
                //     writeCapacity: ddb.Capacity.autoscaled({ maxCapacity: 15 }),
                //   }),

            };
            if (!props?.SecondaryRegion) {
                console.log("SecondaryRegion is not provided. Creating single region DynamoDB Table")
                dynamodb_petadoption = new ddb.TableV2(this, 'ddb_petadoption', tableProps);
            } else {
                console.log("SecondaryRegion provided as [" + props?.SecondaryRegion + "]. Creating Global DynamoDB Table")
                tableProps["replicas"] = [{ region: props?.SecondaryRegion as string }];
                dynamodb_petadoption = new ddb.TableV2(this, 'ddb_petadoption', tableProps);
            }

            dynamodb_petadoption.metric('WriteThrottleEvents', { statistic: "avg" }).createAlarm(this, 'WriteThrottleEvents-BasicAlarm', {
                threshold: 0,
                treatMissingData: TreatMissingData.NOT_BREACHING,
                comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
                evaluationPeriods: 1,
                alarmName: `${dynamodb_petadoption.tableName}-WriteThrottleEvents-BasicAlarm`,
            });

            dynamodb_petadoption.metric('ReadThrottleEvents', { statistic: "avg" }).createAlarm(this, 'ReadThrottleEvents-BasicAlarm', {
                threshold: 0,
                treatMissingData: TreatMissingData.NOT_BREACHING,
                comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
                evaluationPeriods: 1,
                alarmName: `${dynamodb_petadoption.tableName}-ReadThrottleEvents-BasicAlarm`,
            });
            dynamoDBTableName = dynamodb_petadoption.tableName
        } else {
            console.log("Secondary Region Deployment. Not deploying DynamoDB. Getting DynamoDB information from SSM")
            const ssmDynamoDBTableName = new SSMParameterReader(this, 'dynamodbtablename', {
                parameterName: "/petstore/dynamodbtablename",
                region: props.MainRegion as string
            });
            dynamoDBTableName = ssmDynamoDBTableName.getParameterValue();
            console.log("DynamoDB Table name: ", dynamoDBTableName)

        }

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

// Create RDS Aurora PG cluster
        // if (isPrimaryRegionDeployment) {
        // console.log("Primary Region Deployment; deploying RDS")
        
        const rdssecuritygroup = new ec2.SecurityGroup(this, 'petadoptionsrdsSG', {
            vpc: theVPC
        });
//Todo -  need to include CIDR from the second region here.
        rdssecuritygroup.addIngressRule(ec2.Peer.ipv4(theVPC.vpcCidrBlock), ec2.Port.tcp(5432), 'Allow Aurora PG access from within the VPC CIDR range');

        var rdsUsername = this.node.tryGetContext('rdsusername');
        if (rdsUsername == undefined) {
            rdsUsername = "petadmin"
        }

        const auroraCluster = new rds.DatabaseCluster(this, 'Database', {

            engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_13_9 }),
            writer: rds.ClusterInstance.provisioned('writer', {
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
            }),
            readers: [
                rds.ClusterInstance.provisioned('reader', {
                    instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
                },
                ),
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

        const stack = Stack.of(this);
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
        const payForAdoptionService = new PayForAdoptionService(this, 'pay-for-adoption-service', {
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
        payForAdoptionService.taskDefinition.taskRole?.addToPrincipalPolicy(readSSMParamsPolicy);
        payForAdoptionService.taskDefinition.taskRole?.addToPrincipalPolicy(ddbSeedPolicy);


        const ecsPetListAdoptionCluster = new ecs.Cluster(this, "PetListAdoptions", {
            vpc: theVPC,
            containerInsights: true
        });
        // PetListAdoptions service definitions-----------------------------------------------------------------------
        const listAdoptionsService = new ListAdoptionsService(this, 'list-adoptions-service', {
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
            region: props.MainRegion as string,
            tableName: dynamoDBTableName
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
            version: KubernetesVersion.of('1.29'),
            kubectlLayer: new KubectlLayer(this, 'kubectl')
        });

        const eksOptimizedImage = new eks.EksOptimizedImage(/* all optional props */ {
            cpuArch: eks.CpuArch.X86_64,
            kubernetesVersion: '1.29',
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

            const c9role = ssm.StringParameter.valueForStringParameter(this, '/cloud9/c9iamrolearn');

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
                region: props.env?.region
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
            '/petstore/s3bucketname': s3_observabilitypetadoptions.bucketName,
            '/petstore/searchapiurl': `http://${searchServiceEc2.service.loadBalancer.loadBalancerDnsName}/api/search?`,
            '/petstore/searchimage': searchServiceEc2.container.imageName,
            '/petstore/petlistadoptionsurl': `http://${listAdoptionsService.service.loadBalancer.loadBalancerDnsName}/api/adoptionlist/`,
            '/petstore/petlistadoptionsmetricsurl': `http://${listAdoptionsService.service.loadBalancer.loadBalancerDnsName}/metrics`,
            '/petstore/paymentapiurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/api/home/completeadoption`,
            '/petstore/payforadoptionmetricsurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/metrics`,
            '/petstore/cleanupadoptionsurl': `http://${payForAdoptionService.service.loadBalancer.loadBalancerDnsName}/api/home/cleanupadoptions`,
            '/petstore/petsearch-collector-manual-config': readFileSync("./resources/collector/ecs-xray-manual.yaml", "utf8"),
            '/petstore/rdssecretarn': `${auroraCluster.secret?.secretArn}`,
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