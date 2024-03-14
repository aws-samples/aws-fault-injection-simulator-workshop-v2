#!/bin/bash

# Create a user called cwagent
sudo useradd -m cwagent
# Add the cwagent user to the adm group
sudo usermod -a -G adm cwagent
# Move the aws.tar file to the cwagent's home directory
sudo mv aws.tar /home/cwagent/
# Change to the cwagent's home directory
# Unpack the tar file
sudo chown cwagent:cwagent /home/cwagent/aws.tar
sudo -u cwagent tar -xf /home/cwagent/aws.tar
# Ensure that the cwagent user and group own all the files
sudo -u cwagent chown -R cwagent:cwagent /home/cwagent/*

curl -o amazon-cloudwatch-agent.deb https://s3.amazonaws.com/amazoncloudwatch-agent/debian/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
sudo apt-get --assume-yes install collectd
sudo -u cwagent mv amazon-cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo -u mv common-config.toml /opt/aws/amazon-cloudwatch-agent/etc/common-config.toml
sudo -u cwagent chown -R cwagent:cwagent /opt/aws/amazon-cloudwatch-agent/etc/
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -s -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status
