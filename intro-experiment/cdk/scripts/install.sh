#!/bin/bash -xe

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
#
# Amazon Linux 2023 user-data for the intro FIS experiment web fleet.
# The instances only need to return HTTP 200 on "/" so the ALB health
# check passes and the Auto Scaling group / EC2-terminate experiment can
# be observed. AL2023 uses dnf, ships the SSM Agent pre-installed, and has
# no amazon-linux-extras.

# Run system updates
dnf update -y
dnf install -y jq

# Install and configure NGINX as a lightweight web server
dnf install -y nginx
echo "<html><head><title>FIS Workshop</title></head><body><h1>Hello from $(hostname -f)</h1><p>Intro experiment web server is healthy.</p></body></html>" > /usr/share/nginx/html/index.html
systemctl enable --now nginx

# Tools used by other intro lab steps (RDS connectivity checks, scripting)
dnf install -y mariadb105 telnet python3-pip
pip3 install --no-cache-dir pymysql boto3

# Install the CloudWatch unified agent (collects CPU/mem metrics for the
# dashboard and the scaling alarms). AL2023 provides it via dnf.
dnf install -y amazon-cloudwatch-agent
# Use the bundled default config so the agent starts cleanly even without a
# custom config file present on the host.
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c default || true
systemctl enable --now amazon-cloudwatch-agent || true
