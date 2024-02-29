#!/bin/bash
cd /home/ubuntu/environment

echo "============================================================================================================================="
echo "Copying k6petsite to k6petsearch1,2"
echo "============================================================================================================================="

cp k6petsite.js k6petsearch1.js 
cp k6petsite.js k6petsearch2.js
export MYSITE=$(aws ssm get-parameter --name '/petstore/petsiteurl'  | jq -r .Parameter.Value | tr '[:upper:]' '[:lower:]' | cut -f 3 -d '/')

MYSITEC=$MYSITE
MYSITEC+="?selectedPetType=kitten&selectedPetColor=white"
echo "============================================================================================================================="
echo "Modifying URL 1 to $MYSITEC"
echo "============================================================================================================================="
sed -i "s/$MYSITE/$MYSITEC/g" k6petsearch1.js

MYSITEB=$MYSITE
MYSITEB+="?selectedPetType=kitten&selectedPetColor=black"
echo "============================================================================================================================="
echo "Modifying URL 2 to $MYSITEB"
echo "============================================================================================================================="
sed -i "s/$MYSITE/$MYSITEB/g" k6petsearch2.js
docker run --rm -i --security-opt seccomp=$(pwd)/chrome.json grafana/k6:latest-with-browser run - <k6petsearch2.js & docker run --rm -i --security-opt seccomp=$(pwd)/chrome.json grafana/k6:latest-with-browser run - <k6petsearch1.js && fg
