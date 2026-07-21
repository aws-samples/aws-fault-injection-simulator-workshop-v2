import * as iam from 'aws-cdk-lib/aws-iam';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as cdk from "aws-cdk-lib";
import * as yaml from 'js-yaml';
import { CfnJson } from 'aws-cdk-lib';
import { EksApplication, EksApplicationProps } from './eks-application'
import { readFileSync } from 'fs';
import { Construct } from 'constructs'

export interface PetAdoptionsHistoryProps extends EksApplicationProps {
    //rdsSecretArn:      string,
    rdsSecret: cdk.aws_secretsmanager.ISecret,
    targetGroupArn:    string,
    otelConfigMapPath: string,
}

export class PetAdoptionsHistory extends EksApplication {

  constructor(scope: Construct, id: string, props: PetAdoptionsHistoryProps) {
    super(scope, id, props);

    const petadoptionhistoryserviceaccount = new iam.Role(this, 'PetSiteServiceAccount', {
//        assumedBy: eksFederatedPrincipal,
        assumedBy: new iam.AccountRootPrincipal(),
        managedPolicies: [
            iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetAdoptionHistoryServiceAccount-AWSXRayDaemonWriteAccess', 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess'),
            iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetAdoptionHistoryServiceAccount-AmazonPrometheusRemoteWriteAccess', 'arn:aws:iam::aws:policy/AmazonPrometheusRemoteWriteAccess')
        ],
    });
    petadoptionhistoryserviceaccount.assumeRolePolicy?.addStatements(props.app_trustRelationship);

    const readSSMParamsPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            "ssm:GetParametersByPath",
            "ssm:GetParameters",
            "ssm:GetParameter",
            "ec2:DescribeVpcs"
        ],
        resources: ['*']
    });
    petadoptionhistoryserviceaccount.addToPolicy(readSSMParamsPolicy);

    const ddbSeedPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            "dynamodb:BatchWriteItem",
            "dynamodb:ListTables",
            "dynamodb:Scan",
            "dynamodb:Query"
        ],
        resources: ['*']
    });
    petadoptionhistoryserviceaccount.addToPolicy(ddbSeedPolicy);

    props.rdsSecret.grantRead(petadoptionhistoryserviceaccount);
    // const rdsSecretPolicy = new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: [
    //         "secretsmanager:GetSecretValue"
    //     ],
    //     resources: [props.rdsSecretArn]
    // });
    //petadoptionhistoryserviceaccount.addToPolicy(rdsSecretPolicy);

    const awsOtelPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
			"logs:PutLogEvents",
			"logs:CreateLogGroup",
			"logs:CreateLogStream",
			"logs:DescribeLogStreams",
			"logs:DescribeLogGroups",
			"xray:PutTraceSegments",
			"xray:PutTelemetryRecords",
			"xray:GetSamplingRules",
			"xray:GetSamplingTargets",
			"xray:GetSamplingStatisticSummaries",
			"ssm:GetParameters"
        ],
        resources: ['*']
    });
    petadoptionhistoryserviceaccount.addToPolicy(awsOtelPolicy);

    // otel collector config
    var otelConfigMapManifest = readFileSync(props.otelConfigMapPath,"utf8");
    var otelConfigMapYaml = yaml.loadAll(otelConfigMapManifest) as Record<string,any>[];
    otelConfigMapYaml[0].data["otel-config.yaml"] = otelConfigMapYaml[0].data["otel-config.yaml"].replace(/{{AWS_REGION}}/g, props.region);

    const otelConfigDeploymentManifest = new eks.KubernetesManifest(this,"otelConfigDeployment",{
        cluster: props.cluster,
        manifest: otelConfigMapYaml
    });

    // deployment manifest
    var manifest = readFileSync(props.kubernetesManifestPath,"utf8");
    var deploymentYaml = yaml.loadAll(manifest) as Record<string,any>[];

    deploymentYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = petadoptionhistoryserviceaccount.roleArn;
    deploymentYaml[2].spec.template.spec.containers[0].image = props.imageUri;
    // Substitute env values by NAME (not array position) so adding/reordering env
    // vars in deployment.yaml — e.g. the SERVICE_NAME / NODE_NAME / POD_NAME /
    // POD_IP context vars — can't silently corrupt these values.
    const setEnv = (container: any, name: string, value: string) => {
        const entry = container.env.find((e: any) => e.name === name);
        if (entry) { entry.value = value; }
    };
    const appContainer = deploymentYaml[2].spec.template.spec.containers[0];
    setEnv(appContainer, 'AWS_REGION', props.region);
    setEnv(appContainer, 'OTEL_RESOURCE', `ClusterName=${props.cluster.clusterName}`);
    setEnv(appContainer, 'S3_REGION', props.region);
    setEnv(deploymentYaml[2].spec.template.spec.containers[1], 'AWS_REGION', props.region);
    deploymentYaml[3].spec.targetGroupARN = props.targetGroupArn;

    const deploymentManifest = new eks.KubernetesManifest(this,"petsitedeployment",{
        cluster: props.cluster,
        manifest: deploymentYaml
    });
  }

}
