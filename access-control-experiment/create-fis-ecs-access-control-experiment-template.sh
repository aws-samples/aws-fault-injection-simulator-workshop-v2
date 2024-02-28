#!/bin/bash
AWS_REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

aws fis create-experiment-template \
    --cli-input-json '{
        "description": "FisAccessControlExperiment",
        "targets": {
                "Instances-Target-1": {
                        "resourceType": "aws:ec2:instance",
                        "resourceTags": {
                                "Name": "Services/PetSearchEc2/PetSearchEc2"
                        },
                        "selectionMode": "PERCENT(50)"
                }
        },
        "actions": {
                "TerminateEC2": {
                        "actionId": "aws:ec2:terminate-instances",
                        "parameters": {},
                        "targets": {
                                "Instances": "Instances-Target-1"
                        }
                }
        },
        "stopConditions": [
                {
                        "source": "none"
                }
        ],
        "roleArn": "arn:aws:iam::'$ACCOUNT_ID':role/FisWorkshopServiceRole",
        "tags": {
                "Name": "FIS-Workshop-AccessControl-ECS-Instance-Terminate"
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
