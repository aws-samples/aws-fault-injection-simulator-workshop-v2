#!/bin/bash
AWS_REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
CLUSTER_ARN=$(aws ecs list-clusters | grep -i petsearch | tr ',' '\n' | tr '"' '\n' | awk '{print $1}')
CONTAINER_INSTANCE1=$(aws ecs list-container-instances --cluster $CLUSTER_ARN | jq -r .containerInstanceArns[0])
EC2INSTID=$(aws ecs describe-container-instances --cluster $CLUSTER_ARN --container-instance $CONTAINER_INSTANCE1 | jq -r '.containerInstances[] |.ec2InstanceId')
EC2TAGNAME=$(aws ec2 describe-instances --instance-ids $EC2INSTID --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value]' --output text)

aws fis create-experiment-template \
    --cli-input-json '{
        "description": "FisAccessControlExperiment",
        "targets": {
                "Instances-Target-1": {
                        "resourceType": "aws:ec2:instance",
                        "resourceTags": {
                                "Name": "'$EC2TAGNAME'"
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
