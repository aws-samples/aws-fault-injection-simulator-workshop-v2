import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Cloud9Environment } from '../modules/cloud9';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class Cloud9Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // checking if execution is in the EventEngine / Workshop Studio
    var isEventEngine = 'false';

    if (this.node.tryGetContext('is_event_engine') != undefined) {
      isEventEngine = this.node.tryGetContext('is_event_engine');
    }

    const stackName = id;

    if (isEventEngine === 'true') {

      // We are running in Cloud9, need to prepare environment for Cloud 9
      // The VPC where all the Cloud9 and supporting services will be deployed into
      var cidrRange = "10.253.0.0/16";
      const theVPC = new ec2.Vpc(this, 'ParticipantSupportingServices', {
        ipAddresses: ec2.IpAddresses.cidr(cidrRange),
        natGateways: 1,
        maxAzs: 2,
      });

      // Cloud 9 Environment Deployment
      var c9Env = new Cloud9Environment(this, 'Cloud9Environment', {
        vpcId: theVPC.vpcId,
        subnetId: theVPC.publicSubnets[0].subnetId,
        cloud9OwnerArn: "assumed-role/WSParticipantRole/Participant",
        templateFile: __dirname + "/../../../cloud9-cfn.yaml"
      });

      var c9role = c9Env.c9Role;

      // Dynamically check if AWSCloud9SSMAccessRole and AWSCloud9SSMInstanceProfile exists
      const c9SSMRole = new iam.Role(this, 'AWSCloud9SSMAccessRole', {
        path: '/service-role/',
        roleName: 'AWSCloud9SSMAccessRole',
        assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal("ec2.amazonaws.com"), new iam.ServicePrincipal("cloud9.amazonaws.com")),
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AWSCloud9SSMInstanceProfile"), iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")]
      });

      if (c9role != undefined) {
        new ssm.StringParameter(this, 'cloud9IAMrole', { parameterName: '/cloud9/c9iamrolearn', stringValue: c9role.attrArn });
      }
    }
  }
}
