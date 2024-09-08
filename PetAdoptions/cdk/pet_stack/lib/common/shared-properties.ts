import { StackProps } from "aws-cdk-lib";

export interface ServiceStackProps extends StackProps {
    MainRegion: REGION,
    SecondaryRegion: REGION,
   // DeploymentType: string,
  }

export type REGION = 'us-east-1' | 'us-east-2' | 'us-west-1' | 'us-west-2' | 'eu-central-1' | 'eu-west-1' | 'eu-west-2' | 'ap-south-1' | 'ap-northeast-1' | 'ap-northeast-2' | 'ap-southeast-1' | 'ap-southeast-2' | 'ca-central-1' | 'sa-east-1;
//export type DEPLOYMENTTYPE = 'primary' | 'secondary'