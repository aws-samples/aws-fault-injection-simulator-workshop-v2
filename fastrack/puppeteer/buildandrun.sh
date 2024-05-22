#!/bin/bash
export ACCOUNT_ID=$(aws sts get-caller-identity --output text --query Account)
export AWS_REGION=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
echo "export ACCOUNT_ID=${ACCOUNT_ID}" | tee -a ~/.bash_profile
echo "export AWS_REGION=${AWS_REGION}" | tee -a ~/.bash_profile
aws configure set default.region ${AWS_REGION}
aws configure get default.region

aws eks update-kubeconfig --name PetSite --region $AWS_REGION            
kubectl get nodes      

export MYSITE=$(aws ssm get-parameter --name '/petstore/petsiteurl'  | jq -r .Parameter.Value | tr '[:upper:]' '[:lower:]' | cut -f 3 -d '/')

echo "replace MYSITE with $MYSITE"

sed -i "s/URI/$MYSITE/g" dogadopt/main.js
sed -i "s/URI/$MYSITE/g" getallpets/main.js
sed -i "s/URI/$MYSITE/g" searchlist/main.js

docker build -f AdoptDogDockerfile   --platform linux/amd64 -t adoptdog . 
docker build -f SearchListDockerfile   --platform linux/amd64 -t searchlist . 
docker build -f AllPetsDockerfile   --platform linux/amd64 -t adoptall . 


#Fix CW Evidently
#cd /home/ubuntu/environment/workshopfiles/fis-workshop/PetAdoptions/petfood
#sh activate.sh 

#cd -

docker run -d --restart unless-stopped -i --security-opt seccomp=chrome.json adoptdog
docker run -d --restart unless-stopped -i --security-opt seccomp=chrome.json searchlist
docker run -d --restart unless-stopped -i --security-opt seccomp=chrome.json adoptall
