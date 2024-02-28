#!/bin/bash
AWS_REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
#Get Cluster named PetSearch
CLUSTER_ARN=$(aws ecs list-clusters | grep -i petsearch | tr ',' '\n' | tr '"' '\n' | awk '{print $1}')  

#We have two instances running that we need to query for the tasks
CONTAINER_INSTANCE1=$(aws ecs list-container-instances --cluster $CLUSTER_ARN | jq -r .containerInstanceArns[0] )
#echo "CONTAINERINSTANCE1: $CONTAINER_INSTANCE1"
CONTAINER_INSTANCE2=$(aws ecs list-container-instances --cluster $CLUSTER_ARN | jq -r .containerInstanceArns[1] )
#echo "CONATINERINSTANCE2: $CONTAINER_INSTANCE2"

INST1=$(aws ecs describe-container-instances --cluster $CLUSTER_ARN --container-instance $CONTAINER_INSTANCE1 | jq -r '.containerInstances[] |.runningTasksCount')
INST2=$(aws ecs describe-container-instances --cluster $CLUSTER_ARN --container-instance $CONTAINER_INSTANCE2 | jq -r '.containerInstances[] |.runningTasksCount')
#echo $INST1
#echo $INST2


if [ "$INST1" = 2 ]; then
        CHECK_THIS_INSTANCE=$CONTAINER_INSTANCE1
    else
        CHECK_THIS_INSTANCE=$CONTAINER_INSTANCE2
fi


INSTANCE_ID=$(aws ecs describe-container-instances --cluster $CLUSTER_ARN --container-instance $CHECK_THIS_INSTANCE | jq -r '.containerInstances[] |.ec2InstanceId')

aws fis create-experiment-template \
--cli-input-json '{
        "description": " ECS-EC2-Instance-Terminate",
        "targets": {
            "PetSearch": {
                "resourceType": "aws:ec2:instance",
                "resourceArns": [
                    "arn:aws:ec2:'$AWS_REGION':'$ACCOUNT_ID':instance/'$INSTANCE_ID'"
                ],
                "selectionMode": "ALL"
            }
        },
        "actions": {
            "ECSInstanceTerminate": {
                "actionId": "aws:ec2:terminate-instances",
                "parameters": {},
                "targets": {
                    "Instances": "PetSearch"
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
