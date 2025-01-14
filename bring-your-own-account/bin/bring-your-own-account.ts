#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FisWorkshopStack } from '../lib/fis-workshop-stack';

const app = new cdk.App();

// Deploy to us-east-1
new FisWorkshopStack(app, 'FisWorkshopStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1'
  }
});

// // Deploy to us-west-2
// new FisWorkshopStack(app, 'FisWorkshopStack-Secondary', {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: 'us-west-2'
//   }
// });
