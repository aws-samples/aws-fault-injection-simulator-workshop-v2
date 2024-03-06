#!/bin/bash

# Get list of subnets
AWS_REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
NATGW=$(aws ec2 describe-nat-gateways --filter Name=tag:Name,Values="Services/Microservices/PublicSubnet1" --query 'NatGateways[*].NatGatewayId' --output text) 
SUBOK=$(aws ec2 describe-nat-gateways --nat-gateway-ids $NATGW --query 'NatGateways[].SubnetId' --output text)
ROLE_NAME="s3-fis-role"

SUBNETID1=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=Services/Microservices/PublicSubnet1" --query "Subnets[].SubnetId" --output text)
SUBNETID2=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=Services/Microservices/PublicSubnet2" --query "Subnets[].SubnetId" --output text)

echo "================================================================"
echo "Setting up s3-fis-role if it doesn't exist"
echo "================================================================"


if aws iam get-role --role-name $ROLE_NAME > /dev/null 2>&1; then
        echo "IAM role $ROLE_NAME exists"
else
        aws iam create-role --role-name s3-fis-role --assume-role-policy-document file://fis-trust-policy.json
        aws iam attach-role-policy --role-name s3-fis-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSFaultInjectionSimulatorNetworkAccess
        aws iam attach-role-policy --role-name s3-fis-role --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
fi

echo "================================================================"
echo "Setting up s3 FIS templates"
echo "================================================================"

if [ "$SUBOK" = "$SUBNETID1" ]; then
    ISNOTOK=$SUBOK
    ISOK=$SUBNETID2
else
    ISNOTOK=$SUBNETID2
    ISOK=$SUBOK
fi

aws fis create-experiment-template \
    --cli-input-json '{
        "description": "PetSite S3 image bucket impaired",
        "targets": {
                "Subnets-Target-1": {
                        "resourceType": "aws:ec2:subnet",
                        "resourceArns": [
                                "arn:aws:ec2:'$AWS_REGION':'$ACCOUNT_ID':subnet/'$ISOK'"
                        ],
                        "selectionMode": "ALL"
                }
        },
        "actions": {
                "BlockAccessToS3": {
                        "actionId": "aws:network:disrupt-connectivity",
                        "description": "BlockAccessToS3 via public subnet",
                        "parameters": {
                                "duration": "PT5M",
                                "scope": "s3"
                        },
                        "targets": {
                                "Subnets": "Subnets-Target-1"
                        }
                }
        },
        "stopConditions": [
                {
                        "source": "none"
                }
        ],
        "roleArn": "arn:aws:iam::'$ACCOUNT_ID':role/s3-fis-role",
        "tags": {
                "Name": "S3 Impairment Experiment 1"
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

aws fis create-experiment-template \
    --cli-input-json '{
        "description": "PetSite S3 image bucket impaired",
        "targets": {
                "Subnets-Target-1": {
                        "resourceType": "aws:ec2:subnet",
                        "resourceArns": [
                                "arn:aws:ec2:'$AWS_REGION':'$ACCOUNT_ID':subnet/'$ISNOTOK'"
                        ],
                        "selectionMode": "ALL"
                }
        },
        "actions": {
                "BlockAccessToS3": {
                        "actionId": "aws:network:disrupt-connectivity",
                        "description": "BlockAccessToS3 via public subnet",
                        "parameters": {
                                "duration": "PT5M",
                                "scope": "s3"
                        },
                        "targets": {
                                "Subnets": "Subnets-Target-1"
                        }
                }
        },
        "stopConditions": [
                {
                        "source": "none"
                }
        ],
        "roleArn": "arn:aws:iam::'$ACCOUNT_ID':role/s3-fis-role",
        "tags": {
                "Name": "S3 Impairment Experiment 2"
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


echo "================================================================"
echo "Done"
echo "================================================================"
