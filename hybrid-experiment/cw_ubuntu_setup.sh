#!/bin/bash
# Create a user called cwagent
if [ ! -f "aws.tar" ]; then
    echo "Error: aws.tar file not found needs to be in the same folder as the script"
    exit 1
fi

echo "Creating user cwagent"
useradd -m cwagent

echo "Adding cwagent to the admin group so it can read logs"
usermod -a -G adm cwagent

echo "Unpacking the generated aws.tar file into the /home/cwagent directory"
tar xvf aws.tar -C /home/cwagent/
chown -R cwagent:cwagent /home/cwagent/

echo "Installing the CW agent and collectd"
curl -o amazon-cloudwatch-agent.deb https://s3.amazonaws.com/amazoncloudwatch-agent/debian/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
apt-get --assume-yes install collectd

echo "Moving the config into the right place for cloudwatch"
mv /home/cwagent/amazon-cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
mv /home/cwagent/common-config.toml /opt/aws/amazon-cloudwatch-agent/etc/common-config.toml
cwagent chown -R cwagent:cwagent /opt/aws/amazon-cloudwatch-agent/etc/

echo "Starting CWagent with our predefined config"
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -s -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status
