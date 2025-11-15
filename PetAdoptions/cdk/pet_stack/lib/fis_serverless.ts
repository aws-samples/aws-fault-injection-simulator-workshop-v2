import { Stack, StackProps } from 'aws-cdk-lib';
import * as cfninc from 'aws-cdk-lib/cloudformation-include';
import { Architecture, Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';

export class FisServerless extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // For Lambda

        const nodeLayer = new LayerVersion(this, 'NodeChaosLayer', {
            layerVersionName: 'ChaosNodeLayer',
            compatibleRuntimes: [
                Runtime.NODEJS_20_X
            ],
            code: Code.fromAsset('lib/fis_serverless/layer'),
            compatibleArchitectures: [
                Architecture.X86_64
            ]
        })

        const template = new cfninc.CfnInclude(this, 'Template', {
            templateFile: 'lib/fis_serverless/cfnChaos.yml',
            parameters: { "NodeLambdaLayer": nodeLayer.layerVersionArn }
        });

        // For StepFunctions

        const machineDefinition = readFileSync("lib/fis_serverless/fis.ecs.asl.json", { encoding: 'utf8', flag: 'r' })

        const fisRole = new Role(this, 'FISRole', {
            assumedBy: new ServicePrincipal('fis.amazonaws.com'),
        });

        fisRole.addToPolicy(new PolicyStatement({
            resources: ['arn:aws:ec2:*:*:instance/*'],
            actions: ["ec2:RebootInstances",
                "ec2:StopInstances",
                "ec2:StartInstances",
                "ec2:TerminateInstances",
                "ec2:SendSpotInstanceInterruptions"],
        }));

        fisRole.addToPolicy(new PolicyStatement({
            resources: ['arn:aws:ecs:*:*:*/*'],
            actions: ["ecs:StopTask",
                "ecs:ListContainerInstances"],
        }));

        fisRole.addToPolicy(new PolicyStatement({
            resources: ['*'],
            actions: ["ec2messages:*",
                "ssm:*",
                "logs:*",
                "cloudwatch:PutMetricData"],
        }));

        fisRole.addToPolicy(new PolicyStatement({
            resources: ['arn:aws:iam::*:role/aws-service-role/ssm.amazonaws.com/AWSServiceRoleForAmazonSSM*'],
            actions: ["iam:DeleteServiceLinkedRole", "iam:GetServiceLinkedRoleDeletionStatus"],
        }));

        fisRole.addToPolicy(new PolicyStatement({
            resources: ['arn:aws:iam::*:role/aws-service-role/ssm.amazonaws.com/AWSServiceRoleForAmazonSSM'],
            actions: ["iam:CreateServiceLinkedRole"],
        }));

        const machineRole = new Role(this, 'StepFunctionRole', {
            assumedBy: new ServicePrincipal('states.amazonaws.com'),
        });

        machineRole.addToPolicy(new PolicyStatement({
            resources: ['*'],
            actions: ["xray:PutTraceSegments",
                "xray:PutTelemetryRecords",
                "xray:GetSamplingRules",
                "xray:GetSamplingTargets",
                "logs:CreateLogDelivery",
                "logs:GetLogDelivery",
                "logs:UpdateLogDelivery",
                "logs:DeleteLogDelivery",
                "logs:ListLogDeliveries",
                "logs:PutResourcePolicy",
                "logs:DescribeResourcePolicies",
                "logs:DescribeLogGroups",
                "logs:PutLogEvents",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "cloudwatch:PutMetricData",
                "cloudwatch:DescribeAlarms",
                "cloudwatch:DescribeAlarmHistory",
                "tag:GetResources",
                "ec2:DescribeInstances",
                "ecs:StopTask",
                "iam:GetUser",
                "iam:GetRole",
                "iam:ListUsers",
                "iam:ListRoles",
                "iam:CreateServiceLinkedRole",
                "fis:*",
                "ecs:List*",
                "events:PutRule",
                "events:DeleteRule",
                "events:PutTargets",
                "events:RemoveTargets"],
        }));

        machineRole.addToPolicy(new PolicyStatement({
            resources: [fisRole.roleArn],
            actions: ["iam:GetRole",
                "iam:PassRole"]
        }));

        const logGroup = new LogGroup(this, 'StateMachineECSFISLogs', {
                  logGroupName: '/aws/vendedlogs/StateMachineECSFIS',
                  removalPolicy: RemovalPolicy.DESTROY
        });


        const stateMachine = new stepfunctions.StateMachine(this, 'StateMachineECSFIS', {
            definitionBody: stepfunctions.DefinitionBody.fromString(machineDefinition.replace("${FISRole}", fisRole.roleArn)),
            role: machineRole,
            stateMachineType: stepfunctions.StateMachineType.STANDARD,
            stateMachineName: "ECSFaultInjection",
            logs: {
                destination: logGroup,
                level: stepfunctions.LogLevel.ALL,
              },
        })

        // Dummy IAM Role for the AZ Power Outage
        const fisDummyRole = new Role(this, 'FISDummyRoleForASG', {
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
        });

    }
}
