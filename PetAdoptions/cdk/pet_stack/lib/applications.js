"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Applications = void 0;
const iam = require("aws-cdk-lib/aws-iam");
const ssm = require("aws-cdk-lib/aws-ssm");
const eks = require("aws-cdk-lib/aws-eks");
const aws_ecr_assets_1 = require("aws-cdk-lib/aws-ecr-assets");
const yaml = require("js-yaml");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const fs_1 = require("fs");
const container_image_builder_1 = require("./common/container-image-builder");
const pet_adoptions_history_application_1 = require("./applications/pet-adoptions-history-application");
class Applications extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        var _a;
        super(scope, id, props);
        const stackName = id;
        const roleArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getParamClusterAdmin', { parameterName: "/eks/petsite/EKSMasterRoleArn" }).stringValue;
        const targetGroupArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getParamTargetGroupArn', { parameterName: "/eks/petsite/TargetGroupArn" }).stringValue;
        const oidcProviderUrl = ssm.StringParameter.fromStringParameterAttributes(this, 'getOIDCProviderUrl', { parameterName: "/eks/petsite/OIDCProviderUrl" }).stringValue;
        const oidcProviderArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getOIDCProviderArn', { parameterName: "/eks/petsite/OIDCProviderArn" }).stringValue;
        const rdsSecretArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getRdsSecretArn', { parameterName: "/petstore/rdssecretarn" }).stringValue;
        const petHistoryTargetGroupArn = ssm.StringParameter.fromStringParameterAttributes(this, 'getPetHistoryParamTargetGroupArn', { parameterName: "/eks/pethistory/TargetGroupArn" }).stringValue;
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
        // Thsos might be an issue
        const clusterId = aws_cdk_lib_1.Fn.select(4, aws_cdk_lib_1.Fn.split('/', oidcProviderUrl)); // Remove https:// from the URL as workaround to get ClusterID
        const stack = aws_cdk_lib_1.Stack.of(this);
        const region = stack.region;
        const app_federatedPrincipal = new iam.FederatedPrincipal(oidcProviderArn, {
            StringEquals: new aws_cdk_lib_1.CfnJson(this, "App_FederatedPrincipalCondition", {
                value: {
                    [`oidc.eks.${region}.amazonaws.com/id/${clusterId}:aud`]: "sts.amazonaws.com"
                }
            })
        });
        const app_trustRelationship = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [app_federatedPrincipal],
            actions: ["sts:AssumeRoleWithWebIdentity"]
        });
        // FrontEnd SA (SSM, SQS, SNS)
        const petstoreserviceaccount = new iam.Role(this, 'PetSiteServiceAccount', {
            //                assumedBy: eksFederatedPrincipal,
            assumedBy: new iam.AccountRootPrincipal(),
            managedPolicies: [
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetSiteServiceAccount-AmazonSSMFullAccess', 'arn:aws:iam::aws:policy/AmazonSSMFullAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetSiteServiceAccount-AmazonSQSFullAccess', 'arn:aws:iam::aws:policy/AmazonSQSFullAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetSiteServiceAccount-AmazonSNSFullAccess', 'arn:aws:iam::aws:policy/AmazonSNSFullAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetSiteServiceAccount-AWSXRayDaemonWriteAccess', 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess')
            ],
        });
        (_a = petstoreserviceaccount.assumeRolePolicy) === null || _a === void 0 ? void 0 : _a.addStatements(app_trustRelationship);
        const startStepFnExecutionPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'states:StartExecution'
            ],
            resources: ['*']
        });
        petstoreserviceaccount.addToPrincipalPolicy(startStepFnExecutionPolicy);
        const petsiteAsset = new aws_ecr_assets_1.DockerImageAsset(this, 'petsiteAsset', {
            directory: "./resources/microservices/petsite/petsite/"
        });
        var manifest = (0, fs_1.readFileSync)("./resources/k8s_petsite/deployment.yaml", "utf8");
        var deploymentYaml = yaml.loadAll(manifest);
        deploymentYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = new aws_cdk_lib_1.CfnJson(this, "deployment_Role", { value: `${petstoreserviceaccount.roleArn}` });
        deploymentYaml[2].spec.template.spec.containers[0].image = new aws_cdk_lib_1.CfnJson(this, "deployment_Image", { value: `${petsiteAsset.imageUri}` });
        deploymentYaml[3].spec.targetGroupARN = new aws_cdk_lib_1.CfnJson(this, "targetgroupArn", { value: `${targetGroupArn}` });
        const deploymentManifest = new eks.KubernetesManifest(this, "petsitedeployment", {
            cluster: cluster,
            manifest: deploymentYaml
        });
        // PetAdoptionsHistory application definitions-----------------------------------------------------------------------
        const petAdoptionsHistoryContainerImage = new container_image_builder_1.ContainerImageBuilder(this, 'pet-adoptions-history-container-image', {
            repositoryName: "pet-adoptions-history",
            dockerImageAssetDirectory: "./resources/microservices/petadoptionshistory-py",
        });
        new ssm.StringParameter(this, "putPetAdoptionHistoryRepositoryName", {
            stringValue: petAdoptionsHistoryContainerImage.repositoryUri,
            parameterName: '/petstore/pethistoryrepositoryuri'
        });
        const petAdoptionsHistoryApplication = new pet_adoptions_history_application_1.PetAdoptionsHistory(this, 'pet-adoptions-history-application', {
            cluster: cluster,
            app_trustRelationship: app_trustRelationship,
            kubernetesManifestPath: "./resources/microservices/petadoptionshistory-py/deployment.yaml",
            otelConfigMapPath: "./resources/microservices/petadoptionshistory-py/otel-collector-config.yaml",
            rdsSecretArn: rdsSecretArn,
            region: region,
            imageUri: petAdoptionsHistoryContainerImage.imageUri,
            targetGroupArn: petHistoryTargetGroupArn
        });
        this.createSsmParameters(new Map(Object.entries({
            '/eks/petsite/stackname': stackName
        })));
        this.createOuputs(new Map(Object.entries({
            'PetSiteECRImageURL': petsiteAsset.imageUri,
            'PetStoreServiceAccountArn': petstoreserviceaccount.roleArn,
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
exports.Applications = Applications;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb25zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwbGljYXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLCtEQUE4RDtBQUM5RCxnQ0FBZ0M7QUFDaEMsNkNBQXdFO0FBQ3hFLDJCQUFrQztBQUVsQyw4RUFBb0c7QUFDcEcsd0dBQXNGO0FBRXRGLE1BQWEsWUFBYSxTQUFRLG1CQUFLO0lBQ3JDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBa0I7O1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUMsRUFBRSxFQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXRCLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUVyQixNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsZUFBZSxDQUFDLDZCQUE2QixDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRSxFQUFFLGFBQWEsRUFBRSwrQkFBK0IsRUFBQyxDQUFDLENBQUMsV0FBVyxDQUFDO1FBQy9KLE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxlQUFlLENBQUMsNkJBQTZCLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFLEVBQUUsYUFBYSxFQUFFLDZCQUE2QixFQUFDLENBQUMsQ0FBQyxXQUFXLENBQUM7UUFDdEssTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLGVBQWUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxhQUFhLEVBQUUsOEJBQThCLEVBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztRQUNwSyxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsZUFBZSxDQUFDLDZCQUE2QixDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRSxFQUFFLGFBQWEsRUFBRSw4QkFBOEIsRUFBQyxDQUFDLENBQUMsV0FBVyxDQUFDO1FBQ3BLLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxlQUFlLENB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Q25DLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsYUFBYSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUNuRixDQUFDLENBQUMsQ0FBQztJQUNILENBQUM7SUFFTyxZQUFZLENBQUMsTUFBMkI7UUFDaEQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsRUFBRTtZQUMxQixJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFBO1FBQzlDLENBQUMsQ0FBQyxDQUFDO0lBQ0gsQ0FBQztDQUNKO0FBcklELG9DQXFJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCAqIGFzIGVrcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWtzJztcbmltcG9ydCB7IERvY2tlckltYWdlQXNzZXQgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyLWFzc2V0cyc7XG5pbXBvcnQgKiBhcyB5YW1sIGZyb20gJ2pzLXlhbWwnO1xuaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIENmbkpzb24sIEZuLCBDZm5PdXRwdXQgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJ1xuaW1wb3J0IHsgQ29udGFpbmVySW1hZ2VCdWlsZGVyUHJvcHMsIENvbnRhaW5lckltYWdlQnVpbGRlciB9IGZyb20gJy4vY29tbW9uL2NvbnRhaW5lci1pbWFnZS1idWlsZGVyJ1xuaW1wb3J0IHsgUGV0QWRvcHRpb25zSGlzdG9yeSB9IGZyb20gJy4vYXBwbGljYXRpb25zL3BldC1hZG9wdGlvbnMtaGlzdG9yeS1hcHBsaWNhdGlvbidcblxuZXhwb3J0IGNsYXNzIEFwcGxpY2F0aW9ucyBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsaWQscHJvcHMpO1xuXG4gICAgY29uc3Qgc3RhY2tOYW1lID0gaWQ7XG5cbiAgICBjb25zdCByb2xlQXJuID0gc3NtLlN0cmluZ1BhcmFtZXRlci5mcm9tU3RyaW5nUGFyYW1ldGVyQXR0cmlidXRlcyh0aGlzLCAnZ2V0UGFyYW1DbHVzdGVyQWRtaW4nLCB7IHBhcmFtZXRlck5hbWU6IFwiL2Vrcy9wZXRzaXRlL0VLU01hc3RlclJvbGVBcm5cIn0pLnN0cmluZ1ZhbHVlO1xuICAgIGNvbnN0IHRhcmdldEdyb3VwQXJuID0gc3NtLlN0cmluZ1BhcmFtZXRlci5mcm9tU3RyaW5nUGFyYW1ldGVyQXR0cmlidXRlcyh0aGlzLCAnZ2V0UGFyYW1UYXJnZXRHcm91cEFybicsIHsgcGFyYW1ldGVyTmFtZTogXCIvZWtzL3BldHNpdGUvVGFyZ2V0R3JvdXBBcm5cIn0pLnN0cmluZ1ZhbHVlO1xuICAgIGNvbnN0IG9pZGNQcm92aWRlclVybCA9IHNzbS5TdHJpbmdQYXJhbWV0ZXIuZnJvbVN0cmluZ1BhcmFtZXRlckF0dHJpYnV0ZXModGhpcywgJ2dldE9JRENQcm92aWRlclVybCcsIHsgcGFyYW1ldGVyTmFtZTogXCIvZWtzL3BldHNpdGUvT0lEQ1Byb3ZpZGVyVXJsXCJ9KS5zdHJpbmdWYWx1ZTtcbiAgICBjb25zdCBvaWRjUHJvdmlkZXJBcm4gPSBzc20uU3RyaW5nUGFyYW1ldGVyLmZyb21TdHJpbmdQYXJhbWV0ZXJBdHRyaWJ1dGVzKHRoaXMsICdnZXRPSURDUHJvdmlkZXJBcm4nLCB7IHBhcmFtZXRlck5hbWU6IFwiL2Vrcy9wZXRzaXRlL09JRENQcm92aWRlckFyblwifSkuc3RyaW5nVmFsdWU7XG4gICAgY29uc3QgcmRzU2VjcmV0QXJuID0gc3NtLlN0cmluZ1BhcmFtZXRlci5mcm9tU3RyaW5nUGFyYW1ldGVyQXR0cmlidXRlcyh0aGlzLCAnZ2V0UmRzU2VjcmV0QXJuJywgeyBwYXJhbWV0ZXJOYW1lOiBcIi9wZXRzdG9yZS9yZHNzZWNyZXRhcm5cIn0pLnN0cmluZ1ZhbHVlO1xuICAgIGNvbnN0IHBldEhpc3RvcnlUYXJnZXRHcm91cEFybiA9IHNzbS5TdHJpbmdQYXJhbWV0ZXIuZnJvbVN0cmluZ1BhcmFtZXRlckF0dHJpYnV0ZXModGhpcywgJ2dldFBldEhpc3RvcnlQYXJhbVRhcmdldEdyb3VwQXJuJywgeyBwYXJhbWV0ZXJOYW1lOiBcIi9la3MvcGV0aGlzdG9yeS9UYXJnZXRHcm91cEFyblwifSkuc3RyaW5nVmFsdWU7XG5cbiAgICBjb25zdCBjbHVzdGVyID0gZWtzLkNsdXN0ZXIuZnJvbUNsdXN0ZXJBdHRyaWJ1dGVzKHRoaXMsICdNeUNsdXN0ZXInLCB7XG4gICAgICBjbHVzdGVyTmFtZTogJ1BldFNpdGUnLFxuICAgICAga3ViZWN0bFJvbGVBcm46IHJvbGVBcm4sXG4gICAgfSk7XG4gICAgLy8gQ3JlYXRlIG1ldHJpY3Mgc2VydmVyXG4gICAgbmV3IGVrcy5IZWxtQ2hhcnQodGhpcywgJ21ldHJpY3Mtc2VydmVyJywge1xuICAgICAgY2x1c3RlcixcbiAgICAgIGNoYXJ0OiAnbWV0cmljcy1zZXJ2ZXInLFxuICAgICAgcmVwb3NpdG9yeTogJ2h0dHBzOi8va3ViZXJuZXRlcy1zaWdzLmdpdGh1Yi5pby9tZXRyaWNzLXNlcnZlci8nLFxuICAgICAgbmFtZXNwYWNlOiAna3ViZS1zeXN0ZW0nLFxuICAgIH0pO1xuXG5cbiAgICAvLyBDbHVzdGVySUQgaXMgbm90IGF2YWlsYWJsZSBmb3IgY3JlYXRpbmcgdGhlIHByb3BlciBjb25kaXRpb25zIGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLWNkay9pc3N1ZXMvMTAzNDdcbiAgICAvLyBUaHNvcyBtaWdodCBiZSBhbiBpc3N1ZVxuICAgIGNvbnN0IGNsdXN0ZXJJZCA9IEZuLnNlbGVjdCg0LCBGbi5zcGxpdCgnLycsIG9pZGNQcm92aWRlclVybCkpIC8vIFJlbW92ZSBodHRwczovLyBmcm9tIHRoZSBVUkwgYXMgd29ya2Fyb3VuZCB0byBnZXQgQ2x1c3RlcklEXG5cbiAgICBjb25zdCBzdGFjayA9IFN0YWNrLm9mKHRoaXMpO1xuICAgIGNvbnN0IHJlZ2lvbiA9IHN0YWNrLnJlZ2lvbjtcblxuICAgIGNvbnN0IGFwcF9mZWRlcmF0ZWRQcmluY2lwYWwgPSBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgb2lkY1Byb3ZpZGVyQXJuLFxuICAgICAgICB7XG4gICAgICAgICAgICBTdHJpbmdFcXVhbHM6IG5ldyBDZm5Kc29uKHRoaXMsIFwiQXBwX0ZlZGVyYXRlZFByaW5jaXBhbENvbmRpdGlvblwiLCB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICAgICAgW2BvaWRjLmVrcy4ke3JlZ2lvbn0uYW1hem9uYXdzLmNvbS9pZC8ke2NsdXN0ZXJJZH06YXVkYCBdOiBcInN0cy5hbWF6b25hd3MuY29tXCJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgKTtcbiAgICBjb25zdCBhcHBfdHJ1c3RSZWxhdGlvbnNoaXAgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogWyBhcHBfZmVkZXJhdGVkUHJpbmNpcGFsIF0sXG4gICAgICAgIGFjdGlvbnM6IFtcInN0czpBc3N1bWVSb2xlV2l0aFdlYklkZW50aXR5XCJdXG4gICAgfSlcblxuXG4gICAgLy8gRnJvbnRFbmQgU0EgKFNTTSwgU1FTLCBTTlMpXG4gICAgY29uc3QgcGV0c3RvcmVzZXJ2aWNlYWNjb3VudCA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUGV0U2l0ZVNlcnZpY2VBY2NvdW50Jywge1xuLy8gICAgICAgICAgICAgICAgYXNzdW1lZEJ5OiBla3NGZWRlcmF0ZWRQcmluY2lwYWwsXG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uQWNjb3VudFJvb3RQcmluY2lwYWwoKSxcbiAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tTWFuYWdlZFBvbGljeUFybih0aGlzLCAnUGV0U2l0ZVNlcnZpY2VBY2NvdW50LUFtYXpvblNTTUZ1bGxBY2Nlc3MnLCAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQW1hem9uU1NNRnVsbEFjY2VzcycpLFxuICAgICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4odGhpcywgJ1BldFNpdGVTZXJ2aWNlQWNjb3VudC1BbWF6b25TUVNGdWxsQWNjZXNzJywgJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5L0FtYXpvblNRU0Z1bGxBY2Nlc3MnKSxcbiAgICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21NYW5hZ2VkUG9saWN5QXJuKHRoaXMsICdQZXRTaXRlU2VydmljZUFjY291bnQtQW1hem9uU05TRnVsbEFjY2VzcycsICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9BbWF6b25TTlNGdWxsQWNjZXNzJyksXG4gICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tTWFuYWdlZFBvbGljeUFybih0aGlzLCAnUGV0U2l0ZVNlcnZpY2VBY2NvdW50LUFXU1hSYXlEYWVtb25Xcml0ZUFjY2VzcycsICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9BV1NYUmF5RGFlbW9uV3JpdGVBY2Nlc3MnKVxuICAgICAgICBdLFxuICAgIH0pO1xuICAgIHBldHN0b3Jlc2VydmljZWFjY291bnQuYXNzdW1lUm9sZVBvbGljeT8uYWRkU3RhdGVtZW50cyhhcHBfdHJ1c3RSZWxhdGlvbnNoaXApO1xuXG4gICAgY29uc3Qgc3RhcnRTdGVwRm5FeGVjdXRpb25Qb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3N0YXRlczpTdGFydEV4ZWN1dGlvbidcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgICAgICB9KTtcblxuICAgIHBldHN0b3Jlc2VydmljZWFjY291bnQuYWRkVG9QcmluY2lwYWxQb2xpY3koc3RhcnRTdGVwRm5FeGVjdXRpb25Qb2xpY3kpO1xuXG4gICAgY29uc3QgcGV0c2l0ZUFzc2V0ID0gbmV3IERvY2tlckltYWdlQXNzZXQodGhpcywgJ3BldHNpdGVBc3NldCcsIHtcbiAgICAgICAgZGlyZWN0b3J5OiBcIi4vcmVzb3VyY2VzL21pY3Jvc2VydmljZXMvcGV0c2l0ZS9wZXRzaXRlL1wiXG4gICAgfSk7XG5cblxuICAgIHZhciBtYW5pZmVzdCA9IHJlYWRGaWxlU3luYyhcIi4vcmVzb3VyY2VzL2s4c19wZXRzaXRlL2RlcGxveW1lbnQueWFtbFwiLFwidXRmOFwiKTtcbiAgICB2YXIgZGVwbG95bWVudFlhbWwgPSB5YW1sLmxvYWRBbGwobWFuaWZlc3QpIGFzIFJlY29yZDxzdHJpbmcsYW55PltdO1xuXG4gICAgZGVwbG95bWVudFlhbWxbMF0ubWV0YWRhdGEuYW5ub3RhdGlvbnNbXCJla3MuYW1hem9uYXdzLmNvbS9yb2xlLWFyblwiXSA9IG5ldyBDZm5Kc29uKHRoaXMsIFwiZGVwbG95bWVudF9Sb2xlXCIsIHsgdmFsdWUgOiBgJHtwZXRzdG9yZXNlcnZpY2VhY2NvdW50LnJvbGVBcm59YCB9KTtcbiAgICBkZXBsb3ltZW50WWFtbFsyXS5zcGVjLnRlbXBsYXRlLnNwZWMuY29udGFpbmVyc1swXS5pbWFnZSA9IG5ldyBDZm5Kc29uKHRoaXMsIFwiZGVwbG95bWVudF9JbWFnZVwiLCB7IHZhbHVlIDogYCR7cGV0c2l0ZUFzc2V0LmltYWdlVXJpfWAgfSk7XG4gICAgZGVwbG95bWVudFlhbWxbM10uc3BlYy50YXJnZXRHcm91cEFSTiA9IG5ldyBDZm5Kc29uKHRoaXMsXCJ0YXJnZXRncm91cEFyblwiLCB7IHZhbHVlOiBgJHt0YXJnZXRHcm91cEFybn1gfSlcblxuICAgIGNvbnN0IGRlcGxveW1lbnRNYW5pZmVzdCA9IG5ldyBla3MuS3ViZXJuZXRlc01hbmlmZXN0KHRoaXMsXCJwZXRzaXRlZGVwbG95bWVudFwiLHtcbiAgICAgICAgY2x1c3RlcjogY2x1c3RlcixcbiAgICAgICAgbWFuaWZlc3Q6IGRlcGxveW1lbnRZYW1sXG4gICAgfSk7XG5cbiAgICAvLyBQZXRBZG9wdGlvbnNIaXN0b3J5IGFwcGxpY2F0aW9uIGRlZmluaXRpb25zLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBwZXRBZG9wdGlvbnNIaXN0b3J5Q29udGFpbmVySW1hZ2UgPSBuZXcgQ29udGFpbmVySW1hZ2VCdWlsZGVyKHRoaXMsICdwZXQtYWRvcHRpb25zLWhpc3RvcnktY29udGFpbmVyLWltYWdlJywge1xuICAgICAgIHJlcG9zaXRvcnlOYW1lOiBcInBldC1hZG9wdGlvbnMtaGlzdG9yeVwiLFxuICAgICAgIGRvY2tlckltYWdlQXNzZXREaXJlY3Rvcnk6IFwiLi9yZXNvdXJjZXMvbWljcm9zZXJ2aWNlcy9wZXRhZG9wdGlvbnNoaXN0b3J5LXB5XCIsXG4gICAgfSk7XG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcyxcInB1dFBldEFkb3B0aW9uSGlzdG9yeVJlcG9zaXRvcnlOYW1lXCIse1xuICAgICAgICBzdHJpbmdWYWx1ZTogcGV0QWRvcHRpb25zSGlzdG9yeUNvbnRhaW5lckltYWdlLnJlcG9zaXRvcnlVcmksXG4gICAgICAgIHBhcmFtZXRlck5hbWU6ICcvcGV0c3RvcmUvcGV0aGlzdG9yeXJlcG9zaXRvcnl1cmknXG4gICAgfSk7XG5cbiAgICBjb25zdCBwZXRBZG9wdGlvbnNIaXN0b3J5QXBwbGljYXRpb24gPSBuZXcgUGV0QWRvcHRpb25zSGlzdG9yeSh0aGlzLCAncGV0LWFkb3B0aW9ucy1oaXN0b3J5LWFwcGxpY2F0aW9uJywge1xuICAgICAgICBjbHVzdGVyOiBjbHVzdGVyLFxuICAgICAgICBhcHBfdHJ1c3RSZWxhdGlvbnNoaXA6IGFwcF90cnVzdFJlbGF0aW9uc2hpcCxcbiAgICAgICAga3ViZXJuZXRlc01hbmlmZXN0UGF0aDogXCIuL3Jlc291cmNlcy9taWNyb3NlcnZpY2VzL3BldGFkb3B0aW9uc2hpc3RvcnktcHkvZGVwbG95bWVudC55YW1sXCIsXG4gICAgICAgIG90ZWxDb25maWdNYXBQYXRoOiBcIi4vcmVzb3VyY2VzL21pY3Jvc2VydmljZXMvcGV0YWRvcHRpb25zaGlzdG9yeS1weS9vdGVsLWNvbGxlY3Rvci1jb25maWcueWFtbFwiLFxuICAgICAgICByZHNTZWNyZXRBcm46IHJkc1NlY3JldEFybixcbiAgICAgICAgcmVnaW9uOiByZWdpb24sXG4gICAgICAgIGltYWdlVXJpOiBwZXRBZG9wdGlvbnNIaXN0b3J5Q29udGFpbmVySW1hZ2UuaW1hZ2VVcmksXG4gICAgICAgIHRhcmdldEdyb3VwQXJuOiBwZXRIaXN0b3J5VGFyZ2V0R3JvdXBBcm5cbiAgICB9KTtcblxuICAgIHRoaXMuY3JlYXRlU3NtUGFyYW1ldGVycyhuZXcgTWFwKE9iamVjdC5lbnRyaWVzKHtcbiAgICAgICAgJy9la3MvcGV0c2l0ZS9zdGFja25hbWUnOiBzdGFja05hbWVcbiAgICB9KSkpO1xuXG4gICAgdGhpcy5jcmVhdGVPdXB1dHMobmV3IE1hcChPYmplY3QuZW50cmllcyh7XG4gICAgICAgICdQZXRTaXRlRUNSSW1hZ2VVUkwnOiBwZXRzaXRlQXNzZXQuaW1hZ2VVcmksXG4gICAgICAgICdQZXRTdG9yZVNlcnZpY2VBY2NvdW50QXJuJzogcGV0c3RvcmVzZXJ2aWNlYWNjb3VudC5yb2xlQXJuLFxuICAgIH0pKSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVNzbVBhcmFtZXRlcnMocGFyYW1zOiBNYXA8c3RyaW5nLCBzdHJpbmc+KSB7XG4gICAgcGFyYW1zLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgLy9jb25zdCBpZCA9IGtleS5yZXBsYWNlKCcvJywgJ18nKTtcbiAgICAgICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywga2V5LCB7IHBhcmFtZXRlck5hbWU6IGtleSwgc3RyaW5nVmFsdWU6IHZhbHVlIH0pO1xuICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlT3VwdXRzKHBhcmFtczogTWFwPHN0cmluZywgc3RyaW5nPikge1xuICAgIHBhcmFtcy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywga2V5LCB7IHZhbHVlOiB2YWx1ZSB9KVxuICAgIH0pO1xuICAgIH1cbn1cbiJdfQ==