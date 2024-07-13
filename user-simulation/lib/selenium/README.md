# Pet Adoption Application Testing 
This scripts purpose is to test the adoption of pets from the AWS samples pet store application using Selenium.

## Description
The folder contains the `load_test.py` python script which generates load on the pet store applications. 
The script uses Selenium to perform actions such as searching for different pet type and color. 
Upon finding a suitable pet, it will click the "Take Me Home" Option and the "Pay" options.
Currently only a Chrome broswer is used to perform these actions. 
The application URL is pulled via a AWS SSM Parameter Store value deploy via other cdk stacks.

The application will be deployed in a Docker container into a ECS service backed by Fargate. 

The automated deployment of this is done via the `load_testing.ts` file in the parent directory. See deployment section below for a step by step guide. 

## Script Prerequisites
- Python installed on your machine
- Chrome browser installed 
- AWS credentials configured with access to SSM Parameter Store

These prerequisites will be installed into the Docker container upon deployment. Only local installation is needed for development. 

## Deployment 

### Clone the repository:
```bash
git clone https://github.com/aws-samples/aws-fault-injection-simulator-workshop-v2
```

### Local usage
```bash
# Navigate to the project directory:
cd user-simulation/lib/app
pip install -r requirements.txt
python3 path_testing.py
```

### AWS Deployment 
```bash
cd /user-simulation
cdk deploy UserSimulationStack
```
The default task count is 5 but can be scaled utilizing the following command.

```bash
load_testing_cluster=$(aws ecs list-clusters | jq -r '.clusterArns[] | select(startswith("arn:aws:ecs:") and contains("/LoadTesting-Cluster")) | split("/")[-1]')
load_testing_service=$(aws ecs list-services --cluster $load_testing_cluster | jq -r '.serviceArns[] | split("/")[-1]')
aws ecs update-service --cluster $load_testing_cluster --service $load_testing_service --desired-count 8
```
