#!/bin/bash
ECS_CLUSTER_ARN=$(aws ecs list-clusters | grep PetSearch | tr -d '"')
echo $ECS_CLUSTER_ARN
TASK_DEFS=$(aws ecs list-task-definitions | grep search | tr -d ',' | tr -d '"')
echo $TASK_DEFS
ECS_SRV_ARN=$(aws ecs list-services --cluster $ECS_CLUSTER_ARN | jq -r  '.serviceArns[0]') 
echo $ECS_SRV
aws ecs update-service --cluster $ECS_CLUSTER_ARN --service $ECS_SRV_ARN --force-new-deployment --placement-strategy type="spread",field="attribute:ecs.availability-zone" --query 'service.placementStrategy[]' --desired-count 2 --placement-constraints type="distinctInstance"
