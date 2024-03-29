#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UserSimulationStack } from '../lib/user_simulation-stack';

const app = new cdk.App();

new UserSimulationStack(app, 'UserSimulationStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
}});
