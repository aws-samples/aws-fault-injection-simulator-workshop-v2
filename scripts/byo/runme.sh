#!/bin/sh
aws cloudformation create-stack \
  --stack-name my-pipeline-stack \
  --template-body file://pipeline-template.yaml \
  --parameters file://parameters.json \
  --capabilities CAPABILITY_IAM
