#!/bin/bash

AWS_REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
SSM_ROLE_ARN=$(aws iam get-role --role-name SSMServerRole --query Role.Arn --output text)
FIS_ROLE_NAME=ssm-hybrid-fis-role
DOCUMENTNAME=AWSFIS-Run-CPU-Stress
#DOCUMENTNAME=AWSFIS-Run-Memory-Stress
DESCRIPTION=$(echo "$DOCUMENTNAME" | sed 's/AWSFIS-//g')
ACTION=$(echo "$DESCRIPTION" | tr -d '-')

echo "\033[32m=======================================================================================================================================\033[0m"
echo "\033[31mThis script creates the SSM FIS experiment for $DOCUMENTNAME \033[0m"
echo "Native Fault Injection Service SSM Documents support Amazon Linux and Ubuntu!"
echo "You could replace $DOCUMENTNAME with: AWSFIS-Run-IO-Stress, AWSFIS-Run-Kill-Process, AWSFIS-Run-Memory-Stress,\033[0m" 
echo "                                      AWSFIS-Run-Network-Blackhole-Port, AWSFIS-Run-Network-Latency, AWSFIS-Run-Network-Latency-Sources" 
echo "                                      AWSFIS-Run-Network-Packet-Loss, AWSFIS-Run-Network-Packet-Loss-Sources, AWSFIS-Run-Disk-Fill"
echo ""
echo "If you change the DOCUMENTNAME ensure that the DocumentParameters are adjusted to the new experiment"
echo "\033[32m=======================================================================================================================================\033[0m"


aws fis create-experiment-template \
    --cli-input-json '{
        "description": "Run '$DOCUMENTNAME' on on-prem hybrid instance",
        "targets": {},
        "actions": {
                "'$ACTION'OnPrem": {
                        "actionId": "aws:ssm:start-automation-execution",
                        "description": "'$DESCRIPTION' via SSM",
                        "parameters": {
                                "documentArn": "arn:aws:ssm:'$AWS_REGION':'$ACCOUNT_ID':document/TargetHybridInstances",
                                "documentParameters": "{\"AutomationAssumeRole\": \"'$SSM_ROLE_ARN'\",\"DocumentName\": \"'$DOCUMENTNAME'\",   \"DocumentParameters\": \"{\\\"DurationSeconds\\\":\\\"120\\\"}\",   \"Filters\": \"[{\\\"Key\\\":\\\"PingStatus\\\",\\\"Values\\\":[\\\"Online\\\"]},{\\\"Key\\\":\\\"ResourceType\\\",\\\"Values\\\":[\\\"ManagedInstance\\\"]}]\" }",
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
                "Name": "'$DESCRIPTION' on all on-prem hybrid instances"
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
