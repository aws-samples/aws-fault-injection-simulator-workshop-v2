import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
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
  }
}
