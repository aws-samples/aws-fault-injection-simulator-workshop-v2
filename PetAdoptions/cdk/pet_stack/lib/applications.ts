import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as yaml from 'js-yaml';
import { Stack, StackProps, CfnJson, Fn, CfnOutput } from 'aws-cdk-lib';
import { readFileSync } from 'fs';
import { Construct } from 'constructs'
import { ContainerImageBuilder } from './common/container-image-builder'
import { PetAdoptionsHistory } from './applications/pet-adoptions-history-application'
import { ApplicationsStackProps } from './common/services-shared-properties';
import { SSMParameterReader } from './common/ssm-parameter-reader';


export class Applications extends Stack {
    constructor(scope: Construct, id: string, props: ApplicationsStackProps) {
        super(scope, id, props);

        const stack = Stack.of(this);
        const region = stack.region;
        const account = stack.account;
        const stackName = id;

        let isPrimaryRegionDeployment
        if (props.deploymentType as string == 'primary') {
            // DeploymentType is Primary Region Deployment
            isPrimaryRegionDeployment = true
        } else {
            // DeploymentType is Secondary Region Deployment
            isPrimaryRegionDeployment = false
        }

        const roleArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getParamClusterAdmin', { parameterName: "/eks/petsite/EKSMasterRoleArn" }).stringValue;
        const targetGroupArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getParamTargetGroupArn', { parameterName: "/eks/petsite/TargetGroupArn" }).stringValue;
        const oidcProviderUrl = ssm.StringParameter.fromStringParameterAttributes(this, 'getOIDCProviderUrl', { parameterName: "/eks/petsite/OIDCProviderUrl" }).stringValue;
        const oidcProviderArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getOIDCProviderArn', { parameterName: "/eks/petsite/OIDCProviderArn" }).stringValue;
        const petHistoryTargetGroupArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getPetHistoryParamTargetGroupArn', { parameterName: "/eks/pethistory/TargetGroupArn" }).stringValue;

        // let rdsSecret
        const ssmrdsSecretName = new SSMParameterReader(this, 'rdsSecretName', {
            parameterName: "/petstore/rdssecretname",
            region: props.mainRegion
        });
        const rdsSecretName = ssmrdsSecretName.getParameterValue();
        const rdsSecret = secretsmanager.Secret.fromSecretNameV2(this, 'rdsSecret', rdsSecretName);

        // if (isPrimaryRegionDeployment) {
        //     rdsSecretArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getRdsSecretArn', { parameterName: "/petstore/rdssecretarn" }).stringValue;
        // } else {
            
        // }

        const cluster = eks.Cluster.fromClusterAttributes(this, 'MyCluster', {
            clusterName: 'PetSite',
            kubectlRoleArn: roleArn,
        });

        // Create metrics server
        new eks.HelmChart(this, 'metrics-server', {
            cluster,
            chart: 'metrics-server',
            repository: 'https://kubernetes-sigs.github.io/metrics-server/',
            namespace: 'kube-system',
        });

        // ClusterID is not available for creating the proper conditions https://github.com/aws/aws-cdk/issues/10347
        // Those might be an issue
        const clusterId = Fn.select(4, Fn.split('/', oidcProviderUrl)) // Remove https:// from the URL as workaround to get ClusterID

        const app_federatedPrincipal = new iam.FederatedPrincipal(
            oidcProviderArn,
            {
                StringEquals: new CfnJson(this, "App_FederatedPrincipalCondition", {
                    value: {
                        [`oidc.eks.${region}.amazonaws.com/id/${clusterId}:aud`]: "sts.amazonaws.com"
                    }
                })
            }
        );
        const app_trustRelationship = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [app_federatedPrincipal],
            actions: ["sts:AssumeRoleWithWebIdentity"]
        })

        // FrontEnd SA (SSM, SQS, SNS)
        const petstoreserviceaccount = new iam.Role(this, 'PetSiteServiceAccount', {
            //  assumedBy: eksFederatedPrincipal,
            assumedBy: new iam.AccountRootPrincipal(),
            managedPolicies: [
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetSiteServiceAccount-AmazonSSMFullAccess', 'arn:aws:iam::aws:policy/AmazonSSMFullAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetSiteServiceAccount-AmazonSQSFullAccess', 'arn:aws:iam::aws:policy/AmazonSQSFullAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetSiteServiceAccount-AmazonSNSFullAccess', 'arn:aws:iam::aws:policy/AmazonSNSFullAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetSiteServiceAccount-AWSXRayDaemonWriteAccess', 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess')
            ],
        });

        petstoreserviceaccount.assumeRolePolicy?.addStatements(app_trustRelationship);

        const startStepFnExecutionPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'states:StartExecution'
            ],
            resources: ['*']
        });

        petstoreserviceaccount.addToPrincipalPolicy(startStepFnExecutionPolicy);

        const petsiteAsset = new DockerImageAsset(this, 'petsiteAsset', {
            directory: "./resources/microservices/petsite/petsite/"
        });

        var manifest = readFileSync("./resources/k8s_petsite/deployment.yaml", "utf8");
        var deploymentYaml = yaml.loadAll(manifest) as Record<string, any>[];

        deploymentYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = new CfnJson(this, "deployment_Role", { value: `${petstoreserviceaccount.roleArn}` });
        deploymentYaml[2].spec.template.spec.containers[0].image = new CfnJson(this, "deployment_Image", { value: `${petsiteAsset.imageUri}` });
        deploymentYaml[3].spec.targetGroupARN = new CfnJson(this, "targetgroupArn", { value: `${targetGroupArn}` })

        const deploymentManifest = new eks.KubernetesManifest(this, "petsitedeployment", {
            cluster: cluster,
            manifest: deploymentYaml
        });

        // PetAdoptionsHistory application definitions-----------------------------------------------------------------------
        const petAdoptionsHistoryContainerImage = new ContainerImageBuilder(this, 'pet-adoptions-history-container-image', {
            repositoryName: "pet-adoptions-history",
            dockerImageAssetDirectory: "./resources/microservices/petadoptionshistory-py",
        });
        new ssm.StringParameter(this, "putPetAdoptionHistoryRepositoryName", {
            stringValue: petAdoptionsHistoryContainerImage.repositoryUri,
            parameterName: '/petstore/pethistoryrepositoryuri'
        });

        const petAdoptionsHistoryApplication = new PetAdoptionsHistory(this, 'pet-adoptions-history-application', {
            cluster: cluster,
            app_trustRelationship: app_trustRelationship,
            kubernetesManifestPath: "./resources/microservices/petadoptionshistory-py/deployment.yaml",
            otelConfigMapPath: "./resources/microservices/petadoptionshistory-py/otel-collector-config.yaml",
            rdsSecret: rdsSecret,
            //rdsSecretArn: rdsSecretArn,
            region: region,
            imageUri: petAdoptionsHistoryContainerImage.imageUri,
            targetGroupArn: petHistoryTargetGroupArn
        });

        // PetFood application definitions-----------------------------------------------------------------------
        const petFoodContainerImage = new ContainerImageBuilder(this, 'pet-food-container-image', {
            repositoryName: "petfood",
            dockerImageAssetDirectory: "../../petfood",
        });

        var petFoodManifest = readFileSync("../../petfood/deployment.yaml", "utf8");
        var petFoodDeploymentYaml = yaml.loadAll(petFoodManifest) as Record<string, any>[];
        petFoodDeploymentYaml[0].spec.template.spec.containers[0].image = `${account}.dkr.ecr.${region}.amazonaws.com/petfood:latest`;

        petFoodDeploymentYaml[0].spec.template.spec.containers[0].env.forEach((envVar: { name: string, value: string }) => {
            if (envVar.name === "AWS_DEFAULT_REGION" && envVar.value === "DEPLOYMENTREGION") {
                envVar.value = region;
            }
        });

        const petFoodDeploymentManifest = new eks.KubernetesManifest(this, "petfooddeployment", {
            cluster: cluster,
            manifest: petFoodDeploymentYaml
        });

        // PetFoodMetric application definitions-----------------------------------------------------------------------
        const petFoodMetricContainerImage = new ContainerImageBuilder(this, 'pet-food-metric-container-image', {
            repositoryName: "petfood-metric",
            dockerImageAssetDirectory: "../../petfood-metric",
        });

        var petFoodMetricManifest = readFileSync("../../petfood-metric/deployment.yaml", "utf8");
        var petFoodMetricDeploymentYaml = yaml.loadAll(petFoodMetricManifest) as Record<string, any>[];
        petFoodMetricDeploymentYaml[0].spec.template.spec.containers[0].image = `${account}.dkr.ecr.${region}.amazonaws.com/petfood-metric:latest`;

        petFoodMetricDeploymentYaml[0].spec.template.spec.containers[0].env.forEach((envVar: { name: string, value: string }) => {
            if (envVar.name === "AWS_DEFAULT_REGION" && envVar.value === "DEPLOYMENTREGION") {
                envVar.value = region;
            }
        });

        const petFoodMetricDeploymentManifest = new eks.KubernetesManifest(this, "petfoodmetricdeployment", {
            cluster: cluster,
            manifest: petFoodMetricDeploymentYaml
        });

        // SSM parameters and outputs-----------------------------------------------------------------------
        this.createSsmParameters(new Map(Object.entries({
            '/eks/petsite/stackname': stackName
        })));

        this.createOuputs(new Map(Object.entries({
            'PetSiteECRImageURL': petsiteAsset.imageUri,
            'PetStoreServiceAccountArn': petstoreserviceaccount.roleArn,
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
