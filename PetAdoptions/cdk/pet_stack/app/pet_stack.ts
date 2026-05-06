#!/usr/bin/env node
import 'source-map-support/register';
import { Services } from '../lib/services';
import { Applications } from '../lib/applications';
import { App, Tags } from 'aws-cdk-lib';
import { FisServerless } from '../lib/fis_serverless';
import { Observability } from '../lib/observability'
import { UserSimulationStack } from '../lib/user_simulation-stack';
import { ObservabilityDashboard } from '../lib/observability_dashboard';


if (!process.env.CDK_DEFAULT_REGION) {
  throw Error('Could not resolve region. Please pass it with the AWS_REGION environment variable.');
}

const app = new App();

const stack_primary = new Services(app, "Services", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});

const applications = new Applications(app, "Applications", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});

const fis_serverless = new FisServerless(app, "FisServerless", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});

const observability = new Observability(app, "Observability", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});

const usersimulationstack = new UserSimulationStack(app, 'UserSimulationStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});

const observabilityDashboard = new ObservabilityDashboard(app, "ObservabilityDashboard", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});

Tags.of(app).add("Workshop", "true")
Tags.of(app).add("AzImpairmentPower", "Ready")
app.synth();
