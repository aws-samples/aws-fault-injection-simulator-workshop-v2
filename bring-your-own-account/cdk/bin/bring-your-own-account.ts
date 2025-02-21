#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FisWorkshopStack } from '../lib/fis-workshop-stack';

const app = new cdk.App();

const eeTeamRoleArn = app.node.tryGetContext('eeTeamRoleArn') || process.env.eeTeamRoleArn;
 
if (!eeTeamRoleArn) {
    throw new Error('eeTeamRoleArn must be provided either via context or eeTeamRoleArn environment variable');
}

const gitBranch = app.node.tryGetContext('gitBranch') ||  process.env.gitBranch || 'main';
// const environmentName = app.node.tryGetContext('environmentName') ||  process.env.environmentName || 'FISWorkshopPipeline'; //'An environment name that is prefixed to resource names'
const isEventEngine = app.node.tryGetContext('isEventEngine') ||  process.env.isEventEngine || 'false'; // 'Please enter the IP range (CIDR notation) for the private subnet in the first Availability Zone'


// Deploy to us-east-1
new FisWorkshopStack(app, 'FisWorkshopStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1'
  },
  eeTeamRoleArn: eeTeamRoleArn,
  gitBranch: gitBranch,
  // environmentName: environmentName,
  isEventEngine: isEventEngine
});

// // Deploy to us-west-2
// new FisWorkshopStack(app, 'FisWorkshopStack-Secondary', {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: 'us-west-2'
//   }
// });
