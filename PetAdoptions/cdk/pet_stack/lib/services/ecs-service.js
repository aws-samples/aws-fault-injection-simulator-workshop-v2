"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcsService = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const iam = require("aws-cdk-lib/aws-iam");
const ecs = require("aws-cdk-lib/aws-ecs");
const logs = require("aws-cdk-lib/aws-logs");
const ecs_patterns = require("aws-cdk-lib/aws-ecs-patterns");
const constructs_1 = require("constructs");
class EcsService extends constructs_1.Construct {
    constructor(scope, id, props) {
        var _a, _b, _c, _d;
        super(scope, id);
        const logging = new ecs.AwsLogDriver({
            streamPrefix: "logs",
            logGroup: new logs.LogGroup(this, "ecs-log-group", {
                logGroupName: props.logGroupName,
                removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY
            })
        });
        /*
        const firelenslogging = new ecs.FireLensLogDriver({
          options: {
            "Name": "cloudwatch",
            "region": props.region,
            "log_key": "log",
            "log_group_name": props.logGroupName,
            "auto_create_group": "false",
            "log_stream_name": "$(ecs_task_id)"
          }
        });
       //*/
        const taskRole = new iam.Role(this, `taskRole`, {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
        });
        this.taskDefinition = new ecs.FargateTaskDefinition(this, "taskDefinition", {
            cpu: props.cpu,
            taskRole: taskRole,
            memoryLimitMiB: props.memoryLimitMiB
        });
        this.taskDefinition.addToExecutionRolePolicy(EcsService.ExecutionRolePolicy);
        (_a = this.taskDefinition.taskRole) === null || _a === void 0 ? void 0 : _a.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'AmazonECSTaskExecutionRolePolicy', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'));
        (_b = this.taskDefinition.taskRole) === null || _b === void 0 ? void 0 : _b.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'AWSXrayWriteOnlyAccess', 'arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess'));
        // Build locally the image only if the repository URI is not specified
        // Can help speed up builds if we are not rebuilding anything
        const image = props.repositoryURI ? this.containerImageFromRepository(props.repositoryURI) : this.createContainerImage();
        this.container = this.taskDefinition.addContainer('container', {
            image: image,
            memoryLimitMiB: 512,
            cpu: 256,
            logging,
            environment: {
                AWS_REGION: props.region,
            }
        });
        this.container.addPortMappings({
            containerPort: 80,
            protocol: ecs.Protocol.TCP
        });
        if (props.enableSSM) {
            (_c = this.taskDefinition.taskRole) === null || _c === void 0 ? void 0 : _c.addToPrincipalPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "ssm:CreateActivation",
                    "ssm:AddTagsToResource",
                ],
                resources: ["*"],
            }));
            const ssmRole = new iam.Role(this, `ssmRole`, {
                assumedBy: new iam.ServicePrincipal('ssm.amazonaws.com'),
                managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')]
            });
            ssmRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "ssm:DeleteActivation"
                ],
                resources: ["*"],
            }));
            ssmRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "ssm:DeregisterManagedInstance"
                ],
                resources: ['arn:aws:ssm:' + props.region + ':*:managed-instance/*'],
            }));
            (_d = this.taskDefinition.taskRole) === null || _d === void 0 ? void 0 : _d.addToPrincipalPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "iam:GetRole",
                    "iam:PassRole"
                ],
                resources: [ssmRole.roleArn]
            }));
            this.taskDefinition.addContainer('amazon-ssm-agent', {
                image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazon-ssm-agent/amazon-ssm-agent:latest'),
                memoryLimitMiB: 256,
                essential: false,
                //cpu: 256,
                logging,
                environment: {
                    MANAGED_INSTANCE_ROLE_NAME: ssmRole.roleName,
                    AWS_REGION: props.region,
                },
                command: [
                    "/bin/bash",
                    "-c",
                    "set -e; yum upgrade -y; yum install jq procps awscli -y; term_handler() { echo \"Deleting SSM activation $ACTIVATION_ID\"; if ! aws ssm delete-activation --activation-id $ACTIVATION_ID --region $ECS_TASK_REGION; then echo \"SSM activation $ACTIVATION_ID failed to be deleted\" 1>&2; fi; MANAGED_INSTANCE_ID=$(jq -e -r .ManagedInstanceID /var/lib/amazon/ssm/registration); echo \"Deregistering SSM Managed Instance $MANAGED_INSTANCE_ID\"; if ! aws ssm deregister-managed-instance --instance-id $MANAGED_INSTANCE_ID --region $ECS_TASK_REGION; then echo \"SSM Managed Instance $MANAGED_INSTANCE_ID failed to be deregistered\" 1>&2; fi; kill -SIGTERM $SSM_AGENT_PID; }; trap term_handler SIGTERM SIGINT; if [[ -z $MANAGED_INSTANCE_ROLE_NAME ]]; then echo \"Environment variable MANAGED_INSTANCE_ROLE_NAME not set, exiting\" 1>&2; exit 1; fi; if ! ps ax | grep amazon-ssm-agent | grep -v grep > /dev/null; then if [[ -n $ECS_CONTAINER_METADATA_URI_V4 ]] ; then echo \"Found ECS Container Metadata, running activation with metadata\"; TASK_METADATA=$(curl \"${ECS_CONTAINER_METADATA_URI_V4}/task\"); ECS_TASK_AVAILABILITY_ZONE=$(echo $TASK_METADATA | jq -e -r '.AvailabilityZone'); ECS_TASK_ARN=$(echo $TASK_METADATA | jq -e -r '.TaskARN'); ECS_TASK_REGION=$(echo $ECS_TASK_AVAILABILITY_ZONE | sed 's/.$//'); ECS_TASK_AVAILABILITY_ZONE_REGEX='^(af|ap|ca|cn|eu|me|sa|us|us-gov)-(central|north|(north(east|west))|south|south(east|west)|east|west)-[0-9]{1}[a-z]{1}$'; if ! [[ $ECS_TASK_AVAILABILITY_ZONE =~ $ECS_TASK_AVAILABILITY_ZONE_REGEX ]]; then echo \"Error extracting Availability Zone from ECS Container Metadata, exiting\" 1>&2; exit 1; fi; ECS_TASK_ARN_REGEX='^arn:(aws|aws-cn|aws-us-gov):ecs:[a-z0-9-]+:[0-9]{12}:task/[a-zA-Z0-9_-]+/[a-zA-Z0-9]+$'; if ! [[ $ECS_TASK_ARN =~ $ECS_TASK_ARN_REGEX ]]; then echo \"Error extracting Task ARN from ECS Container Metadata, exiting\" 1>&2; exit 1; fi; CREATE_ACTIVATION_OUTPUT=$(aws ssm create-activation --iam-role $MANAGED_INSTANCE_ROLE_NAME --tags Key=ECS_TASK_AVAILABILITY_ZONE,Value=$ECS_TASK_AVAILABILITY_ZONE Key=ECS_TASK_ARN,Value=$ECS_TASK_ARN --region $ECS_TASK_REGION); ACTIVATION_CODE=$(echo $CREATE_ACTIVATION_OUTPUT | jq -e -r .ActivationCode); ACTIVATION_ID=$(echo $CREATE_ACTIVATION_OUTPUT | jq -e -r .ActivationId); if ! amazon-ssm-agent -register -code $ACTIVATION_CODE -id $ACTIVATION_ID -region $ECS_TASK_REGION; then echo \"Failed to register with AWS Systems Manager (SSM), exiting\" 1>&2; exit 1; fi; amazon-ssm-agent & SSM_AGENT_PID=$!; wait $SSM_AGENT_PID; else echo \"ECS Container Metadata not found, exiting\" 1>&2; exit 1; fi; else echo \"SSM agent is already running, exiting\" 1>&2; exit 1; fi"
                ],
            });
        }
        /*
        this.taskDefinition.addFirelensLogRouter('firelensrouter', {
          firelensConfig: {
            type: ecs.FirelensLogRouterType.FLUENTBIT
          },
          image: ecs.ContainerImage.fromRegistry('public.ecr.aws/aws-observability/aws-for-fluent-bit:stable')
        })
       //*/
        // sidecar for instrumentation collecting
        switch (props.instrumentation) {
            // we don't add any sidecar if instrumentation is none
            case "none": {
                break;
            }
            // This collector would be used for both traces collected using
            // open telemetry or X-Ray
            case "otel": {
                this.addOtelCollectorContainer(this.taskDefinition, logging);
                break;
            }
            // Default X-Ray traces collector
            case "xray": {
                this.addXRayContainer(this.taskDefinition, logging);
                break;
            }
            // Default X-Ray traces collector
            // enabled by default
            default: {
                this.addXRayContainer(this.taskDefinition, logging);
                break;
            }
        }
        if (!props.disableService) {
            this.service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "ecs-service", {
                cluster: props.cluster,
                taskDefinition: this.taskDefinition,
                publicLoadBalancer: true,
                desiredCount: props.desiredTaskCount,
                listenerPort: 80,
                securityGroups: [props.securityGroup]
            });
            if (props.healthCheck) {
                this.service.targetGroup.configureHealthCheck({
                    path: props.healthCheck
                });
            }
        }
    }
    addXRayContainer(taskDefinition, logging) {
        taskDefinition.addContainer('xraydaemon', {
            image: ecs.ContainerImage.fromRegistry('public.ecr.aws/xray/aws-xray-daemon:3.3.4'),
            memoryLimitMiB: 256,
            cpu: 256,
            logging
        }).addPortMappings({
            containerPort: 2000,
            protocol: ecs.Protocol.UDP
        });
    }
    addOtelCollectorContainer(taskDefinition, logging) {
        taskDefinition.addContainer('aws-otel-collector', {
            image: ecs.ContainerImage.fromRegistry('public.ecr.aws/aws-observability/aws-otel-collector:v0.32.0'),
            memoryLimitMiB: 256,
            cpu: 256,
            command: ["--config", "/etc/ecs/ecs-xray.yaml"],
            logging
        });
    }
}
exports.EcsService = EcsService;
EcsService.ExecutionRolePolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    resources: ['*'],
    actions: [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogGroup",
        "logs:DescribeLogStreams",
        "logs:CreateLogStream",
        "logs:DescribeLogGroups",
        "logs:PutLogEvents",
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords",
        "xray:GetSamplingRules",
        "xray:GetSamplingTargets",
        "xray:GetSamplingStatisticSummaries",
        'ssm:GetParameters'
    ]
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzLXNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlY3Mtc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBNEM7QUFDNUMsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUMzQyw2Q0FBNkM7QUFDN0MsNkRBQTZEO0FBRTdELDJDQUFzQztBQXdCdEMsTUFBc0IsVUFBVyxTQUFRLHNCQUFTO0lBNEJoRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCOztRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQztZQUNuQyxZQUFZLEVBQUUsTUFBTTtZQUNwQixRQUFRLEVBQUUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7Z0JBQ2pELFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtnQkFDaEMsYUFBYSxFQUFFLDJCQUFhLENBQUMsT0FBTzthQUNyQyxDQUFDO1NBQ0gsQ0FBQyxDQUFDO1FBRUg7Ozs7Ozs7Ozs7O1dBV0c7UUFFSCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUM5QyxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMseUJBQXlCLENBQUM7U0FDL0QsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDMUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO1lBQ2QsUUFBUSxFQUFFLFFBQVE7WUFDbEIsY0FBYyxFQUFFLEtBQUssQ0FBQyxjQUFjO1NBQ3JDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDN0UsTUFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsMENBQUUsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsa0NBQWtDLEVBQUUsdUVBQXVFLENBQUMsQ0FBQyxDQUFDO1FBQzFNLE1BQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLDBDQUFFLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFLGdEQUFnRCxDQUFDLENBQUMsQ0FBQztRQUV6SyxzRUFBc0U7UUFDdEUsNkRBQTZEO1FBQzdELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFBO1FBRXZILElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFO1lBQzdELEtBQUssRUFBRSxLQUFLO1lBQ1osY0FBYyxFQUFFLEdBQUc7WUFDbkIsR0FBRyxFQUFFLEdBQUc7WUFDUixPQUFPO1lBQ1AsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxLQUFLLENBQUMsTUFBTTthQUN6QjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO1lBQzdCLGFBQWEsRUFBRSxFQUFFO1lBQ2pCLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUc7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFHLENBQUM7WUFFckIsTUFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsMENBQUUsb0JBQW9CLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO2dCQUN6RSxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO2dCQUN4QixPQUFPLEVBQUU7b0JBQ1Asc0JBQXNCO29CQUN0Qix1QkFBdUI7aUJBQzFCO2dCQUNDLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQzthQUNqQixDQUFDLENBQUMsQ0FBQztZQUVOLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO2dCQUM1QyxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsbUJBQW1CLENBQUM7Z0JBQ3hELGVBQWUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsOEJBQThCLENBQUMsQ0FBQzthQUM5RixDQUFDLENBQUM7WUFFSCxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztnQkFDMUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztnQkFDeEIsT0FBTyxFQUFFO29CQUNQLHNCQUFzQjtpQkFDdkI7Z0JBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO2FBQ2pCLENBQUMsQ0FBQyxDQUFDO1lBRUosT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7Z0JBQzFDLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7Z0JBQ3hCLE9BQU8sRUFBRTtvQkFDUCwrQkFBK0I7aUJBQ2hDO2dCQUNELFNBQVMsRUFBRSxDQUFDLGNBQWMsR0FBQyxLQUFLLENBQUMsTUFBTSxHQUFDLHVCQUF1QixDQUFDO2FBQ2pFLENBQUMsQ0FBQyxDQUFDO1lBRUosTUFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsMENBQUUsb0JBQW9CLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO2dCQUN6RSxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO2dCQUN4QixPQUFPLEVBQUU7b0JBQ1AsYUFBYTtvQkFDYixjQUFjO2lCQUNmO2dCQUNELFNBQVMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7YUFDN0IsQ0FBQyxDQUFDLENBQUM7WUFFSixJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBQztnQkFDbEQsS0FBSyxFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLHlEQUF5RCxDQUFDO2dCQUNqRyxjQUFjLEVBQUUsR0FBRztnQkFDbkIsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLFdBQVc7Z0JBQ1gsT0FBTztnQkFDUCxXQUFXLEVBQUU7b0JBQ1gsMEJBQTBCLEVBQUMsT0FBTyxDQUFDLFFBQVE7b0JBQzNDLFVBQVUsRUFBRSxLQUFLLENBQUMsTUFBTTtpQkFDekI7Z0JBQ0QsT0FBTyxFQUFFO29CQUNQLFdBQVc7b0JBQ1gsSUFBSTtvQkFDSiw0bUZBQTRtRjtpQkFDN21GO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVDOzs7Ozs7O1dBT0c7UUFFSCx5Q0FBeUM7UUFDekMsUUFBTyxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7WUFFN0Isc0RBQXNEO1lBQ3RELEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDWixNQUFNO1lBQ1IsQ0FBQztZQUVELCtEQUErRDtZQUMvRCwwQkFBMEI7WUFDMUIsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUNaLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUM3RCxNQUFNO1lBQ1IsQ0FBQztZQUVELGlDQUFpQztZQUNqQyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1osSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ3BELE1BQU07WUFDUixDQUFDO1lBRUQsaUNBQWlDO1lBQ2pDLHFCQUFxQjtZQUNyQixPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNSLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNwRCxNQUFNO1lBQ1IsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQzFCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxZQUFZLENBQUMscUNBQXFDLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtnQkFDekYsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPO2dCQUN0QixjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWM7Z0JBQ25DLGtCQUFrQixFQUFFLElBQUk7Z0JBQ3hCLFlBQVksRUFBRSxLQUFLLENBQUMsZ0JBQWdCO2dCQUNwQyxZQUFZLEVBQUUsRUFBRTtnQkFDaEIsY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQzthQUV0QyxDQUFDLENBQUE7WUFFRixJQUFJLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDdEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUM7b0JBQzVDLElBQUksRUFBRSxLQUFLLENBQUMsV0FBVztpQkFDeEIsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBTU8sZ0JBQWdCLENBQUMsY0FBeUMsRUFBRSxPQUF5QjtRQUMzRixjQUFjLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRTtZQUN4QyxLQUFLLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsMkNBQTJDLENBQUM7WUFDbkYsY0FBYyxFQUFFLEdBQUc7WUFDbkIsR0FBRyxFQUFFLEdBQUc7WUFDUixPQUFPO1NBQ1IsQ0FBQyxDQUFDLGVBQWUsQ0FBQztZQUNqQixhQUFhLEVBQUUsSUFBSTtZQUNuQixRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHO1NBQzNCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyx5QkFBeUIsQ0FBQyxjQUF5QyxFQUFFLE9BQXlCO1FBQ3BHLGNBQWMsQ0FBQyxZQUFZLENBQUMsb0JBQW9CLEVBQUU7WUFDOUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLDZEQUE2RCxDQUFDO1lBQ3JHLGNBQWMsRUFBRSxHQUFHO1lBQ25CLEdBQUcsRUFBRSxHQUFHO1lBQ1IsT0FBTyxFQUFFLENBQUMsVUFBVSxFQUFFLHdCQUF3QixDQUFDO1lBQy9DLE9BQU87U0FDVixDQUFDLENBQUM7SUFDTCxDQUFDOztBQWpPSCxnQ0FrT0M7QUFoT2dCLDhCQUFtQixHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztJQUMzRCxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO0lBQ3hCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztJQUNoQixPQUFPLEVBQUU7UUFDUCwyQkFBMkI7UUFDM0IsaUNBQWlDO1FBQ2pDLDRCQUE0QjtRQUM1QixtQkFBbUI7UUFDbkIscUJBQXFCO1FBQ3JCLHlCQUF5QjtRQUN6QixzQkFBc0I7UUFDdEIsd0JBQXdCO1FBQ3hCLG1CQUFtQjtRQUNuQix1QkFBdUI7UUFDdkIsMEJBQTBCO1FBQzFCLHVCQUF1QjtRQUN2Qix5QkFBeUI7UUFDekIsb0NBQW9DO1FBQ3BDLG1CQUFtQjtLQUNwQjtDQUNGLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJlbW92YWxQb2xpY3kgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGVjc19wYXR0ZXJucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNzLXBhdHRlcm5zJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnXG5cbmV4cG9ydCBpbnRlcmZhY2UgRWNzU2VydmljZVByb3BzIHtcbiAgY2x1c3Rlcj86IGVjcy5DbHVzdGVyLFxuXG4gIGNwdTogbnVtYmVyO1xuICBtZW1vcnlMaW1pdE1pQjogbnVtYmVyLFxuICBsb2dHcm91cE5hbWU6IHN0cmluZyxcblxuICBoZWFsdGhDaGVjaz86IHN0cmluZyxcblxuICBkaXNhYmxlU2VydmljZT86IGJvb2xlYW4sXG4gIGluc3RydW1lbnRhdGlvbj86IHN0cmluZyxcbiAgZW5hYmxlU1NNOiBib29sZWFuLFxuXG4gIHJlcG9zaXRvcnlVUkk/OiBzdHJpbmcsXG5cbiAgZGVzaXJlZFRhc2tDb3VudDogbnVtYmVyLFxuXG4gIHJlZ2lvbjogc3RyaW5nLFxuXG4gIHNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwXG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBFY3NTZXJ2aWNlIGV4dGVuZHMgQ29uc3RydWN0IHtcblxuICBwcml2YXRlIHN0YXRpYyBFeGVjdXRpb25Sb2xlUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIGFjdGlvbnM6IFtcbiAgICAgIFwiZWNyOkdldEF1dGhvcml6YXRpb25Ub2tlblwiLFxuICAgICAgXCJlY3I6QmF0Y2hDaGVja0xheWVyQXZhaWxhYmlsaXR5XCIsXG4gICAgICBcImVjcjpHZXREb3dubG9hZFVybEZvckxheWVyXCIsXG4gICAgICBcImVjcjpCYXRjaEdldEltYWdlXCIsXG4gICAgICBcImxvZ3M6Q3JlYXRlTG9nR3JvdXBcIixcbiAgICAgIFwibG9nczpEZXNjcmliZUxvZ1N0cmVhbXNcIixcbiAgICAgIFwibG9nczpDcmVhdGVMb2dTdHJlYW1cIixcbiAgICAgIFwibG9nczpEZXNjcmliZUxvZ0dyb3Vwc1wiLFxuICAgICAgXCJsb2dzOlB1dExvZ0V2ZW50c1wiLFxuICAgICAgXCJ4cmF5OlB1dFRyYWNlU2VnbWVudHNcIixcbiAgICAgIFwieHJheTpQdXRUZWxlbWV0cnlSZWNvcmRzXCIsXG4gICAgICBcInhyYXk6R2V0U2FtcGxpbmdSdWxlc1wiLFxuICAgICAgXCJ4cmF5OkdldFNhbXBsaW5nVGFyZ2V0c1wiLFxuICAgICAgXCJ4cmF5OkdldFNhbXBsaW5nU3RhdGlzdGljU3VtbWFyaWVzXCIsXG4gICAgICAnc3NtOkdldFBhcmFtZXRlcnMnXG4gICAgXVxuICB9KTtcblxuICBwdWJsaWMgcmVhZG9ubHkgdGFza0RlZmluaXRpb246IGVjcy5UYXNrRGVmaW5pdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHNlcnZpY2U6IGVjc19wYXR0ZXJucy5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlZFNlcnZpY2VCYXNlO1xuICBwdWJsaWMgcmVhZG9ubHkgY29udGFpbmVyOiBlY3MuQ29udGFpbmVyRGVmaW5pdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRWNzU2VydmljZVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IGxvZ2dpbmcgPSBuZXcgZWNzLkF3c0xvZ0RyaXZlcih7XG4gICAgICBzdHJlYW1QcmVmaXg6IFwibG9nc1wiLFxuICAgICAgbG9nR3JvdXA6IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiZWNzLWxvZy1ncm91cFwiLCB7XG4gICAgICAgIGxvZ0dyb3VwTmFtZTogcHJvcHMubG9nR3JvdXBOYW1lLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICAgIH0pXG4gICAgfSk7XG5cbiAgICAvKlxuICAgIGNvbnN0IGZpcmVsZW5zbG9nZ2luZyA9IG5ldyBlY3MuRmlyZUxlbnNMb2dEcml2ZXIoe1xuICAgICAgb3B0aW9uczoge1xuICAgICAgICBcIk5hbWVcIjogXCJjbG91ZHdhdGNoXCIsXG4gICAgICAgIFwicmVnaW9uXCI6IHByb3BzLnJlZ2lvbixcbiAgICAgICAgXCJsb2dfa2V5XCI6IFwibG9nXCIsXG4gICAgICAgIFwibG9nX2dyb3VwX25hbWVcIjogcHJvcHMubG9nR3JvdXBOYW1lLFxuICAgICAgICBcImF1dG9fY3JlYXRlX2dyb3VwXCI6IFwiZmFsc2VcIixcbiAgICAgICAgXCJsb2dfc3RyZWFtX25hbWVcIjogXCIkKGVjc190YXNrX2lkKVwiXG4gICAgICB9XG4gICAgfSk7XG4gICAvLyovXG5cbiAgICBjb25zdCB0YXNrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBgdGFza1JvbGVgLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWNzLXRhc2tzLmFtYXpvbmF3cy5jb20nKVxuICAgIH0pO1xuXG4gICAgdGhpcy50YXNrRGVmaW5pdGlvbiA9IG5ldyBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uKHRoaXMsIFwidGFza0RlZmluaXRpb25cIiwge1xuICAgICAgY3B1OiBwcm9wcy5jcHUsXG4gICAgICB0YXNrUm9sZTogdGFza1JvbGUsXG4gICAgICBtZW1vcnlMaW1pdE1pQjogcHJvcHMubWVtb3J5TGltaXRNaUJcbiAgICB9KTtcblxuICAgIHRoaXMudGFza0RlZmluaXRpb24uYWRkVG9FeGVjdXRpb25Sb2xlUG9saWN5KEVjc1NlcnZpY2UuRXhlY3V0aW9uUm9sZVBvbGljeSk7XG4gICAgdGhpcy50YXNrRGVmaW5pdGlvbi50YXNrUm9sZT8uYWRkTWFuYWdlZFBvbGljeShpYW0uTWFuYWdlZFBvbGljeS5mcm9tTWFuYWdlZFBvbGljeUFybih0aGlzLCAnQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3knLCAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FtYXpvbkVDU1Rhc2tFeGVjdXRpb25Sb2xlUG9saWN5JykpO1xuICAgIHRoaXMudGFza0RlZmluaXRpb24udGFza1JvbGU/LmFkZE1hbmFnZWRQb2xpY3koaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4odGhpcywgJ0FXU1hyYXlXcml0ZU9ubHlBY2Nlc3MnLCAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQVdTWHJheVdyaXRlT25seUFjY2VzcycpKTtcblxuICAgIC8vIEJ1aWxkIGxvY2FsbHkgdGhlIGltYWdlIG9ubHkgaWYgdGhlIHJlcG9zaXRvcnkgVVJJIGlzIG5vdCBzcGVjaWZpZWRcbiAgICAvLyBDYW4gaGVscCBzcGVlZCB1cCBidWlsZHMgaWYgd2UgYXJlIG5vdCByZWJ1aWxkaW5nIGFueXRoaW5nXG4gICAgY29uc3QgaW1hZ2UgPSBwcm9wcy5yZXBvc2l0b3J5VVJJPyB0aGlzLmNvbnRhaW5lckltYWdlRnJvbVJlcG9zaXRvcnkocHJvcHMucmVwb3NpdG9yeVVSSSkgOiB0aGlzLmNyZWF0ZUNvbnRhaW5lckltYWdlKClcblxuICAgIHRoaXMuY29udGFpbmVyID0gdGhpcy50YXNrRGVmaW5pdGlvbi5hZGRDb250YWluZXIoJ2NvbnRhaW5lcicsIHtcbiAgICAgIGltYWdlOiBpbWFnZSxcbiAgICAgIG1lbW9yeUxpbWl0TWlCOiA1MTIsXG4gICAgICBjcHU6IDI1NixcbiAgICAgIGxvZ2dpbmcsXG4gICAgICBlbnZpcm9ubWVudDogeyAvLyBjbGVhciB0ZXh0LCBub3QgZm9yIHNlbnNpdGl2ZSBkYXRhXG4gICAgICAgIEFXU19SRUdJT046IHByb3BzLnJlZ2lvbixcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuY29udGFpbmVyLmFkZFBvcnRNYXBwaW5ncyh7XG4gICAgICBjb250YWluZXJQb3J0OiA4MCxcbiAgICAgIHByb3RvY29sOiBlY3MuUHJvdG9jb2wuVENQXG4gICAgfSk7XG5cbiAgICBpZiAocHJvcHMuZW5hYmxlU1NNKSAge1xuXG4gICAgICB0aGlzLnRhc2tEZWZpbml0aW9uLnRhc2tSb2xlPy5hZGRUb1ByaW5jaXBhbFBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwic3NtOkNyZWF0ZUFjdGl2YXRpb25cIixcbiAgICAgICAgICBcInNzbTpBZGRUYWdzVG9SZXNvdXJjZVwiLFxuICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSkpO1xuXG4gICAgY29uc3Qgc3NtUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBgc3NtUm9sZWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdzc20uYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TU01NYW5hZ2VkSW5zdGFuY2VDb3JlJyldXG4gICAgfSk7XG5cbiAgICBzc21Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgXCJzc206RGVsZXRlQWN0aXZhdGlvblwiXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgIH0pKTtcblxuICAgIHNzbVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICBcInNzbTpEZXJlZ2lzdGVyTWFuYWdlZEluc3RhbmNlXCJcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnYXJuOmF3czpzc206Jytwcm9wcy5yZWdpb24rJzoqOm1hbmFnZWQtaW5zdGFuY2UvKiddLFxuICAgIH0pKTtcblxuICAgIHRoaXMudGFza0RlZmluaXRpb24udGFza1JvbGU/LmFkZFRvUHJpbmNpcGFsUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgXCJpYW06R2V0Um9sZVwiLFxuICAgICAgICBcImlhbTpQYXNzUm9sZVwiXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbc3NtUm9sZS5yb2xlQXJuXVxuICAgIH0pKTtcblxuICAgIHRoaXMudGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKCdhbWF6b24tc3NtLWFnZW50Jyx7XG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21SZWdpc3RyeSgncHVibGljLmVjci5hd3MvYW1hem9uLXNzbS1hZ2VudC9hbWF6b24tc3NtLWFnZW50OmxhdGVzdCcpLFxuICAgICAgbWVtb3J5TGltaXRNaUI6IDI1NixcbiAgICAgIGVzc2VudGlhbDogZmFsc2UsXG4gICAgICAvL2NwdTogMjU2LFxuICAgICAgbG9nZ2luZyxcbiAgICAgIGVudmlyb25tZW50OiB7IC8vIGNsZWFyIHRleHQsIG5vdCBmb3Igc2Vuc2l0aXZlIGRhdGFcbiAgICAgICAgTUFOQUdFRF9JTlNUQU5DRV9ST0xFX05BTUU6c3NtUm9sZS5yb2xlTmFtZSxcbiAgICAgICAgQVdTX1JFR0lPTjogcHJvcHMucmVnaW9uLFxuICAgICAgfSxcbiAgICAgIGNvbW1hbmQ6IFtcbiAgICAgICAgXCIvYmluL2Jhc2hcIixcbiAgICAgICAgXCItY1wiLFxuICAgICAgICBcInNldCAtZTsgeXVtIHVwZ3JhZGUgLXk7IHl1bSBpbnN0YWxsIGpxIHByb2NwcyBhd3NjbGkgLXk7IHRlcm1faGFuZGxlcigpIHsgZWNobyBcXFwiRGVsZXRpbmcgU1NNIGFjdGl2YXRpb24gJEFDVElWQVRJT05fSURcXFwiOyBpZiAhIGF3cyBzc20gZGVsZXRlLWFjdGl2YXRpb24gLS1hY3RpdmF0aW9uLWlkICRBQ1RJVkFUSU9OX0lEIC0tcmVnaW9uICRFQ1NfVEFTS19SRUdJT047IHRoZW4gZWNobyBcXFwiU1NNIGFjdGl2YXRpb24gJEFDVElWQVRJT05fSUQgZmFpbGVkIHRvIGJlIGRlbGV0ZWRcXFwiIDE+JjI7IGZpOyBNQU5BR0VEX0lOU1RBTkNFX0lEPSQoanEgLWUgLXIgLk1hbmFnZWRJbnN0YW5jZUlEIC92YXIvbGliL2FtYXpvbi9zc20vcmVnaXN0cmF0aW9uKTsgZWNobyBcXFwiRGVyZWdpc3RlcmluZyBTU00gTWFuYWdlZCBJbnN0YW5jZSAkTUFOQUdFRF9JTlNUQU5DRV9JRFxcXCI7IGlmICEgYXdzIHNzbSBkZXJlZ2lzdGVyLW1hbmFnZWQtaW5zdGFuY2UgLS1pbnN0YW5jZS1pZCAkTUFOQUdFRF9JTlNUQU5DRV9JRCAtLXJlZ2lvbiAkRUNTX1RBU0tfUkVHSU9OOyB0aGVuIGVjaG8gXFxcIlNTTSBNYW5hZ2VkIEluc3RhbmNlICRNQU5BR0VEX0lOU1RBTkNFX0lEIGZhaWxlZCB0byBiZSBkZXJlZ2lzdGVyZWRcXFwiIDE+JjI7IGZpOyBraWxsIC1TSUdURVJNICRTU01fQUdFTlRfUElEOyB9OyB0cmFwIHRlcm1faGFuZGxlciBTSUdURVJNIFNJR0lOVDsgaWYgW1sgLXogJE1BTkFHRURfSU5TVEFOQ0VfUk9MRV9OQU1FIF1dOyB0aGVuIGVjaG8gXFxcIkVudmlyb25tZW50IHZhcmlhYmxlIE1BTkFHRURfSU5TVEFOQ0VfUk9MRV9OQU1FIG5vdCBzZXQsIGV4aXRpbmdcXFwiIDE+JjI7IGV4aXQgMTsgZmk7IGlmICEgcHMgYXggfCBncmVwIGFtYXpvbi1zc20tYWdlbnQgfCBncmVwIC12IGdyZXAgPiAvZGV2L251bGw7IHRoZW4gaWYgW1sgLW4gJEVDU19DT05UQUlORVJfTUVUQURBVEFfVVJJX1Y0IF1dIDsgdGhlbiBlY2hvIFxcXCJGb3VuZCBFQ1MgQ29udGFpbmVyIE1ldGFkYXRhLCBydW5uaW5nIGFjdGl2YXRpb24gd2l0aCBtZXRhZGF0YVxcXCI7IFRBU0tfTUVUQURBVEE9JChjdXJsIFxcXCIke0VDU19DT05UQUlORVJfTUVUQURBVEFfVVJJX1Y0fS90YXNrXFxcIik7IEVDU19UQVNLX0FWQUlMQUJJTElUWV9aT05FPSQoZWNobyAkVEFTS19NRVRBREFUQSB8IGpxIC1lIC1yICcuQXZhaWxhYmlsaXR5Wm9uZScpOyBFQ1NfVEFTS19BUk49JChlY2hvICRUQVNLX01FVEFEQVRBIHwganEgLWUgLXIgJy5UYXNrQVJOJyk7IEVDU19UQVNLX1JFR0lPTj0kKGVjaG8gJEVDU19UQVNLX0FWQUlMQUJJTElUWV9aT05FIHwgc2VkICdzLy4kLy8nKTsgRUNTX1RBU0tfQVZBSUxBQklMSVRZX1pPTkVfUkVHRVg9J14oYWZ8YXB8Y2F8Y258ZXV8bWV8c2F8dXN8dXMtZ292KS0oY2VudHJhbHxub3J0aHwobm9ydGgoZWFzdHx3ZXN0KSl8c291dGh8c291dGgoZWFzdHx3ZXN0KXxlYXN0fHdlc3QpLVswLTldezF9W2Etel17MX0kJzsgaWYgISBbWyAkRUNTX1RBU0tfQVZBSUxBQklMSVRZX1pPTkUgPX4gJEVDU19UQVNLX0FWQUlMQUJJTElUWV9aT05FX1JFR0VYIF1dOyB0aGVuIGVjaG8gXFxcIkVycm9yIGV4dHJhY3RpbmcgQXZhaWxhYmlsaXR5IFpvbmUgZnJvbSBFQ1MgQ29udGFpbmVyIE1ldGFkYXRhLCBleGl0aW5nXFxcIiAxPiYyOyBleGl0IDE7IGZpOyBFQ1NfVEFTS19BUk5fUkVHRVg9J15hcm46KGF3c3xhd3MtY258YXdzLXVzLWdvdik6ZWNzOlthLXowLTktXSs6WzAtOV17MTJ9OnRhc2svW2EtekEtWjAtOV8tXSsvW2EtekEtWjAtOV0rJCc7IGlmICEgW1sgJEVDU19UQVNLX0FSTiA9fiAkRUNTX1RBU0tfQVJOX1JFR0VYIF1dOyB0aGVuIGVjaG8gXFxcIkVycm9yIGV4dHJhY3RpbmcgVGFzayBBUk4gZnJvbSBFQ1MgQ29udGFpbmVyIE1ldGFkYXRhLCBleGl0aW5nXFxcIiAxPiYyOyBleGl0IDE7IGZpOyBDUkVBVEVfQUNUSVZBVElPTl9PVVRQVVQ9JChhd3Mgc3NtIGNyZWF0ZS1hY3RpdmF0aW9uIC0taWFtLXJvbGUgJE1BTkFHRURfSU5TVEFOQ0VfUk9MRV9OQU1FIC0tdGFncyBLZXk9RUNTX1RBU0tfQVZBSUxBQklMSVRZX1pPTkUsVmFsdWU9JEVDU19UQVNLX0FWQUlMQUJJTElUWV9aT05FIEtleT1FQ1NfVEFTS19BUk4sVmFsdWU9JEVDU19UQVNLX0FSTiAtLXJlZ2lvbiAkRUNTX1RBU0tfUkVHSU9OKTsgQUNUSVZBVElPTl9DT0RFPSQoZWNobyAkQ1JFQVRFX0FDVElWQVRJT05fT1VUUFVUIHwganEgLWUgLXIgLkFjdGl2YXRpb25Db2RlKTsgQUNUSVZBVElPTl9JRD0kKGVjaG8gJENSRUFURV9BQ1RJVkFUSU9OX09VVFBVVCB8IGpxIC1lIC1yIC5BY3RpdmF0aW9uSWQpOyBpZiAhIGFtYXpvbi1zc20tYWdlbnQgLXJlZ2lzdGVyIC1jb2RlICRBQ1RJVkFUSU9OX0NPREUgLWlkICRBQ1RJVkFUSU9OX0lEIC1yZWdpb24gJEVDU19UQVNLX1JFR0lPTjsgdGhlbiBlY2hvIFxcXCJGYWlsZWQgdG8gcmVnaXN0ZXIgd2l0aCBBV1MgU3lzdGVtcyBNYW5hZ2VyIChTU00pLCBleGl0aW5nXFxcIiAxPiYyOyBleGl0IDE7IGZpOyBhbWF6b24tc3NtLWFnZW50ICYgU1NNX0FHRU5UX1BJRD0kITsgd2FpdCAkU1NNX0FHRU5UX1BJRDsgZWxzZSBlY2hvIFxcXCJFQ1MgQ29udGFpbmVyIE1ldGFkYXRhIG5vdCBmb3VuZCwgZXhpdGluZ1xcXCIgMT4mMjsgZXhpdCAxOyBmaTsgZWxzZSBlY2hvIFxcXCJTU00gYWdlbnQgaXMgYWxyZWFkeSBydW5uaW5nLCBleGl0aW5nXFxcIiAxPiYyOyBleGl0IDE7IGZpXCJcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICAgIC8qXG4gICAgdGhpcy50YXNrRGVmaW5pdGlvbi5hZGRGaXJlbGVuc0xvZ1JvdXRlcignZmlyZWxlbnNyb3V0ZXInLCB7XG4gICAgICBmaXJlbGVuc0NvbmZpZzoge1xuICAgICAgICB0eXBlOiBlY3MuRmlyZWxlbnNMb2dSb3V0ZXJUeXBlLkZMVUVOVEJJVFxuICAgICAgfSxcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbVJlZ2lzdHJ5KCdwdWJsaWMuZWNyLmF3cy9hd3Mtb2JzZXJ2YWJpbGl0eS9hd3MtZm9yLWZsdWVudC1iaXQ6c3RhYmxlJylcbiAgICB9KVxuICAgLy8qL1xuXG4gICAgLy8gc2lkZWNhciBmb3IgaW5zdHJ1bWVudGF0aW9uIGNvbGxlY3RpbmdcbiAgICBzd2l0Y2gocHJvcHMuaW5zdHJ1bWVudGF0aW9uKSB7XG5cbiAgICAgIC8vIHdlIGRvbid0IGFkZCBhbnkgc2lkZWNhciBpZiBpbnN0cnVtZW50YXRpb24gaXMgbm9uZVxuICAgICAgY2FzZSBcIm5vbmVcIjoge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gVGhpcyBjb2xsZWN0b3Igd291bGQgYmUgdXNlZCBmb3IgYm90aCB0cmFjZXMgY29sbGVjdGVkIHVzaW5nXG4gICAgICAvLyBvcGVuIHRlbGVtZXRyeSBvciBYLVJheVxuICAgICAgY2FzZSBcIm90ZWxcIjoge1xuICAgICAgICB0aGlzLmFkZE90ZWxDb2xsZWN0b3JDb250YWluZXIodGhpcy50YXNrRGVmaW5pdGlvbiwgbG9nZ2luZyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBEZWZhdWx0IFgtUmF5IHRyYWNlcyBjb2xsZWN0b3JcbiAgICAgIGNhc2UgXCJ4cmF5XCI6IHtcbiAgICAgICAgdGhpcy5hZGRYUmF5Q29udGFpbmVyKHRoaXMudGFza0RlZmluaXRpb24sIGxvZ2dpbmcpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gRGVmYXVsdCBYLVJheSB0cmFjZXMgY29sbGVjdG9yXG4gICAgICAvLyBlbmFibGVkIGJ5IGRlZmF1bHRcbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgdGhpcy5hZGRYUmF5Q29udGFpbmVyKHRoaXMudGFza0RlZmluaXRpb24sIGxvZ2dpbmcpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXByb3BzLmRpc2FibGVTZXJ2aWNlKSB7XG4gICAgICB0aGlzLnNlcnZpY2UgPSBuZXcgZWNzX3BhdHRlcm5zLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRmFyZ2F0ZVNlcnZpY2UodGhpcywgXCJlY3Mtc2VydmljZVwiLCB7XG4gICAgICAgIGNsdXN0ZXI6IHByb3BzLmNsdXN0ZXIsXG4gICAgICAgIHRhc2tEZWZpbml0aW9uOiB0aGlzLnRhc2tEZWZpbml0aW9uLFxuICAgICAgICBwdWJsaWNMb2FkQmFsYW5jZXI6IHRydWUsXG4gICAgICAgIGRlc2lyZWRDb3VudDogcHJvcHMuZGVzaXJlZFRhc2tDb3VudCxcbiAgICAgICAgbGlzdGVuZXJQb3J0OiA4MCxcbiAgICAgICAgc2VjdXJpdHlHcm91cHM6IFtwcm9wcy5zZWN1cml0eUdyb3VwXVxuXG4gICAgICB9KVxuXG4gICAgICBpZiAocHJvcHMuaGVhbHRoQ2hlY2spIHtcbiAgICAgICAgdGhpcy5zZXJ2aWNlLnRhcmdldEdyb3VwLmNvbmZpZ3VyZUhlYWx0aENoZWNrKHtcbiAgICAgICAgICBwYXRoOiBwcm9wcy5oZWFsdGhDaGVja1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhYnN0cmFjdCBjb250YWluZXJJbWFnZUZyb21SZXBvc2l0b3J5KHJlcG9zaXRvcnlVUkk6IHN0cmluZykgOiBlY3MuQ29udGFpbmVySW1hZ2U7XG5cbiAgYWJzdHJhY3QgY3JlYXRlQ29udGFpbmVySW1hZ2UoKTogZWNzLkNvbnRhaW5lckltYWdlO1xuXG4gIHByaXZhdGUgYWRkWFJheUNvbnRhaW5lcih0YXNrRGVmaW5pdGlvbjogZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbiwgbG9nZ2luZzogZWNzLkF3c0xvZ0RyaXZlcikge1xuICAgIHRhc2tEZWZpbml0aW9uLmFkZENvbnRhaW5lcigneHJheWRhZW1vbicsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbVJlZ2lzdHJ5KCdwdWJsaWMuZWNyLmF3cy94cmF5L2F3cy14cmF5LWRhZW1vbjozLjMuNCcpLFxuICAgICAgbWVtb3J5TGltaXRNaUI6IDI1NixcbiAgICAgIGNwdTogMjU2LFxuICAgICAgbG9nZ2luZ1xuICAgIH0pLmFkZFBvcnRNYXBwaW5ncyh7XG4gICAgICBjb250YWluZXJQb3J0OiAyMDAwLFxuICAgICAgcHJvdG9jb2w6IGVjcy5Qcm90b2NvbC5VRFBcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkT3RlbENvbGxlY3RvckNvbnRhaW5lcih0YXNrRGVmaW5pdGlvbjogZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbiwgbG9nZ2luZzogZWNzLkF3c0xvZ0RyaXZlcikge1xuICAgIHRhc2tEZWZpbml0aW9uLmFkZENvbnRhaW5lcignYXdzLW90ZWwtY29sbGVjdG9yJywge1xuICAgICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21SZWdpc3RyeSgncHVibGljLmVjci5hd3MvYXdzLW9ic2VydmFiaWxpdHkvYXdzLW90ZWwtY29sbGVjdG9yOnYwLjMyLjAnKSxcbiAgICAgICAgbWVtb3J5TGltaXRNaUI6IDI1NixcbiAgICAgICAgY3B1OiAyNTYsXG4gICAgICAgIGNvbW1hbmQ6IFtcIi0tY29uZmlnXCIsIFwiL2V0Yy9lY3MvZWNzLXhyYXkueWFtbFwiXSxcbiAgICAgICAgbG9nZ2luZ1xuICAgIH0pO1xuICB9XG59XG4iXX0=