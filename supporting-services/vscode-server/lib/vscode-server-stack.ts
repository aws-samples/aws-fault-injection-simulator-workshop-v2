import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';

export class VscodeServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Notice we're using CfnInclude directly, not cfninc.CfnInclude
    const template = new CfnInclude(this, 'VsCodeServerTemplate', {
      templateFile: __dirname + "/../../../vscode-server.yml",
      
      // Optional: If your template has parameters, you can specify them here
      parameters: {
        EC2KeyPair: 'laptop',
      }
    });
    
    // Get the VSCodeInstanceRole resource from the imported CloudFormation template
    const vsCodeInstanceRole = template.getResource('VSCodeInstanceRole');
    
    // Create an SSM Parameter to store the ARN of the VSCodeInstanceRole
    new ssm.StringParameter(this, 'VSCodeInstanceRoleARN', {
      parameterName: '/vscode/vsiamrolearn',
      stringValue: vsCodeInstanceRole.getAtt('Arn').toString(),
      description: 'ARN of the VSCode Instance IAM Role',
    });
  }
}
