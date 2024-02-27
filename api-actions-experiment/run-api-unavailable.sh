#!/bin/bash

AWS_REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')

INVOKEKEY=$(aws apigateway get-rest-apis --query 'items[?name==`fis-workshop-unavailable`].[id,invokeUrl]' | sed -n '3p' | sed 's/,/ /g' | sed 's/"//g' | tr -d ' ')

UNAVAILABLE_URL=https://$INVOKEKEY.execute-api.$AWS_REGION.amazonaws.com/v1
TERMINATION_URL=${UNAVAILABLE_URL}/terminate

echo "================================================================"
echo "Have you started the FIS FisWorkshopApiUnavailable yet? (YES/NO)"
echo "================================================================"
read INPUT

if [ "$INPUT" = "YES" ]; then
  echo "Executing Terminate call"
  curl ${UNAVAILABLE_URL}
else
  for i in {1..10}
  do
    curl ${UNAVAILABLE_URL}
  done
fi
