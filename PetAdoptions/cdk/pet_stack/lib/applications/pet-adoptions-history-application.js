"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PetAdoptionsHistory = void 0;
const iam = require("aws-cdk-lib/aws-iam");
const eks = require("aws-cdk-lib/aws-eks");
const yaml = require("js-yaml");
const eks_application_1 = require("./eks-application");
const fs_1 = require("fs");
class PetAdoptionsHistory extends eks_application_1.EksApplication {
    constructor(scope, id, props) {
        var _a;
        super(scope, id, props);
        const petadoptionhistoryserviceaccount = new iam.Role(this, 'PetSiteServiceAccount', {
            //        assumedBy: eksFederatedPrincipal,
            assumedBy: new iam.AccountRootPrincipal(),
            managedPolicies: [
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetAdoptionHistoryServiceAccount-AWSXRayDaemonWriteAccess', 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'PetAdoptionHistoryServiceAccount-AmazonPrometheusRemoteWriteAccess', 'arn:aws:iam::aws:policy/AmazonPrometheusRemoteWriteAccess')
            ],
        });
        (_a = petadoptionhistoryserviceaccount.assumeRolePolicy) === null || _a === void 0 ? void 0 : _a.addStatements(props.app_trustRelationship);
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
        const rdsSecretPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "secretsmanager:GetSecretValue"
            ],
            resources: [props.rdsSecretArn]
        });
        petadoptionhistoryserviceaccount.addToPolicy(rdsSecretPolicy);
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
        var otelConfigMapManifest = (0, fs_1.readFileSync)(props.otelConfigMapPath, "utf8");
        var otelConfigMapYaml = yaml.loadAll(otelConfigMapManifest);
        otelConfigMapYaml[0].data["otel-config.yaml"] = otelConfigMapYaml[0].data["otel-config.yaml"].replace(/{{AWS_REGION}}/g, props.region);
        const otelConfigDeploymentManifest = new eks.KubernetesManifest(this, "otelConfigDeployment", {
            cluster: props.cluster,
            manifest: otelConfigMapYaml
        });
        // deployment manifest
        var manifest = (0, fs_1.readFileSync)(props.kubernetesManifestPath, "utf8");
        var deploymentYaml = yaml.loadAll(manifest);
        deploymentYaml[0].metadata.annotations["eks.amazonaws.com/role-arn"] = petadoptionhistoryserviceaccount.roleArn;
        deploymentYaml[2].spec.template.spec.containers[0].image = props.imageUri;
        deploymentYaml[2].spec.template.spec.containers[0].env[1].value = props.region;
        deploymentYaml[2].spec.template.spec.containers[0].env[3].value = `ClusterName=${props.cluster.clusterName}`;
        deploymentYaml[2].spec.template.spec.containers[0].env[5].value = props.region;
        deploymentYaml[2].spec.template.spec.containers[1].env[0].value = props.region;
        deploymentYaml[3].spec.targetGroupARN = props.targetGroupArn;
        const deploymentManifest = new eks.KubernetesManifest(this, "petsitedeployment", {
            cluster: props.cluster,
            manifest: deploymentYaml
        });
    }
}
exports.PetAdoptionsHistory = PetAdoptionsHistory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGV0LWFkb3B0aW9ucy1oaXN0b3J5LWFwcGxpY2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGV0LWFkb3B0aW9ucy1oaXN0b3J5LWFwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJDQUEyQztBQUMzQywyQ0FBMkM7QUFHM0MsZ0NBQWdDO0FBRWhDLHVEQUF1RTtBQUN2RSwyQkFBa0M7QUFTbEMsTUFBYSxtQkFBb0IsU0FBUSxnQ0FBYztJQUVyRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQStCOztRQUN2RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLGdDQUFnQyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDekYsMkNBQTJDO1lBQ25DLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRTtZQUN6QyxlQUFlLEVBQUU7Z0JBQ2IsR0FBRyxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsMkRBQTJELEVBQUUsa0RBQWtELENBQUM7Z0JBQzdKLEdBQUcsQ0FBQyxhQUFhLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLG9FQUFvRSxFQUFFLDJEQUEyRCxDQUFDO2FBQ2xMO1NBQ0osQ0FBQyxDQUFDO1FBQ0gsTUFBQSxnQ0FBZ0MsQ0FBQyxnQkFBZ0IsMENBQUUsYUFBYSxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRTlGLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ2hELE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNMLHlCQUF5QjtnQkFDekIsbUJBQW1CO2dCQUNuQixrQkFBa0I7Z0JBQ2xCLGtCQUFrQjthQUNyQjtZQUNELFNBQVMsRUFBRSxDQUFD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QyxLQUFLLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUMvRSxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsZUFBZSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzdHLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO1FBQy9FLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO1FBQy9FLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxjQUFjLENBQUM7UUFFN0QsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUMsbUJBQW1CLEVBQUM7WUFDM0UsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPO1lBQ3RCLFFBQVEsRUFBRSxjQUFjO1NBQzNCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FFRjtBQS9GRCxrREErRkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBla3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVrcyc7XG5pbXBvcnQgKiBhcyByZHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJkcyc7XG5pbXBvcnQgKiBhcyBzc20gZnJvbSAnYXdzLWNkay1saWIvYXdzLXNzbSc7XG5pbXBvcnQgKiBhcyB5YW1sIGZyb20gJ2pzLXlhbWwnO1xuaW1wb3J0IHsgQ2ZuSnNvbiB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEVrc0FwcGxpY2F0aW9uLCBFa3NBcHBsaWNhdGlvblByb3BzIH0gZnJvbSAnLi9la3MtYXBwbGljYXRpb24nXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJ1xuXG5leHBvcnQgaW50ZXJmYWNlIFBldEFkb3B0aW9uc0hpc3RvcnlQcm9wcyBleHRlbmRzIEVrc0FwcGxpY2F0aW9uUHJvcHMge1xuICAgIHJkc1NlY3JldEFybjogICAgICBzdHJpbmcsXG4gICAgdGFyZ2V0R3JvdXBBcm46ICAgIHN0cmluZyxcbiAgICBvdGVsQ29uZmlnTWFwUGF0aDogc3RyaW5nLFxufVxuXG5leHBvcnQgY2xhc3MgUGV0QWRvcHRpb25zSGlzdG9yeSBleHRlbmRzIEVrc0FwcGxpY2F0aW9uIHtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUGV0QWRvcHRpb25zSGlzdG9yeVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBwZXRhZG9wdGlvbmhpc3RvcnlzZXJ2aWNlYWNjb3VudCA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUGV0U2l0ZVNlcnZpY2VBY2NvdW50Jywge1xuLy8gICAgICAgIGFzc3VtZWRCeTogZWtzRmVkZXJhdGVkUHJpbmNpcGFsLFxuICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uQWNjb3VudFJvb3RQcmluY2lwYWwoKSxcbiAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tTWFuYWdlZFBvbGljeUFybih0aGlzLCAnUGV0QWRvcHRpb25IaXN0b3J5U2VydmljZUFjY291bnQtQVdTWFJheURhZW1vbldyaXRlQWNjZXNzJywgJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5L0FXU1hSYXlEYWVtb25Xcml0ZUFjY2VzcycpLFxuICAgICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4odGhpcywgJ1BldEFkb3B0aW9uSGlzdG9yeVNlcnZpY2VBY2NvdW50LUFtYXpvblByb21ldGhldXNSZW1vdGVXcml0ZUFjY2VzcycsICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9BbWF6b25Qcm9tZXRoZXVzUmVtb3RlV3JpdGVBY2Nlc3MnKVxuICAgICAgICBdLFxuICAgIH0pO1xuICAgIHBldGFkb3B0aW9uaGlzdG9yeXNlcnZpY2VhY2NvdW50LmFzc3VtZVJvbGVQb2xpY3k/LmFkZFN0YXRlbWVudHMocHJvcHMuYXBwX3RydXN0UmVsYXRpb25zaGlwKTtcblxuICAgIGNvbnN0IHJlYWRTU01QYXJhbXNQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgXCJzc206R2V0UGFyYW1ldGVyc0J5UGF0aFwiLFxuICAgICAgICAgICAgXCJzc206R2V0UGFyYW1ldGVyc1wiLFxuICAgICAgICAgICAgXCJzc206R2V0UGFyYW1ldGVyXCIsXG4gICAgICAgICAgICBcImVjMjpEZXNjcmliZVZwY3NcIlxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSk7XG4gICAgcGV0YWRvcHRpb25oaXN0b3J5c2VydmljZWFjY291bnQuYWRkVG9Qb2xpY3kocmVhZFNTTVBhcmFtc1BvbGljeSk7XG5cbiAgICBjb25zdCBkZGJTZWVkUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgIFwiZHluYW1vZGI6QmF0Y2hXcml0ZUl0ZW1cIixcbiAgICAgICAgICAgIFwiZHluYW1vZGI6TGlzdFRhYmxlc1wiLFxuICAgICAgICAgICAgXCJkeW5hbW9kYjpTY2FuXCIsXG4gICAgICAgICAgICBcImR5bmFtb2RiOlF1ZXJ5XCJcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgIH0pO1xuICAgIHBldGFkb3B0aW9uaGlzdG9yeXNlcnZpY2VhY2NvdW50LmFkZFRvUG9saWN5KGRkYlNlZWRQb2xpY3kpO1xuXG4gICAgY29uc3QgcmRzU2VjcmV0UG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWVcIlxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtwcm9wcy5yZHNTZWNyZXRBcm5dXG4gICAgfSk7XG4gICAgcGV0YWRvcHRpb25oaXN0b3J5c2VydmljZWFjY291bnQuYWRkVG9Qb2xpY3kocmRzU2VjcmV0UG9saWN5KTtcblxuICAgIGNvbnN0IGF3c090ZWxQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuXHRcdFx0XCJsb2dzOlB1dExvZ0V2ZW50c1wiLFxuXHRcdFx0XCJsb2dzOkNyZWF0ZUxvZ0dyb3VwXCIsXG5cdFx0XHRcImxvZ3M6Q3JlYXRlTG9nU3RyZWFtXCIsXG5cdFx0XHRcImxvZ3M6RGVzY3JpYmVMb2dTdHJlYW1zXCIsXG5cdFx0XHRcImxvZ3M6RGVzY3JpYmVMb2dHcm91cHNcIixcblx0XHRcdFwieHJheTpQdXRUcmFjZVNlZ21lbnRzXCIsXG5cdFx0XHRcInhyYXk6UHV0VGVsZW1ldHJ5UmVjb3Jkc1wiLFxuXHRcdFx0XCJ4cmF5OkdldFNhbXBsaW5nUnVsZXNcIixcblx0XHRcdFwieHJheTpHZXRTYW1wbGluZ1RhcmdldHNcIixcblx0XHRcdFwieHJheTpHZXRTYW1wbGluZ1N0YXRpc3RpY1N1bW1hcmllc1wiLFxuXHRcdFx0XCJzc206R2V0UGFyYW1ldGVyc1wiXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KTtcbiAgICBwZXRhZG9wdGlvbmhpc3RvcnlzZXJ2aWNlYWNjb3VudC5hZGRUb1BvbGljeShhd3NPdGVsUG9saWN5KTtcblxuICAgIC8vIG90ZWwgY29sbGVjdG9yIGNvbmZpZ1xuICAgIHZhciBvdGVsQ29uZmlnTWFwTWFuaWZlc3QgPSByZWFkRmlsZVN5bmMocHJvcHMub3RlbENvbmZpZ01hcFBhdGgsXCJ1dGY4XCIpO1xuICAgIHZhciBvdGVsQ29uZmlnTWFwWWFtbCA9IHlhbWwubG9hZEFsbChvdGVsQ29uZmlnTWFwTWFuaWZlc3QpIGFzIFJlY29yZDxzdHJpbmcsYW55PltdO1xuICAgIG90ZWxDb25maWdNYXBZYW1sWzBdLmRhdGFbXCJvdGVsLWNvbmZpZy55YW1sXCJdID0gb3RlbENvbmZpZ01hcFlhbWxbMF0uZGF0YVtcIm90ZWwtY29uZmlnLnlhbWxcIl0ucmVwbGFjZSgve3tBV1NfUkVHSU9OfX0vZywgcHJvcHMucmVnaW9uKTtcblxuICAgIGNvbnN0IG90ZWxDb25maWdEZXBsb3ltZW50TWFuaWZlc3QgPSBuZXcgZWtzLkt1YmVybmV0ZXNNYW5pZmVzdCh0aGlzLFwib3RlbENvbmZpZ0RlcGxveW1lbnRcIix7XG4gICAgICAgIGNsdXN0ZXI6IHByb3BzLmNsdXN0ZXIsXG4gICAgICAgIG1hbmlmZXN0OiBvdGVsQ29uZmlnTWFwWWFtbFxuICAgIH0pO1xuXG4gICAgLy8gZGVwbG95bWVudCBtYW5pZmVzdFxuICAgIHZhciBtYW5pZmVzdCA9IHJlYWRGaWxlU3luYyhwcm9wcy5rdWJlcm5ldGVzTWFuaWZlc3RQYXRoLFwidXRmOFwiKTtcbiAgICB2YXIgZGVwbG95bWVudFlhbWwgPSB5YW1sLmxvYWRBbGwobWFuaWZlc3QpIGFzIFJlY29yZDxzdHJpbmcsYW55PltdO1xuXG4gICAgZGVwbG95bWVudFlhbWxbMF0ubWV0YWRhdGEuYW5ub3RhdGlvbnNbXCJla3MuYW1hem9uYXdzLmNvbS9yb2xlLWFyblwiXSA9IHBldGFkb3B0aW9uaGlzdG9yeXNlcnZpY2VhY2NvdW50LnJvbGVBcm47XG4gICAgZGVwbG95bWVudFlhbWxbMl0uc3BlYy50ZW1wbGF0ZS5zcGVjLmNvbnRhaW5lcnNbMF0uaW1hZ2UgPSBwcm9wcy5pbWFnZVVyaTtcbiAgICBkZXBsb3ltZW50WWFtbFsyXS5zcGVjLnRlbXBsYXRlLnNwZWMuY29udGFpbmVyc1swXS5lbnZbMV0udmFsdWUgPSBwcm9wcy5yZWdpb247XG4gICAgZGVwbG95bWVudFlhbWxbMl0uc3BlYy50ZW1wbGF0ZS5zcGVjLmNvbnRhaW5lcnNbMF0uZW52WzNdLnZhbHVlID0gYENsdXN0ZXJOYW1lPSR7cHJvcHMuY2x1c3Rlci5jbHVzdGVyTmFtZX1gO1xuICAgIGRlcGxveW1lbnRZYW1sWzJdLnNwZWMudGVtcGxhdGUuc3BlYy5jb250YWluZXJzWzBdLmVudls1XS52YWx1ZSA9IHByb3BzLnJlZ2lvbjtcbiAgICBkZXBsb3ltZW50WWFtbFsyXS5zcGVjLnRlbXBsYXRlLnNwZWMuY29udGFpbmVyc1sxXS5lbnZbMF0udmFsdWUgPSBwcm9wcy5yZWdpb247XG4gICAgZGVwbG95bWVudFlhbWxbM10uc3BlYy50YXJnZXRHcm91cEFSTiA9IHByb3BzLnRhcmdldEdyb3VwQXJuO1xuXG4gICAgY29uc3QgZGVwbG95bWVudE1hbmlmZXN0ID0gbmV3IGVrcy5LdWJlcm5ldGVzTWFuaWZlc3QodGhpcyxcInBldHNpdGVkZXBsb3ltZW50XCIse1xuICAgICAgICBjbHVzdGVyOiBwcm9wcy5jbHVzdGVyLFxuICAgICAgICBtYW5pZmVzdDogZGVwbG95bWVudFlhbWxcbiAgICB9KTtcbiAgfVxuXG59XG4iXX0=