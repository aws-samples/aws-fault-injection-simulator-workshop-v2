#!/usr/bin/env node
import 'source-map-support/register';
import { Services } from '../lib/services';
import { Applications } from '../lib/applications';
//import { EKSPetsite } from '../lib/ekspetsite'
import { App, Tags } from 'aws-cdk-lib';
import { FisServerless } from '../lib/fis_serverless';
import { Observability } from '../lib/observability'
import { S3Replica } from '../lib/s3replica'
import { REGION } from '../lib/common/services-shared-properties';
import { RegionNetworkConnect } from '../lib/network_connect';
import { RegionNetworkRoutes } from '../lib/network_routes';
import { UserSimulationStack } from '../lib/user_simulation-stack';
import { ObservabilityDashboard } from '../lib/dashboards/observability_dashboard';



if (!process.env.CDK_DEFAULT_REGION) {
  throw Error('Could not resolve region. Please pass it with the AWS_REGION environment variable.');
}

const MAIN_REGION: REGION = process.env.CDK_DEFAULT_REGION as REGION;
// This needs to be updated if the second region is different from the US-WEST-2
const SECONDARY_REGION: REGION = 'us-west-2' as REGION;

const stackName = "Services";
const app = new App();

const stack_primary = new Services(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  crossRegionReferences: true,
  MainRegion: MAIN_REGION,
  SecondaryRegion: SECONDARY_REGION,
  DeploymentType: 'primary'
});

const stack_secondary = new Services(app, "ServicesSecondary", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: SECONDARY_REGION as string
  },
  crossRegionReferences: true,
  MainRegion: MAIN_REGION,
  SecondaryRegion: SECONDARY_REGION,
  DeploymentType: 'secondary',
});

const stack_network = new RegionNetworkConnect(app, "NetworkRegionPeering", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: MAIN_REGION as string
  },
  MainRegion: MAIN_REGION,
  SecondaryRegion: SECONDARY_REGION,
  DeploymentType: 'primary',
});

const stack_tgw_routes = new RegionNetworkRoutes(app, "NetworkRoutesMain", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: MAIN_REGION as string
  },
  MainRegion: MAIN_REGION,
  SecondaryRegion: SECONDARY_REGION,
  DeploymentType: 'primary',
});

const stack_tgw_routes_secondary = new RegionNetworkRoutes(app, "NetworkRoutesSecondary", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: SECONDARY_REGION as string
  },
  MainRegion: MAIN_REGION,
  SecondaryRegion: SECONDARY_REGION,
  DeploymentType: 'secondary',
});

const s3replica = new S3Replica(app, "S3Replica", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: MAIN_REGION as string
  },
  MainRegion: MAIN_REGION,
  SecondaryRegion: SECONDARY_REGION,
  DeploymentType: 'primary',
});

const applications = new Applications(app, "Applications", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  mainRegion: MAIN_REGION,
  secondaryRegion: SECONDARY_REGION,
  deploymentType: 'primary',
});

const applications_secondary = new Applications(app, "ApplicationsSecondary", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: SECONDARY_REGION as string
  },
  mainRegion: MAIN_REGION,
  secondaryRegion: SECONDARY_REGION,
  deploymentType: 'secondary',
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

const observabilitysecondary = new Observability(app, "ObservabilitySecondary", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: SECONDARY_REGION as string
  }
});

//const load_testing = new LoadTesting(app, "LoadTesting", {
//  env: {
//    account: process.env.CDK_DEFAULT_ACCOUNT,
//    region: process.env.CDK_DEFAULT_REGION
//  }
// });

const usersimulationstack = new UserSimulationStack(app, 'UserSimulationStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
}});

const usersimulationstacksecondary =  new UserSimulationStack(app, 'UserSimulationStackSecondary', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: SECONDARY_REGION as string
  }
});

const observabilityDashboard = new ObservabilityDashboard(app, "ObservabilityDashboard", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: MAIN_REGION as string
  },
  MainRegion: MAIN_REGION,
  SecondaryRegion: SECONDARY_REGION,
  DeploymentType: 'primary',
});


Tags.of(app).add("Workshop", "true")
Tags.of(app).add("AzImpairmentPower", "Ready")
//Aspects.of(stack).add(new AwsSolutionsChecks({verbose: true}));
//Aspects.of(applications).add(new AwsSolutionsChecks({verbose: true}));
app.synth();
