"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcsEc2Service = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const iam = require("aws-cdk-lib/aws-iam");
const ecs = require("aws-cdk-lib/aws-ecs");
const logs = require("aws-cdk-lib/aws-logs");
const ecs_patterns = require("aws-cdk-lib/aws-ecs-patterns");
const constructs_1 = require("constructs");
class EcsEc2Service extends constructs_1.Construct {
    constructor(scope, id, props) {
        var _a, _b, _c, _d, _e;
        super(scope, id);
        const logging = new ecs.AwsLogDriver({
            streamPrefix: "logs",
            logGroup: new logs.LogGroup(this, "ecs-log-group", {
                logGroupName: props.logGroupName,
                removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY
            })
        });
        const taskRole = new iam.Role(this, `taskRole`, {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
        });
        this.taskDefinition = new ecs.Ec2TaskDefinition(this, "taskDefinition", {
            networkMode: ecs.NetworkMode.AWS_VPC,
            taskRole: taskRole,
            pidMode: ecs.PidMode.TASK,
        });
        this.taskDefinition.addToExecutionRolePolicy(EcsEc2Service.ExecutionRolePolicy);
        (_a = this.taskDefinition.taskRole) === null || _a === void 0 ? void 0 : _a.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'AmazonECSTaskExecutionRolePolicy', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'));
        (_b = this.taskDefinition.taskRole) === null || _b === void 0 ? void 0 : _b.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'AWSXrayWriteOnlyAccess', 'arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess'));
        (_c = this.taskDefinition.taskRole) === null || _c === void 0 ? void 0 : _c.addManagedPolicy({
            managedPolicyArn: 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess',
        });
        (_d = this.taskDefinition.taskRole) === null || _d === void 0 ? void 0 : _d.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "ssm:CreateActivation",
                "ssm:AddTagsToResource",
            ],
            resources: ["*"],
        }));
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
        (_e = this.taskDefinition.taskRole) === null || _e === void 0 ? void 0 : _e.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "iam:GetRole",
                "iam:PassRole"
            ],
            resources: [ssmRole.roleArn]
        }));
        const linuxParameters = new ecs.LinuxParameters(this, 'linuxParameters');
        linuxParameters.addCapabilities(ecs.Capability.NET_ADMIN);
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
            linuxParameters: linuxParameters
        });
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
                this.addOtelCollectorContainer(this.taskDefinition, logging, props.region);
                break;
            }
            // Default X-Ray traces collector
            case "xray": {
                this.addXRayContainer(this.taskDefinition, logging, props.region);
                break;
            }
            // Default X-Ray traces collector
            // enabled by default
            default: {
                this.addXRayContainer(this.taskDefinition, logging, props.region);
                break;
            }
        }
        if (!props.disableService) {
            this.service = new ecs_patterns.ApplicationLoadBalancedEc2Service(this, "ecs-service", {
                cluster: props.cluster,
                taskDefinition: this.taskDefinition,
                publicLoadBalancer: true,
                desiredCount: props.desiredTaskCount,
                listenerPort: 80,
            });
            if (props.healthCheck) {
                this.service.targetGroup.configureHealthCheck({
                    path: props.healthCheck
                });
            }
        }
    }
    addXRayContainer(taskDefinition, logging, region) {
        taskDefinition.addContainer('xraydaemon', {
            image: ecs.ContainerImage.fromRegistry('public.ecr.aws/xray/aws-xray-daemon:3.3.4'),
            memoryLimitMiB: 256,
            cpu: 256,
            logging,
            environment: {
                AWS_REGION: region,
            }
        }).addPortMappings({
            containerPort: 2000,
            protocol: ecs.Protocol.UDP
        });
    }
    addOtelCollectorContainer(taskDefinition, logging, region) {
        const otelCollector = taskDefinition.addContainer('aws-otel-collector', {
            image: ecs.ContainerImage.fromRegistry('public.ecr.aws/aws-observability/aws-otel-collector:v0.28.0'),
            memoryLimitMiB: 256,
            cpu: 256,
            command: ["--config", "/etc/ecs/ecs-xray.yaml"],
            logging,
            environment: {
                AWS_REGION: region,
            }
        });
        otelCollector.addPortMappings({
            containerPort: 2000,
            protocol: ecs.Protocol.UDP,
            hostPort: 2000
        });
        otelCollector.addPortMappings({
            containerPort: 4317,
            protocol: ecs.Protocol.TCP,
            hostPort: 4317
        });
        otelCollector.addPortMappings({
            containerPort: 8125,
            protocol: ecs.Protocol.UDP,
            hostPort: 8125
        });
        otelCollector.addPortMappings({
            containerPort: 4318,
            protocol: ecs.Protocol.TCP,
            hostPort: 4318
        });
    }
}
exports.EcsEc2Service = EcsEc2Service;
EcsEc2Service.ExecutionRolePolicy = new iam.PolicyStatement({
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
        'ssm:GetParameters',
    ]
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzLWVjMi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWNzLWVjMi1zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUE0QztBQUM1QywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLDZDQUE2QztBQUM3Qyw2REFBNkQ7QUFFN0QsMkNBQXNDO0FBdUJ0QyxNQUFzQixhQUFjLFNBQVEsc0JBQVM7SUE0Qm5ELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7O1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDO1lBQ25DLFlBQVksRUFBRSxNQUFNO1lBQ3BCLFFBQVEsRUFBRSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtnQkFDakQsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZO2dCQUNoQyxhQUFhLEVBQUUsMkJBQWEsQ0FBQyxPQUFPO2FBQ3JDLENBQUM7U0FDSCxDQUFDLENBQUM7UUFJSCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUM5QyxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMseUJBQXlCLENBQUM7U0FDL0QsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDcEUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxXQUFXLENBQUMsT0FBTztZQUNwQyxRQUFRLEVBQUUsUUFBUTtZQUNsQixPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJO1NBQzVCLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsYUFBYSxDQUFDLG1C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QVEsQ0FBQyxHQUFHO1lBQzFCLFFBQVEsRUFBRSxJQUFJO1NBQ2YsQ0FBQyxDQUFDO0lBRVAsQ0FBQzs7QUF2UEgsc0NBd1BDO0FBdFBnQixpQ0FBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7SUFDM0QsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztJQUN4QixTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7SUFDaEIsT0FBTyxFQUFFO1FBQ1AsMkJBQTJCO1FBQzNCLGlDQUFpQztRQUNqQyw0QkFBNEI7UUFDNUIsbUJBQW1CO1FBQ25CLHFCQUFxQjtRQUNyQix5QkFBeUI7UUFDekIsc0JBQXNCO1FBQ3RCLHdCQUF3QjtRQUN4QixtQkFBbUI7UUFDbkIsdUJBQXVCO1FBQ3ZCLDBCQUEwQjtRQUMxQix1QkFBdUI7UUFDdkIseUJBQXlCO1FBQ3pCLG9DQUFvQztRQUNwQyxtQkFBbUI7S0FDcEI7Q0FDRixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBlY3NfcGF0dGVybnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcy1wYXR0ZXJucyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJ1xuXG5leHBvcnQgaW50ZXJmYWNlIEVjc0VjMlNlcnZpY2VQcm9wcyB7XG4gIGNsdXN0ZXI/OiBlY3MuQ2x1c3RlcixcblxuICBjcHU6IG51bWJlcjtcbiAgbWVtb3J5TGltaXRNaUI6IG51bWJlcixcbiAgbG9nR3JvdXBOYW1lOiBzdHJpbmcsXG5cbiAgaGVhbHRoQ2hlY2s/OiBzdHJpbmcsXG5cbiAgZGlzYWJsZVNlcnZpY2U/OiBib29sZWFuLFxuICBpbnN0cnVtZW50YXRpb24/OiBzdHJpbmcsXG5cbiAgcmVwb3NpdG9yeVVSST86IHN0cmluZyxcblxuICBkZXNpcmVkVGFza0NvdW50OiBudW1iZXIsXG5cbiAgcmVnaW9uOiBzdHJpbmcsXG5cbiAgc2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXBcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEVjc0VjMlNlcnZpY2UgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuXG4gIHByaXZhdGUgc3RhdGljIEV4ZWN1dGlvblJvbGVQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgIHJlc291cmNlczogWycqJ10sXG4gICAgYWN0aW9uczogW1xuICAgICAgXCJlY3I6R2V0QXV0aG9yaXphdGlvblRva2VuXCIsXG4gICAgICBcImVjcjpCYXRjaENoZWNrTGF5ZXJBdmFpbGFiaWxpdHlcIixcbiAgICAgIFwiZWNyOkdldERvd25sb2FkVXJsRm9yTGF5ZXJcIixcbiAgICAgIFwiZWNyOkJhdGNoR2V0SW1hZ2VcIixcbiAgICAgIFwibG9nczpDcmVhdGVMb2dHcm91cFwiLFxuICAgICAgXCJsb2dzOkRlc2NyaWJlTG9nU3RyZWFtc1wiLFxuICAgICAgXCJsb2dzOkNyZWF0ZUxvZ1N0cmVhbVwiLFxuICAgICAgXCJsb2dzOkRlc2NyaWJlTG9nR3JvdXBzXCIsXG4gICAgICBcImxvZ3M6UHV0TG9nRXZlbnRzXCIsXG4gICAgICBcInhyYXk6UHV0VHJhY2VTZWdtZW50c1wiLFxuICAgICAgXCJ4cmF5OlB1dFRlbGVtZXRyeVJlY29yZHNcIixcbiAgICAgIFwieHJheTpHZXRTYW1wbGluZ1J1bGVzXCIsXG4gICAgICBcInhyYXk6R2V0U2FtcGxpbmdUYXJnZXRzXCIsXG4gICAgICBcInhyYXk6R2V0U2FtcGxpbmdTdGF0aXN0aWNTdW1tYXJpZXNcIixcbiAgICAgICdzc206R2V0UGFyYW1ldGVycycsXG4gICAgXVxuICB9KTtcblxuICBwdWJsaWMgcmVhZG9ubHkgdGFza0RlZmluaXRpb246IGVjcy5UYXNrRGVmaW5pdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHNlcnZpY2U6IGVjc19wYXR0ZXJucy5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlZFNlcnZpY2VCYXNlO1xuICBwdWJsaWMgcmVhZG9ubHkgY29udGFpbmVyOiBlY3MuQ29udGFpbmVyRGVmaW5pdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRWNzRWMyU2VydmljZVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IGxvZ2dpbmcgPSBuZXcgZWNzLkF3c0xvZ0RyaXZlcih7XG4gICAgICBzdHJlYW1QcmVmaXg6IFwibG9nc1wiLFxuICAgICAgbG9nR3JvdXA6IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiZWNzLWxvZy1ncm91cFwiLCB7XG4gICAgICAgIGxvZ0dyb3VwTmFtZTogcHJvcHMubG9nR3JvdXBOYW1lLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICAgIH0pXG4gICAgfSk7XG5cblxuXG4gICAgY29uc3QgdGFza1JvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgYHRhc2tSb2xlYCwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJylcbiAgICB9KTtcblxuICAgIHRoaXMudGFza0RlZmluaXRpb24gPSBuZXcgZWNzLkVjMlRhc2tEZWZpbml0aW9uKHRoaXMsIFwidGFza0RlZmluaXRpb25cIiwge1xuICAgICAgICBuZXR3b3JrTW9kZTogZWNzLk5ldHdvcmtNb2RlLkFXU19WUEMsXG4gICAgICAgIHRhc2tSb2xlOiB0YXNrUm9sZSxcbiAgICAgICAgcGlkTW9kZTogZWNzLlBpZE1vZGUuVEFTSyxcbiAgICB9KTtcblxuICAgIHRoaXMudGFza0RlZmluaXRpb24uYWRkVG9FeGVjdXRpb25Sb2xlUG9saWN5KEVjc0VjMlNlcnZpY2UuRXhlY3V0aW9uUm9sZVBvbGljeSk7XG4gICAgdGhpcy50YXNrRGVmaW5pdGlvbi50YXNrUm9sZT8uYWRkTWFuYWdlZFBvbGljeShpYW0uTWFuYWdlZFBvbGljeS5mcm9tTWFuYWdlZFBvbGljeUFybih0aGlzLCAnQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3knLCAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FtYXpvbkVDU1Rhc2tFeGVjdXRpb25Sb2xlUG9saWN5JykpO1xuICAgIHRoaXMudGFza0RlZmluaXRpb24udGFza1JvbGU/LmFkZE1hbmFnZWRQb2xpY3koaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4odGhpcywgJ0FXU1hyYXlXcml0ZU9ubHlBY2Nlc3MnLCAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQVdTWHJheVdyaXRlT25seUFjY2VzcycpKTtcbiAgICB0aGlzLnRhc2tEZWZpbml0aW9uLnRhc2tSb2xlPy5hZGRNYW5hZ2VkUG9saWN5KHtcbiAgICAgIG1hbmFnZWRQb2xpY3lBcm46ICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9BV1NYUmF5RGFlbW9uV3JpdGVBY2Nlc3MnLFxuICAgIH0pO1xuXG4gICAgdGhpcy50YXNrRGVmaW5pdGlvbi50YXNrUm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICBcInNzbTpDcmVhdGVBY3RpdmF0aW9uXCIsXG4gICAgICAgIFwic3NtOkFkZFRhZ3NUb1Jlc291cmNlXCIsXG4gICAgXSxcbiAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICB9KSk7XG5cbiAgICAvLyBCdWlsZCBsb2NhbGx5IHRoZSBpbWFnZSBvbmx5IGlmIHRoZSByZXBvc2l0b3J5IFVSSSBpcyBub3Qgc3BlY2lmaWVkXG4gICAgLy8gQ2FuIGhlbHAgc3BlZWQgdXAgYnVpbGRzIGlmIHdlIGFyZSBub3QgcmVidWlsZGluZyBhbnl0aGluZ1xuICAgIGNvbnN0IGltYWdlID0gcHJvcHMucmVwb3NpdG9yeVVSST8gdGhpcy5jb250YWluZXJJbWFnZUZyb21SZXBvc2l0b3J5KHByb3BzLnJlcG9zaXRvcnlVUkkpIDogdGhpcy5jcmVhdGVDb250YWluZXJJbWFnZSgpXG5cbiAgICB0aGlzLmNvbnRhaW5lciA9IHRoaXMudGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKCdjb250YWluZXInLCB7XG4gICAgICBpbWFnZTogaW1hZ2UsXG4gICAgICBtZW1vcnlMaW1pdE1pQjogNTEyLFxuICAgICAgY3B1OiAyNTYsXG4gICAgICBsb2dnaW5nLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgLy8gY2xlYXIgdGV4dCwgbm90IGZvciBzZW5zaXRpdmUgZGF0YVxuICAgICAgICBBV1NfUkVHSU9OOiBwcm9wcy5yZWdpb24sXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbnRhaW5lci5hZGRQb3J0TWFwcGluZ3Moe1xuICAgICAgY29udGFpbmVyUG9ydDogODAsXG4gICAgICBwcm90b2NvbDogZWNzLlByb3RvY29sLlRDUFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3NtUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBgc3NtUm9sZWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdzc20uYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TU01NYW5hZ2VkSW5zdGFuY2VDb3JlJyldXG4gICAgfSk7XG5cbiAgICBzc21Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgXCJzc206RGVsZXRlQWN0aXZhdGlvblwiXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgIH0pKTtcblxuICAgIHNzbVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICBcInNzbTpEZXJlZ2lzdGVyTWFuYWdlZEluc3RhbmNlXCJcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnYXJuOmF3czpzc206Jytwcm9wcy5yZWdpb24rJzoqOm1hbmFnZWQtaW5zdGFuY2UvKiddLFxuICAgIH0pKTtcblxuICAgIHRoaXMudGFza0RlZmluaXRpb24udGFza1JvbGU/LmFkZFRvUHJpbmNpcGFsUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgXCJpYW06R2V0Um9sZVwiLFxuICAgICAgICBcImlhbTpQYXNzUm9sZVwiXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbc3NtUm9sZS5yb2xlQXJuXVxuICAgIH0pKTtcblxuICAgIGNvbnN0IGxpbnV4UGFyYW1ldGVycyA9IG5ldyBlY3MuTGludXhQYXJhbWV0ZXJzKHRoaXMsICdsaW51eFBhcmFtZXRlcnMnKTtcbiAgICBsaW51eFBhcmFtZXRlcnMuYWRkQ2FwYWJpbGl0aWVzKGVjcy5DYXBhYmlsaXR5Lk5FVF9BRE1JTik7XG5cbiAgICB0aGlzLnRhc2tEZWZpbml0aW9uLmFkZENvbnRhaW5lcignYW1hem9uLXNzbS1hZ2VudCcse1xuICAgICAgaW1hZ2U6IGVjcy5Db250YWluZXJJbWFnZS5mcm9tUmVnaXN0cnkoJ3B1YmxpYy5lY3IuYXdzL2FtYXpvbi1zc20tYWdlbnQvYW1hem9uLXNzbS1hZ2VudDpsYXRlc3QnKSxcbiAgICAgIG1lbW9yeUxpbWl0TWlCOiAyNTYsXG4gICAgICBlc3NlbnRpYWw6IGZhbHNlLFxuICAgICAgLy9jcHU6IDI1NixcbiAgICAgIGxvZ2dpbmcsXG4gICAgICBlbnZpcm9ubWVudDogeyAvLyBjbGVhciB0ZXh0LCBub3QgZm9yIHNlbnNpdGl2ZSBkYXRhXG4gICAgICAgIE1BTkFHRURfSU5TVEFOQ0VfUk9MRV9OQU1FOnNzbVJvbGUucm9sZU5hbWUsXG4gICAgICAgIEFXU19SRUdJT046IHByb3BzLnJlZ2lvbixcbiAgICAgIH0sXG4gICAgICBjb21tYW5kOiBbXG4gICAgICAgIFwiL2Jpbi9iYXNoXCIsXG4gICAgICAgIFwiLWNcIixcbiAgICAgICAgXCJzZXQgLWU7IHl1bSB1cGdyYWRlIC15OyB5dW0gaW5zdGFsbCBqcSBwcm9jcHMgYXdzY2xpIC15OyB0ZXJtX2hhbmRsZXIoKSB7IGVjaG8gXFxcIkRlbGV0aW5nIFNTTSBhY3RpdmF0aW9uICRBQ1RJVkFUSU9OX0lEXFxcIjsgaWYgISBhd3Mgc3NtIGRlbGV0ZS1hY3RpdmF0aW9uIC0tYWN0aXZhdGlvbi1pZCAkQUNUSVZBVElPTl9JRCAtLXJlZ2lvbiAkRUNTX1RBU0tfUkVHSU9OOyB0aGVuIGVjaG8gXFxcIlNTTSBhY3RpdmF0aW9uICRBQ1RJVkFUSU9OX0lEIGZhaWxlZCB0byBiZSBkZWxldGVkXFxcIiAxPiYyOyBmaTsgTUFOQUdFRF9JTlNUQU5DRV9JRD0kKGpxIC1lIC1yIC5NYW5hZ2VkSW5zdGFuY2VJRCAvdmFyL2xpYi9hbWF6b24vc3NtL3JlZ2lzdHJhdGlvbik7IGVjaG8gXFxcIkRlcmVnaXN0ZXJpbmcgU1NNIE1hbmFnZWQgSW5zdGFuY2UgJE1BTkFHRURfSU5TVEFOQ0VfSURcXFwiOyBpZiAhIGF3cyBzc20gZGVyZWdpc3Rlci1tYW5hZ2VkLWluc3RhbmNlIC0taW5zdGFuY2UtaWQgJE1BTkFHRURfSU5TVEFOQ0VfSUQgLS1yZWdpb24gJEVDU19UQVNLX1JFR0lPTjsgdGhlbiBlY2hvIFxcXCJTU00gTWFuYWdlZCBJbnN0YW5jZSAkTUFOQUdFRF9JTlNUQU5DRV9JRCBmYWlsZWQgdG8gYmUgZGVyZWdpc3RlcmVkXFxcIiAxPiYyOyBmaTsga2lsbCAtU0lHVEVSTSAkU1NNX0FHRU5UX1BJRDsgfTsgdHJhcCB0ZXJtX2hhbmRsZXIgU0lHVEVSTSBTSUdJTlQ7IGlmIFtbIC16ICRNQU5BR0VEX0lOU1RBTkNFX1JPTEVfTkFNRSBdXTsgdGhlbiBlY2hvIFxcXCJFbnZpcm9ubWVudCB2YXJpYWJsZSBNQU5BR0VEX0lOU1RBTkNFX1JPTEVfTkFNRSBub3Qgc2V0LCBleGl0aW5nXFxcIiAxPiYyOyBleGl0IDE7IGZpOyBpZiAhIHBzIGF4IHwgZ3JlcCBhbWF6b24tc3NtLWFnZW50IHwgZ3JlcCAtdiBncmVwID4gL2Rldi9udWxsOyB0aGVuIGlmIFtbIC1uICRFQ1NfQ09OVEFJTkVSX01FVEFEQVRBX1VSSV9WNCBdXSA7IHRoZW4gZWNobyBcXFwiRm91bmQgRUNTIENvbnRhaW5lciBNZXRhZGF0YSwgcnVubmluZyBhY3RpdmF0aW9uIHdpdGggbWV0YWRhdGFcXFwiOyBUQVNLX01FVEFEQVRBPSQoY3VybCBcXFwiJHtFQ1NfQ09OVEFJTkVSX01FVEFEQVRBX1VSSV9WNH0vdGFza1xcXCIpOyBFQ1NfVEFTS19BVkFJTEFCSUxJVFlfWk9ORT0kKGVjaG8gJFRBU0tfTUVUQURBVEEgfCBqcSAtZSAtciAnLkF2YWlsYWJpbGl0eVpvbmUnKTsgRUNTX1RBU0tfQVJOPSQoZWNobyAkVEFTS19NRVRBREFUQSB8IGpxIC1lIC1yICcuVGFza0FSTicpOyBFQ1NfVEFTS19SRUdJT049JChlY2hvICRFQ1NfVEFTS19BVkFJTEFCSUxJVFlfWk9ORSB8IHNlZCAncy8uJC8vJyk7IEVDU19UQVNLX0FWQUlMQUJJTElUWV9aT05FX1JFR0VYPSdeKGFmfGFwfGNhfGNufGV1fG1lfHNhfHVzfHVzLWdvdiktKGNlbnRyYWx8bm9ydGh8KG5vcnRoKGVhc3R8d2VzdCkpfHNvdXRofHNvdXRoKGVhc3R8d2VzdCl8ZWFzdHx3ZXN0KS1bMC05XXsxfVthLXpdezF9JCc7IGlmICEgW1sgJEVDU19UQVNLX0FWQUlMQUJJTElUWV9aT05FID1+ICRFQ1NfVEFTS19BVkFJTEFCSUxJVFlfWk9ORV9SRUdFWCBdXTsgdGhlbiBlY2hvIFxcXCJFcnJvciBleHRyYWN0aW5nIEF2YWlsYWJpbGl0eSBab25lIGZyb20gRUNTIENvbnRhaW5lciBNZXRhZGF0YSwgZXhpdGluZ1xcXCIgMT4mMjsgZXhpdCAxOyBmaTsgRUNTX1RBU0tfQVJOX1JFR0VYPSdeYXJuOihhd3N8YXdzLWNufGF3cy11cy1nb3YpOmVjczpbYS16MC05LV0rOlswLTldezEyfTp0YXNrL1thLXpBLVowLTlfLV0rL1thLXpBLVowLTldKyQnOyBpZiAhIFtbICRFQ1NfVEFTS19BUk4gPX4gJEVDU19UQVNLX0FSTl9SRUdFWCBdXTsgdGhlbiBlY2hvIFxcXCJFcnJvciBleHRyYWN0aW5nIFRhc2sgQVJOIGZyb20gRUNTIENvbnRhaW5lciBNZXRhZGF0YSwgZXhpdGluZ1xcXCIgMT4mMjsgZXhpdCAxOyBmaTsgQ1JFQVRFX0FDVElWQVRJT05fT1VUUFVUPSQoYXdzIHNzbSBjcmVhdGUtYWN0aXZhdGlvbiAtLWlhbS1yb2xlICRNQU5BR0VEX0lOU1RBTkNFX1JPTEVfTkFNRSAtLXRhZ3MgS2V5PUVDU19UQVNLX0FWQUlMQUJJTElUWV9aT05FLFZhbHVlPSRFQ1NfVEFTS19BVkFJTEFCSUxJVFlfWk9ORSBLZXk9RUNTX1RBU0tfQVJOLFZhbHVlPSRFQ1NfVEFTS19BUk4gLS1yZWdpb24gJEVDU19UQVNLX1JFR0lPTik7IEFDVElWQVRJT05fQ09ERT0kKGVjaG8gJENSRUFURV9BQ1RJVkFUSU9OX09VVFBVVCB8IGpxIC1lIC1yIC5BY3RpdmF0aW9uQ29kZSk7IEFDVElWQVRJT05fSUQ9JChlY2hvICRDUkVBVEVfQUNUSVZBVElPTl9PVVRQVVQgfCBqcSAtZSAtciAuQWN0aXZhdGlvbklkKTsgaWYgISBhbWF6b24tc3NtLWFnZW50IC1yZWdpc3RlciAtY29kZSAkQUNUSVZBVElPTl9DT0RFIC1pZCAkQUNUSVZBVElPTl9JRCAtcmVnaW9uICRFQ1NfVEFTS19SRUdJT047IHRoZW4gZWNobyBcXFwiRmFpbGVkIHRvIHJlZ2lzdGVyIHdpdGggQVdTIFN5c3RlbXMgTWFuYWdlciAoU1NNKSwgZXhpdGluZ1xcXCIgMT4mMjsgZXhpdCAxOyBmaTsgYW1hem9uLXNzbS1hZ2VudCAmIFNTTV9BR0VOVF9QSUQ9JCE7IHdhaXQgJFNTTV9BR0VOVF9QSUQ7IGVsc2UgZWNobyBcXFwiRUNTIENvbnRhaW5lciBNZXRhZGF0YSBub3QgZm91bmQsIGV4aXRpbmdcXFwiIDE+JjI7IGV4aXQgMTsgZmk7IGVsc2UgZWNobyBcXFwiU1NNIGFnZW50IGlzIGFscmVhZHkgcnVubmluZywgZXhpdGluZ1xcXCIgMT4mMjsgZXhpdCAxOyBmaVwiXG4gICAgICBdLFxuICAgICAgbGludXhQYXJhbWV0ZXJzOiBsaW51eFBhcmFtZXRlcnNcbiAgICB9KTtcblxuXG5cbiAgICAvKlxuICAgIHRoaXMudGFza0RlZmluaXRpb24uYWRkRmlyZWxlbnNMb2dSb3V0ZXIoJ2ZpcmVsZW5zcm91dGVyJywge1xuICAgICAgZmlyZWxlbnNDb25maWc6IHtcbiAgICAgICAgdHlwZTogZWNzLkZpcmVsZW5zTG9nUm91dGVyVHlwZS5GTFVFTlRCSVRcbiAgICAgIH0sXG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21SZWdpc3RyeSgncHVibGljLmVjci5hd3MvYXdzLW9ic2VydmFiaWxpdHkvYXdzLWZvci1mbHVlbnQtYml0OnN0YWJsZScpXG4gICAgfSlcbiAgIC8vKi9cblxuICAgIC8vIHNpZGVjYXIgZm9yIGluc3RydW1lbnRhdGlvbiBjb2xsZWN0aW5nXG4gICAgc3dpdGNoKHByb3BzLmluc3RydW1lbnRhdGlvbikge1xuXG4gICAgICAvLyB3ZSBkb24ndCBhZGQgYW55IHNpZGVjYXIgaWYgaW5zdHJ1bWVudGF0aW9uIGlzIG5vbmVcbiAgICAgIGNhc2UgXCJub25lXCI6IHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoaXMgY29sbGVjdG9yIHdvdWxkIGJlIHVzZWQgZm9yIGJvdGggdHJhY2VzIGNvbGxlY3RlZCB1c2luZ1xuICAgICAgLy8gb3BlbiB0ZWxlbWV0cnkgb3IgWC1SYXlcbiAgICAgIGNhc2UgXCJvdGVsXCI6IHtcbiAgICAgICAgdGhpcy5hZGRPdGVsQ29sbGVjdG9yQ29udGFpbmVyKHRoaXMudGFza0RlZmluaXRpb24sIGxvZ2dpbmcsIHByb3BzLnJlZ2lvbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBEZWZhdWx0IFgtUmF5IHRyYWNlcyBjb2xsZWN0b3JcbiAgICAgIGNhc2UgXCJ4cmF5XCI6IHtcbiAgICAgICAgdGhpcy5hZGRYUmF5Q29udGFpbmVyKHRoaXMudGFza0RlZmluaXRpb24sIGxvZ2dpbmcsIHByb3BzLnJlZ2lvbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBEZWZhdWx0IFgtUmF5IHRyYWNlcyBjb2xsZWN0b3JcbiAgICAgIC8vIGVuYWJsZWQgYnkgZGVmYXVsdFxuICAgICAgZGVmYXVsdDoge1xuICAgICAgICB0aGlzLmFkZFhSYXlDb250YWluZXIodGhpcy50YXNrRGVmaW5pdGlvbiwgbG9nZ2luZywgcHJvcHMucmVnaW9uKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFwcm9wcy5kaXNhYmxlU2VydmljZSkge1xuICAgICAgdGhpcy5zZXJ2aWNlID0gbmV3IGVjc19wYXR0ZXJucy5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlZEVjMlNlcnZpY2UodGhpcywgXCJlY3Mtc2VydmljZVwiLCB7XG4gICAgICAgIGNsdXN0ZXI6IHByb3BzLmNsdXN0ZXIsXG4gICAgICAgIHRhc2tEZWZpbml0aW9uOiB0aGlzLnRhc2tEZWZpbml0aW9uLFxuICAgICAgICBwdWJsaWNMb2FkQmFsYW5jZXI6IHRydWUsXG4gICAgICAgIGRlc2lyZWRDb3VudDogcHJvcHMuZGVzaXJlZFRhc2tDb3VudCxcbiAgICAgICAgbGlzdGVuZXJQb3J0OiA4MCxcblxuICAgICAgfSlcblxuICAgICAgaWYgKHByb3BzLmhlYWx0aENoZWNrKSB7XG4gICAgICAgIHRoaXMuc2VydmljZS50YXJnZXRHcm91cC5jb25maWd1cmVIZWFsdGhDaGVjayh7XG4gICAgICAgICAgcGF0aDogcHJvcHMuaGVhbHRoQ2hlY2tcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYWJzdHJhY3QgY29udGFpbmVySW1hZ2VGcm9tUmVwb3NpdG9yeShyZXBvc2l0b3J5VVJJOiBzdHJpbmcpIDogZWNzLkNvbnRhaW5lckltYWdlO1xuXG4gIGFic3RyYWN0IGNyZWF0ZUNvbnRhaW5lckltYWdlKCk6IGVjcy5Db250YWluZXJJbWFnZTtcblxuICBwcml2YXRlIGFkZFhSYXlDb250YWluZXIodGFza0RlZmluaXRpb246IGVjcy5FYzJUYXNrRGVmaW5pdGlvbiwgbG9nZ2luZzogZWNzLkF3c0xvZ0RyaXZlciwgcmVnaW9uOiBzdHJpbmcpIHtcbiAgICB0YXNrRGVmaW5pdGlvbi5hZGRDb250YWluZXIoJ3hyYXlkYWVtb24nLCB7XG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21SZWdpc3RyeSgncHVibGljLmVjci5hd3MveHJheS9hd3MteHJheS1kYWVtb246My4zLjQnKSxcbiAgICAgIG1lbW9yeUxpbWl0TWlCOiAyNTYsXG4gICAgICBjcHU6IDI1NixcbiAgICAgIGxvZ2dpbmcsXG4gICAgICBlbnZpcm9ubWVudDogeyAvLyBjbGVhciB0ZXh0LCBub3QgZm9yIHNlbnNpdGl2ZSBkYXRhXG4gICAgICAgIEFXU19SRUdJT046IHJlZ2lvbixcbiAgICAgIH1cbiAgICB9KS5hZGRQb3J0TWFwcGluZ3Moe1xuICAgICAgY29udGFpbmVyUG9ydDogMjAwMCxcbiAgICAgIHByb3RvY29sOiBlY3MuUHJvdG9jb2wuVURQXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFkZE90ZWxDb2xsZWN0b3JDb250YWluZXIodGFza0RlZmluaXRpb246IGVjcy5FYzJUYXNrRGVmaW5pdGlvbiwgbG9nZ2luZzogZWNzLkF3c0xvZ0RyaXZlciwgcmVnaW9uOiBzdHJpbmcpIHtcbiAgICBjb25zdCBvdGVsQ29sbGVjdG9yID0gdGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKCdhd3Mtb3RlbC1jb2xsZWN0b3InLCB7XG4gICAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbVJlZ2lzdHJ5KCdwdWJsaWMuZWNyLmF3cy9hd3Mtb2JzZXJ2YWJpbGl0eS9hd3Mtb3RlbC1jb2xsZWN0b3I6djAuMjguMCcpLFxuICAgICAgICBtZW1vcnlMaW1pdE1pQjogMjU2LFxuICAgICAgICBjcHU6IDI1NixcbiAgICAgICAgY29tbWFuZDogW1wiLS1jb25maWdcIiwgXCIvZXRjL2Vjcy9lY3MteHJheS55YW1sXCJdLFxuICAgICAgICBsb2dnaW5nLFxuICAgICAgICBlbnZpcm9ubWVudDogeyAvLyBjbGVhciB0ZXh0LCBub3QgZm9yIHNlbnNpdGl2ZSBkYXRhXG4gICAgICAgICAgQVdTX1JFR0lPTjogcmVnaW9uLFxuICAgICAgICB9XG4gICAgfSk7XG4gICAgb3RlbENvbGxlY3Rvci5hZGRQb3J0TWFwcGluZ3Moe1xuICAgICAgICBjb250YWluZXJQb3J0OiAyMDAwLFxuICAgICAgICBwcm90b2NvbDogZWNzLlByb3RvY29sLlVEUCxcbiAgICAgICAgaG9zdFBvcnQ6IDIwMDBcbiAgICAgIH0pO1xuICAgICAgXG4gICAgb3RlbENvbGxlY3Rvci5hZGRQb3J0TWFwcGluZ3Moe1xuICAgICAgICBjb250YWluZXJQb3J0OiA0MzE3LFxuICAgICAgICBwcm90b2NvbDogZWNzLlByb3RvY29sLlRDUCxcbiAgICAgICAgaG9zdFBvcnQ6IDQzMTdcbiAgICAgIH0pO1xuICAgIG90ZWxDb2xsZWN0b3IuYWRkUG9ydE1hcHBpbmdzKHtcbiAgICAgICAgY29udGFpbmVyUG9ydDogODEyNSxcbiAgICAgICAgcHJvdG9jb2w6IGVjcy5Qcm90b2NvbC5VRFAsXG4gICAgICAgIGhvc3RQb3J0OiA4MTI1XG4gICAgICB9KTtcbiAgICBvdGVsQ29sbGVjdG9yLmFkZFBvcnRNYXBwaW5ncyh7XG4gICAgICAgIGNvbnRhaW5lclBvcnQ6IDQzMTgsXG4gICAgICAgIHByb3RvY29sOiBlY3MuUHJvdG9jb2wuVENQLFxuICAgICAgICBob3N0UG9ydDogNDMxOFxuICAgICAgfSk7XG4gICAgXG4gIH1cbn1cbiJdfQ==