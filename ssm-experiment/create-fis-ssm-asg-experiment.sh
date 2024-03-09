#!/bin/bash

AWS_REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
SSM_ROLE_ARN=$(aws iam get-role --role-name FisWorkshopSsmEc2DemoRole --query Role.Arn --output text)
FIS_ROLE_NAME=FisSsmExecutionRole
ASG_NAME=$(aws autoscaling describe-auto-scaling-groups --filters Name=tag-key,Values=Name Name=tag-value,Values='Services/PetSearchEc2/PetSearchEc2' --query 'AutoScalingGroups[*].AutoScalingGroupName'  --output text)
AUTO_SCALING_GROUP_NAME=$ASG_NAME
AUTO_SCALING_GROUP_INFO=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $AUTO_SCALING_GROUP_NAME  --query 'AutoScalingGroups[0]')
FIRST_AVAILABILITY_ZONE=$(echo $AUTO_SCALING_GROUP_INFO | jq -r '.AvailabilityZones[0]')

aws fis create-experiment-template \
    --cli-input-json '{
        "description": "Terminate All ASG Instances in AZ",
        "targets": {},
        "actions": {
                "terminateInstances": {
                        "actionId": "aws:ssm:start-automation-execution",
                        "description": "Terminate Instances in AZ",
                        "parameters": {
                                "documentArn": "arn:aws:ssm:'$AWS_REGION':'$ACCOUNT_ID':document/TerminateAsgInstancesWithSsm",
                                "documentParameters": "{\"AvailabilityZone\": \"'$FIRST_AVAILABILITY_ZONE'\", \"AutoscalingGroupName\": \"'$AUTO_SCALING_GROUP_NAME'\", \"AutomationAssumeRole\":\"'$SSM_ROLE_ARN'\"}",
                                "maxDuration": "PT3M"
                        }
                }
        },
        "stopConditions": [
                {
                        "source": "none"
                }
        ],
        "roleArn": "arn:aws:iam::'$ACCOUNT_ID':role/'$FIS_ROLE_NAME'",
        "tags": {
                "Name": "Terminate ASG"
        },
        "logConfiguration": {
                "cloudWatchLogsConfiguration": {
                        "logGroupArn": "arn:aws:logs:'$AWS_REGION':'$ACCOUNT_ID':log-group:FISExperiments:*"
                },
                "logSchemaVersion": 2
        },
        "experimentOptions": {
                "accountTargeting": "single-account",
                "emptyTargetResolutionMode": "fail"
        }
}'
