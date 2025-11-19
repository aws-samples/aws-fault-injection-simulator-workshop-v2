import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface IamRoleWaiterProps {
  role: iam.IRole;
  timeout?: cdk.Duration;
}

export class IamRoleWaiter extends Construct {
  public readonly customResource: cdk.CustomResource;

  constructor(scope: Construct, id: string, props: IamRoleWaiterProps) {
    super(scope, id);

    const waiterFunction = new lambda.Function(this, 'WaiterFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      timeout: props.timeout || cdk.Duration.minutes(5),
      code: lambda.Code.fromInline(`
import boto3
import json
import time
import cfnresponse

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    if event['RequestType'] == 'Delete':
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
        return
    
    role_arn = event['ResourceProperties']['RoleArn']
    max_attempts = int(event['ResourceProperties'].get('MaxAttempts', '30'))
    delay_seconds = int(event['ResourceProperties'].get('DelaySeconds', '10'))
    
    sts = boto3.client('sts')
    
    for attempt in range(max_attempts):
        try:
            print(f"Attempt {attempt + 1}/{max_attempts}: Testing role {role_arn}")
            
            # Try to assume the role to verify it's propagated
            response = sts.assume_role(
                RoleArn=role_arn,
                RoleSessionName='iam-consistency-check'
            )
            
            print(f"Successfully assumed role on attempt {attempt + 1}")
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {
                'RoleArn': role_arn,
                'AttemptsRequired': attempt + 1
            })
            return
            
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_attempts - 1:
                time.sleep(delay_seconds)
            else:
                print(f"All {max_attempts} attempts failed")
                cfnresponse.send(event, context, cfnresponse.FAILED, {}, str(e))
                return
`),
    });

    waiterFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: [props.role.roleArn],
    }));

    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: waiterFunction,
    });

    this.customResource = new cdk.CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        RoleArn: props.role.roleArn,
        MaxAttempts: '30',
        DelaySeconds: '10',
      },
    });

    this.customResource.node.addDependency(props.role);
  }
}