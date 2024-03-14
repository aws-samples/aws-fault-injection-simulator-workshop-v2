#!/bin/bash
BASEDIR=$(pwd)
# Create the IAM user
aws iam create-user --user-name cwagent

# Create an access key for the user
ACCESS_KEY=$(aws iam create-access-key --user-name cwagent --query 'AccessKey.AccessKeyId' --output text)
SECRET_KEY=$(aws iam create-access-key --user-name cwagent --query 'AccessKey.SecretAccessKey' --output text)

# Attach the AmazonSSMManagedInstanceCore policy
aws iam attach-user-policy --user-name cwagent --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

# Attach the CloudWatchAgentServerPolicy policy
aws iam attach-user-policy --user-name cwagent --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

# Save the access key and secret key in the credential file
echo "$ACCESS_KEY $SECRET_KEY" 

mkdir .aws
cd .aws
cat > config << EOF
[AmazonCloudWatchAgent]
output = text
region = us-east-1
EOF

cat > credentials <<EOF
[AmazonCloudWatchAgent]
aws_access_key_id = $ACCESS_KEY
aws_secret_access_key = $SECRET_KEY
EOF

cd ..
tar -cvf aws.tar $BASEDIR/.aws/ $BASEDIR/common-config.toml $BASEDIR/amazon-cloudwatch-agent.json
