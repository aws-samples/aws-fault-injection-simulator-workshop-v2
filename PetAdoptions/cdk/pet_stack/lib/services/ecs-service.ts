import { RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs'

export interface EcsServiceProps {
  cluster?: ecs.Cluster,

  cpu: number;
  memoryLimitMiB: number,
  logGroupName: string,

  healthCheck?: string,

  disableService?: boolean,
  instrumentation?: string,
  enableSSM: boolean,

  repositoryURI?: string,

  desiredTaskCount: number,

  region: string,

  securityGroup: ec2.SecurityGroup
}

export abstract class EcsService extends Construct {

  private static ExecutionRolePolicy = new iam.PolicyStatement({
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

  public readonly taskDefinition: ecs.TaskDefinition;
  public readonly service: ecs_patterns.ApplicationLoadBalancedServiceBase;
  public readonly container: ecs.ContainerDefinition;

  constructor(scope: Construct, id: string, props: EcsServiceProps) {
    super(scope, id);

    const logging = new ecs.AwsLogDriver({
      streamPrefix: "logs",
      logGroup: new logs.LogGroup(this, "ecs-log-group", {
        logGroupName: props.logGroupName,
        removalPolicy: RemovalPolicy.DESTROY
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
      memoryLimitMiB: props.memoryLimitMiB,
      pidMode: ecs.PidMode.TASK,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
      }
    });

    this.taskDefinition.addToExecutionRolePolicy(EcsService.ExecutionRolePolicy);
    this.taskDefinition.taskRole?.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'AmazonECSTaskExecutionRolePolicy', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'));
    this.taskDefinition.taskRole?.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'AWSXrayWriteOnlyAccess', 'arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess'));

    // Build locally the image only if the repository URI is not specified
    // Can help speed up builds if we are not rebuilding anything
    const image = props.repositoryURI? this.containerImageFromRepository(props.repositoryURI) : this.createContainerImage()

    this.container = this.taskDefinition.addContainer('container', {
      image: image,
      memoryLimitMiB: 512,
      cpu: 256,
      logging,
      environment: { // clear text, not for sensitive data
        AWS_REGION: props.region,
      }
    });

    this.container.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP
    });

    if (props.enableSSM)  {

      this.taskDefinition.taskRole?.addToPrincipalPolicy(new iam.PolicyStatement({
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
      resources: ['arn:aws:ssm:'+props.region+':*:managed-instance/*'],
    }));

    this.taskDefinition.taskRole?.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "iam:GetRole",
        "iam:PassRole"
      ],
      resources: [ssmRole.roleArn]
    }));

    this.taskDefinition.addContainer('amazon-ssm-agent',{
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazon-ssm-agent/amazon-ssm-agent:latest'),
      memoryLimitMiB: 256,
      essential: false,
      //cpu: 256,
      logging,
      environment: { // clear text, not for sensitive data
        MANAGED_INSTANCE_ROLE_NAME:ssmRole.roleName,
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
    switch(props.instrumentation) {

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

      })

      if (props.healthCheck) {
        this.service.targetGroup.configureHealthCheck({
          path: props.healthCheck
        });
      }
    }
  }

  abstract containerImageFromRepository(repositoryURI: string) : ecs.ContainerImage;

  abstract createContainerImage(): ecs.ContainerImage;

  private addXRayContainer(taskDefinition: ecs.FargateTaskDefinition, logging: ecs.AwsLogDriver) {
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

  private addOtelCollectorContainer(taskDefinition: ecs.FargateTaskDefinition, logging: ecs.AwsLogDriver) {
    taskDefinition.addContainer('aws-otel-collector', {
        image: ecs.ContainerImage.fromRegistry('public.ecr.aws/aws-observability/aws-otel-collector:v0.32.0'),
        memoryLimitMiB: 256,
        cpu: 256,
        command: ["--config", "/etc/ecs/ecs-xray.yaml"],
        logging
    });
  }
}
