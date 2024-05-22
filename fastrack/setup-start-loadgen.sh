#!/bin/bash

echo "============================================================================================================================="
echo "Ensure you are in /home/ubuntu/environment"
echo "============================================================================================================================="
cd /home/ubuntu/environment/
pwd

echo "============================================================================================================================="
echo "Setting Variables PETLISTADOPTIONS_CLUSTER and TRAFFICGENERATOR_SERVICE and launching 5 pods to generate service side traffic"
echo "============================================================================================================================="
PETLISTADOPTIONS_CLUSTER=$(aws ecs list-clusters | jq '.clusterArns[]|select(contains("PetList"))' -r)
TRAFFICGENERATOR_SERVICE=$(aws ecs list-services --cluster $PETLISTADOPTIONS_CLUSTER | jq '.serviceArns[]|select(contains("trafficgenerator"))' -r)
aws ecs update-service --cluster $PETLISTADOPTIONS_CLUSTER --service $TRAFFICGENERATOR_SERVICE --desired-count 5

echo "============================================================================================================================="
echo "Save the URI for your petsite as a variable MYSITE that we can later user during the workshop"
echo "============================================================================================================================="

export MYSITE=$(aws ssm get-parameter --name '/petstore/petsiteurl'  | jq -r .Parameter.Value | tr '[:upper:]' '[:lower:]' | cut -f 3 -d '/')
echo $MYSITE

echo "============================================================================================================================="
echo "Download file to set seccomp profile"
echo "============================================================================================================================="

curl -o chrome.json https://raw.githubusercontent.com/jfrazelle/dotfiles/master/etc/docker/seccomp/chrome.json
cat chrome.json

echo "============================================================================================================================="
echo "create a sample k6 load script"
echo "============================================================================================================================="

cat > k6petsite.js << EOF
import { browser } from 'k6/experimental/browser';
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  scenarios: {
    browser: {
      executor: 'constant-vus',
      exec: 'browserTest',
      vus: 4,
      duration: '599s',
      options: {
        browser: {
          type: 'chromium',
        }
      }
    }
  }
};

export async function browserTest() {
  const page = browser.newPage();

  try {
    await page.goto('http://URI/');

    const submitButton = page.locator('input[value="Search"]');

    await Promise.all([page.waitForNavigation(), submitButton.click()]);

  } finally {
    page.close();
  }
}
EOF

echo "============================================================================================================================="
echo "Replace URL in the load scripts with current petsite url $MYSITE"
echo "============================================================================================================================="

sed -i "s/URI/$MYSITE/g" k6petsite.js

echo "============================================================================================================================="
echo "Generating load for 10 minuites to build steady state for $MYSITE"
echo "============================================================================================================================="

while true; do
    docker run --rm -i --security-opt seccomp=$(pwd)/chrome.json grafana/k6:latest-with-browser run - < k6petsite.js
    sleep 1  # Pause for 10 seconds before restarting
done
