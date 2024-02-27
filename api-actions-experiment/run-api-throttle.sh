#!/bin/bash

AWS_REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')

INVOKEKEY=$(aws apigateway get-rest-apis --query 'items[?name==`fis-workshop-throttle`].[id,invokeUrl]' | sed -n '3p' | sed 's/,/ /g' | sed 's/"//g' | tr -d ' ')

THROTTLE_URL=https://$INVOKEKEY.execute-api.$AWS_REGION.amazonaws.com/v1

echo "============================================================="
echo "Have you started the FIS FisWorkshopApiThrottle yet? (YES/NO)"
echo "============================================================="
read INPUT

if [ "$INPUT" = "YES" ]; then
  for i in {1..10}
  do
    curl ${THROTTLE_URL}
  done
else
    echo "Only running one request"
    curl ${THROTTLE_URL}
    echo ""
fi
