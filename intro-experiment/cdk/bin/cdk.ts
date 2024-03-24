#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FisStackAsg } from '../lib/cdk-stack';

const app = new cdk.App();
const FisStack = new FisStackAsg(app, 'FisStackAsg', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  }
});

cdk.Tags.of(FisStack).add("experiment", "ready");