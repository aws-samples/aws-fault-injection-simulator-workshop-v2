#!/bin/bash
# Create the IAM user
aws iam create-user --user-name cwagent

# Create an access key for the user
aws iam create-access-key --user-name cwagent --output json > access_key_output.json
ACCESS_KEY_ID=$(jq -r '.AccessKey.AccessKeyId' access_key_output.json)
SECRET_ACCESS_KEY=$(jq -r '.AccessKey.SecretAccessKey' access_key_output.json)
rm -f access_key_output.json

# Attach the AmazonSSMManagedInstanceCore policy
aws iam attach-user-policy --user-name cwagent --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

# Attach the CloudWatchAgentServerPolicy policy
aws iam attach-user-policy --user-name cwagent --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

mkdir .aws
cd .aws
cat > config << EOF
[AmazonCloudWatchAgent]
output = text
region = us-east-1
EOF

cat > credentials <<EOF
[AmazonCloudWatchAgent]
aws_access_key_id = $ACCESS_KEY_ID
aws_secret_access_key = $SECRET_ACCESS_KEY
EOF

cd ..
tar -cvf aws.tar .aws/ common-config.toml amazon-cloudwatch-agent.json
