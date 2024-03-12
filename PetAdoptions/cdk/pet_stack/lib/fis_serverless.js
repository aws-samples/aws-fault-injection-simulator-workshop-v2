"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FisServerless = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const cfninc = require("aws-cdk-lib/cloudformation-include");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const stepfunctions = require("aws-cdk-lib/aws-stepfunctions");
const fs_1 = require("fs");
const aws_logs_1 = require("aws-cdk-lib/aws-logs");
class FisServerless extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // For Lambda
        const nodeLayer = new aws_lambda_1.LayerVersion(this, 'NodeChaosLayer', {
            layerVersionName: 'ChaosNodeLayer',
            compatibleRuntimes: [
                aws_lambda_1.Runtime.NODEJS_16_X
            ],
            code: aws_lambda_1.Code.fromAsset('lib/fis_serverless/layer'),
            compatibleArchitectures: [
                aws_lambda_1.Architecture.X86_64
            ]
        });
        const template = new cfninc.CfnInclude(this, 'Template', {
            templateFile: 'lib/fis_serverless/cfnChaos.yml',
            parameters: { "NodeLambdaLayer": nodeLayer.layerVersionArn }
        });
        // For StepFunctions
        const machineDefinition = (0, fs_1.readFileSync)("lib/fis_serverless/fis.ecs.asl.json", { encoding: 'utf8', flag: 'r' });
        const fisRole = new aws_iam_1.Role(this, 'FISRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('fis.amazonaws.com'),
        });
        fisRole.addToPolicy(new aws_iam_1.PolicyStatement({
            resources: ['arn:aws:ec2:*:*:instance/*'],
            actions: ["ec2:RebootInstances",
                "ec2:StopInstances",
                "ec2:StartInstances",
                "ec2:TerminateInstances",
                "ec2:SendSpotInstanceInterruptions"],
        }));
        fisRole.addToPolicy(new aws_iam_1.PolicyStatement({
            resources: ['arn:aws:ecs:*:*:*/*'],
            actions: ["ecs:StopTask",
                "ecs:ListContainerInstances"],
        }));
        fisRole.addToPolicy(new aws_iam_1.PolicyStatement({
            resources: ['*'],
            actions: ["ec2messages:*",
                "ssm:*",
                "logs:*",
                "cloudwatch:PutMetricData"],
        }));
        fisRole.addToPolicy(new aws_iam_1.PolicyStatement({
            resources: ['arn:aws:iam::*:role/aws-service-role/ssm.amazonaws.com/AWSServiceRoleForAmazonSSM*'],
            actions: ["iam:DeleteServiceLinkedRole", "iam:GetServiceLinkedRoleDeletionStatus"],
        }));
        fisRole.addToPolicy(new aws_iam_1.PolicyStatement({
            resources: ['arn:aws:iam::*:role/aws-service-role/ssm.amazonaws.com/AWSServiceRoleForAmazonSSM'],
            actions: ["iam:CreateServiceLinkedRole"],
        }));
        const machineRole = new aws_iam_1.Role(this, 'StepFunctionRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('states.amazonaws.com'),
        });
        machineRole.addToPolicy(new aws_iam_1.PolicyStatement({
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
        machineRole.addToPolicy(new aws_iam_1.PolicyStatement({
            resources: [fisRole.roleArn],
            actions: ["iam:GetRole",
                "iam:PassRole"]
        }));
        const logGroup = new aws_logs_1.LogGroup(this, 'StateMachineECSFISLogs');
        const stateMachine = new stepfunctions.StateMachine(this, 'StateMachineECSFIS', {
            definitionBody: stepfunctions.DefinitionBody.fromString(machineDefinition.replace("${FISRole}", fisRole.roleArn)),
            role: machineRole,
            stateMachineType: stepfunctions.StateMachineType.STANDARD,
            stateMachineName: "ECSFaultInjection",
            logs: {
                destination: logGroup,
                level: stepfunctions.LogLevel.ALL,
            },
        });
        // Dummy IAM Role for the AZ Power Outage
        const fisDummyRole = new aws_iam_1.Role(this, 'FISDummyRoleForASG', {
            assumedBy: new aws_iam_1.ServicePrincipal('ec2.amazonaws.com'),
        });
    }
}
exports.FisServerless = FisServerless;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlzX3NlcnZlcmxlc3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmaXNfc2VydmVybGVzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBZ0Q7QUFDaEQsNkRBQTZEO0FBQzdELHVEQUFtRjtBQUNuRixpREFBOEU7QUFDOUUsK0RBQStEO0FBRS9ELDJCQUFrQztBQUNsQyxtREFBZ0Q7QUFFaEQsTUFBYSxhQUFjLFNBQVEsbUJBQUs7SUFDcEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQjtRQUN4RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixhQUFhO1FBRWIsTUFBTSxTQUFTLEdBQUcsSUFBSSx5QkFBWSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN2RCxnQkFBZ0IsRUFBRSxnQkFBZ0I7WUFDbEMsa0JBQWtCLEVBQUU7Z0JBQ2hCLG9CQUFPLENBQUMsV0FBVzthQUN0QjtZQUNELElBQUksRUFBRSxpQkFBSSxDQUFDLFNBQVMsQ0FBQywwQkFBMEIsQ0FBQztZQUNoRCx1QkFBdUIsRUFBRTtnQkFDckIseUJBQVksQ0FBQyxNQUFNO2FBQ3RCO1NBQ0osQ0FBQyxDQUFBO1FBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDckQsWUFBWSxFQUFFLGlDQUFpQztZQUMvQyxVQUFVLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLENBQUMsZUFBZSxFQUFFO1NBQy9ELENBQUMsQ0FBQztRQUVILG9CQUFvQjtRQUVwQixNQUFNLGlCQUFpQixHQUFHLElBQUEsaUJBQVksRUFBQyxxQ0FBcUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUE7UUFFOUcsTUFBTSxPQUFPLEdBQUcsSUFBSSxjQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFB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QixDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2pILElBQUksRUFBRSxXQUFXO1lBQ2pCLGdCQUFnQixFQUFFLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRO1lBQ3pELGdCQUFnQixFQUFFLG1CQUFtQjtZQUNyQyxJQUFJLEVBQUU7Z0JBQ0YsV0FBVyxFQUFFLFFBQVE7Z0JBQ3JCLEtBQUssRUFBRSxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUc7YUFDbEM7U0FDTixDQUFDLENBQUE7UUFFRix5Q0FBeUM7UUFDekMsTUFBTSxZQUFZLEdBQUcsSUFBSSxjQUFJLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3RELFNBQVMsRUFBRSxJQUFJLDBCQUFnQixDQUFDLG1CQUFtQixDQUFDO1NBQ3ZELENBQUMsQ0FBQztJQUVQLENBQUM7Q0FDSjtBQWhJRCxzQ0FnSUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcyB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNmbmluYyBmcm9tICdhd3MtY2RrLWxpYi9jbG91ZGZvcm1hdGlvbi1pbmNsdWRlJztcbmltcG9ydCB7IEFyY2hpdGVjdHVyZSwgQ29kZSwgTGF5ZXJWZXJzaW9uLCBSdW50aW1lIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBSb2xlLCBTZXJ2aWNlUHJpbmNpcGFsLCBQb2xpY3lTdGF0ZW1lbnQgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHN0ZXBmdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBMb2dHcm91cCB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcblxuZXhwb3J0IGNsYXNzIEZpc1NlcnZlcmxlc3MgZXh0ZW5kcyBTdGFjayB7XG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTdGFja1Byb3BzKSB7XG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgICAgIC8vIEZvciBMYW1iZGFcblxuICAgICAgICBjb25zdCBub2RlTGF5ZXIgPSBuZXcgTGF5ZXJWZXJzaW9uKHRoaXMsICdOb2RlQ2hhb3NMYXllcicsIHtcbiAgICAgICAgICAgIGxheWVyVmVyc2lvbk5hbWU6ICdDaGFvc05vZGVMYXllcicsXG4gICAgICAgICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtcbiAgICAgICAgICAgICAgICBSdW50aW1lLk5PREVKU18xNl9YXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgY29kZTogQ29kZS5mcm9tQXNzZXQoJ2xpYi9maXNfc2VydmVybGVzcy9sYXllcicpLFxuICAgICAgICAgICAgY29tcGF0aWJsZUFyY2hpdGVjdHVyZXM6IFtcbiAgICAgICAgICAgICAgICBBcmNoaXRlY3R1cmUuWDg2XzY0XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG5cbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBuZXcgY2ZuaW5jLkNmbkluY2x1ZGUodGhpcywgJ1RlbXBsYXRlJywge1xuICAgICAgICAgICAgdGVtcGxhdGVGaWxlOiAnbGliL2Zpc19zZXJ2ZXJsZXNzL2NmbkNoYW9zLnltbCcsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiB7IFwiTm9kZUxhbWJkYUxheWVyXCI6IG5vZGVMYXllci5sYXllclZlcnNpb25Bcm4gfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBGb3IgU3RlcEZ1bmN0aW9uc1xuXG4gICAgICAgIGNvbnN0IG1hY2hpbmVEZWZpbml0aW9uID0gcmVhZEZpbGVTeW5jKFwibGliL2Zpc19zZXJ2ZXJsZXNzL2Zpcy5lY3MuYXNsLmpzb25cIiwgeyBlbmNvZGluZzogJ3V0ZjgnLCBmbGFnOiAncicgfSlcblxuICAgICAgICBjb25zdCBmaXNSb2xlID0gbmV3IFJvbGUodGhpcywgJ0ZJU1JvbGUnLCB7XG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdmaXMuYW1hem9uYXdzLmNvbScpLFxuICAgICAgICB9KTtcblxuICAgICAgICBmaXNSb2xlLmFkZFRvUG9saWN5KG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJ2Fybjphd3M6ZWMyOio6KjppbnN0YW5jZS8qJ10sXG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJlYzI6UmVib290SW5zdGFuY2VzXCIsXG4gICAgICAgICAgICAgICAgXCJlYzI6U3RvcEluc3RhbmNlc1wiLFxuICAgICAgICAgICAgICAgIFwiZWMyOlN0YXJ0SW5zdGFuY2VzXCIsXG4gICAgICAgICAgICAgICAgXCJlYzI6VGVybWluYXRlSW5zdGFuY2VzXCIsXG4gICAgICAgICAgICAgICAgXCJlYzI6U2VuZFNwb3RJbnN0YW5jZUludGVycnVwdGlvbnNcIl0sXG4gICAgICAgIH0pKTtcblxuICAgICAgICBmaXNSb2xlLmFkZFRvUG9saWN5KG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJ2Fybjphd3M6ZWNzOio6KjoqLyonXSxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcImVjczpTdG9wVGFza1wiLFxuICAgICAgICAgICAgICAgIFwiZWNzOkxpc3RDb250YWluZXJJbnN0YW5jZXNcIl0sXG4gICAgICAgIH0pKTtcblxuICAgICAgICBmaXNSb2xlLmFkZFRvUG9saWN5KG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcImVjMm1lc3NhZ2VzOipcIixcbiAgICAgICAgICAgICAgICBcInNzbToqXCIsXG4gICAgICAgICAgICAgICAgXCJsb2dzOipcIixcbiAgICAgICAgICAgICAgICBcImNsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YVwiXSxcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIGZpc1JvbGUuYWRkVG9Qb2xpY3kobmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICByZXNvdXJjZXM6IFsnYXJuOmF3czppYW06Oio6cm9sZS9hd3Mtc2VydmljZS1yb2xlL3NzbS5hbWF6b25hd3MuY29tL0FXU1NlcnZpY2VSb2xlRm9yQW1hem9uU1NNKiddLFxuICAgICAgICAgICAgYWN0aW9uczogW1wiaWFtOkRlbGV0ZVNlcnZpY2VMaW5rZWRSb2xlXCIsIFwiaWFtOkdldFNlcnZpY2VMaW5rZWRSb2xlRGVsZXRpb25TdGF0dXNcIl0sXG4gICAgICAgIH0pKTtcblxuICAgICAgICBmaXNSb2xlLmFkZFRvUG9saWN5KG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJ2Fybjphd3M6aWFtOjoqOnJvbGUvYXdzLXNlcnZpY2Utcm9sZS9zc20uYW1hem9uYXdzLmNvbS9BV1NTZXJ2aWNlUm9sZUZvckFtYXpvblNTTSddLFxuICAgICAgICAgICAgYWN0aW9uczogW1wiaWFtOkNyZWF0ZVNlcnZpY2VMaW5rZWRSb2xlXCJdLFxuICAgICAgICB9KSk7XG5cbiAgICAgICAgY29uc3QgbWFjaGluZVJvbGUgPSBuZXcgUm9sZSh0aGlzLCAnU3RlcEZ1bmN0aW9uUm9sZScsIHtcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ3N0YXRlcy5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG1hY2hpbmVSb2xlLmFkZFRvUG9saWN5KG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcInhyYXk6UHV0VHJhY2VTZWdtZW50c1wiLFxuICAgICAgICAgICAgICAgIFwieHJheTpQdXRUZWxlbWV0cnlSZWNvcmRzXCIsXG4gICAgICAgICAgICAgICAgXCJ4cmF5OkdldFNhbXBsaW5nUnVsZXNcIixcbiAgICAgICAgICAgICAgICBcInhyYXk6R2V0U2FtcGxpbmdUYXJnZXRzXCIsXG4gICAgICAgICAgICAgICAgXCJsb2dzOkNyZWF0ZUxvZ0RlbGl2ZXJ5XCIsXG4gICAgICAgICAgICAgICAgXCJsb2dzOkdldExvZ0RlbGl2ZXJ5XCIsXG4gICAgICAgICAgICAgICAgXCJsb2dzOlVwZGF0ZUxvZ0RlbGl2ZXJ5XCIsXG4gICAgICAgICAgICAgICAgXCJsb2dzOkRlbGV0ZUxvZ0RlbGl2ZXJ5XCIsXG4gICAgICAgICAgICAgICAgXCJsb2dzOkxpc3RMb2dEZWxpdmVyaWVzXCIsXG4gICAgICAgICAgICAgICAgXCJsb2dzOlB1dFJlc291cmNlUG9saWN5XCIsXG4gICAgICAgICAgICAgICAgXCJsb2dzOkRlc2NyaWJlUmVzb3VyY2VQb2xpY2llc1wiLFxuICAgICAgICAgICAgICAgIFwibG9nczpEZXNjcmliZUxvZ0dyb3Vwc1wiLFxuICAgICAgICAgICAgICAgIFwibG9nczpQdXRMb2dFdmVudHNcIixcbiAgICAgICAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nR3JvdXBcIixcbiAgICAgICAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nU3RyZWFtXCIsXG4gICAgICAgICAgICAgICAgXCJjbG91ZHdhdGNoOlB1dE1ldHJpY0RhdGFcIixcbiAgICAgICAgICAgICAgICBcImNsb3Vkd2F0Y2g6RGVzY3JpYmVBbGFybXNcIixcbiAgICAgICAgICAgICAgICBcImNsb3Vkd2F0Y2g6RGVzY3JpYmVBbGFybUhpc3RvcnlcIixcbiAgICAgICAgICAgICAgICBcInRhZzpHZXRSZXNvdXJjZXNcIixcbiAgICAgICAgICAgICAgICBcImVjMjpEZXNjcmliZUluc3RhbmNlc1wiLFxuICAgICAgICAgICAgICAgIFwiZWNzOlN0b3BUYXNrXCIsXG4gICAgICAgICAgICAgICAgXCJpYW06R2V0VXNlclwiLFxuICAgICAgICAgICAgICAgIFwiaWFtOkdldFJvbGVcIixcbiAgICAgICAgICAgICAgICBcImlhbTpMaXN0VXNlcnNcIixcbiAgICAgICAgICAgICAgICBcImlhbTpMaXN0Um9sZXNcIixcbiAgICAgICAgICAgICAgICBcImlhbTpDcmVhdGVTZXJ2aWNlTGlua2VkUm9sZVwiLFxuICAgICAgICAgICAgICAgIFwiZmlzOipcIixcbiAgICAgICAgICAgICAgICBcImVjczpMaXN0KlwiLFxuICAgICAgICAgICAgICAgIFwiZXZlbnRzOlB1dFJ1bGVcIixcbiAgICAgICAgICAgICAgICBcImV2ZW50czpEZWxldGVSdWxlXCIsXG4gICAgICAgICAgICAgICAgXCJldmVudHM6UHV0VGFyZ2V0c1wiLFxuICAgICAgICAgICAgICAgIFwiZXZlbnRzOlJlbW92ZVRhcmdldHNcIl0sXG4gICAgICAgIH0pKTtcblxuICAgICAgICBtYWNoaW5lUm9sZS5hZGRUb1BvbGljeShuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIHJlc291cmNlczogW2Zpc1JvbGUucm9sZUFybl0sXG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJpYW06R2V0Um9sZVwiLFxuICAgICAgICAgICAgICAgIFwiaWFtOlBhc3NSb2xlXCJdXG4gICAgICAgIH0pKTtcblxuICAgICAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBMb2dHcm91cCh0aGlzLCAnU3RhdGVNYWNoaW5lRUNTRklTTG9ncycpO1xuXG4gICAgICAgIGNvbnN0IHN0YXRlTWFjaGluZSA9IG5ldyBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZSh0aGlzLCAnU3RhdGVNYWNoaW5lRUNTRklTJywge1xuICAgICAgICAgICAgZGVmaW5pdGlvbkJvZHk6IHN0ZXBmdW5jdGlvbnMuRGVmaW5pdGlvbkJvZHkuZnJvbVN0cmluZyhtYWNoaW5lRGVmaW5pdGlvbi5yZXBsYWNlKFwiJHtGSVNSb2xlfVwiLCBmaXNSb2xlLnJvbGVBcm4pKSxcbiAgICAgICAgICAgIHJvbGU6IG1hY2hpbmVSb2xlLFxuICAgICAgICAgICAgc3RhdGVNYWNoaW5lVHlwZTogc3RlcGZ1bmN0aW9ucy5TdGF0ZU1hY2hpbmVUeXBlLlNUQU5EQVJELFxuICAgICAgICAgICAgc3RhdGVNYWNoaW5lTmFtZTogXCJFQ1NGYXVsdEluamVjdGlvblwiLFxuICAgICAgICAgICAgbG9nczoge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uOiBsb2dHcm91cCxcbiAgICAgICAgICAgICAgICBsZXZlbDogc3RlcGZ1bmN0aW9ucy5Mb2dMZXZlbC5BTEwsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gRHVtbXkgSUFNIFJvbGUgZm9yIHRoZSBBWiBQb3dlciBPdXRhZ2VcbiAgICAgICAgY29uc3QgZmlzRHVtbXlSb2xlID0gbmV3IFJvbGUodGhpcywgJ0ZJU0R1bW15Um9sZUZvckFTRycsIHtcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ2VjMi5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIH0pO1xuXG4gICAgfVxufVxuIl19