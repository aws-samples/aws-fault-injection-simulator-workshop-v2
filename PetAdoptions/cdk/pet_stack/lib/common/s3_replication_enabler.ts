import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface S3ReplicationSetupProps {
  s3BucketARNPrimary: string;
  s3BucketARNSecondary: string;
  s3ReplicationRoleARN: string;
}

export class S3ReplicationSetup extends Construct {
  constructor(scope: Construct, id: string, props: S3ReplicationSetupProps) {
    super(scope, id);

    const { s3BucketARNPrimary, s3BucketARNSecondary, s3ReplicationRoleARN } = props;

    // Create the Lambda function
    const lambdaFunction = new lambda.Function(this, 'S3ReplicationSetupFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(15),
      code: lambda.Code.fromAsset('lib/lambda/s3replication'),
      environment: {
        PYTHONPATH: '/var/task/lib'
      }
    });

    // Grant the Lambda function permissions to manage S3 replication
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          's3:GetReplicationConfiguration',
          's3:PutReplicationConfiguration'
        ],
        resources: [s3BucketARNPrimary, s3BucketARNSecondary]
      })
    );

    // Grant Pass Role
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'iam:PassRole'
        ],
        resources: ["*"]
      })
    );

    // Create the custom resource
    const s3ReplicationResource = new cr.AwsCustomResource(this, 'S3ReplicationSetupResource', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: lambdaFunction.functionName,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            s3BucketARNPrimary,
            s3BucketARNSecondary,
            s3ReplicationRoleARN
          })
        },
        physicalResourceId: cr.PhysicalResourceId.of('S3ReplicationSetup')
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["lambda:InvokeFunction"],
          resources: [lambdaFunction.functionArn],
        }),
      ])
    });
    
    // Fix IAM eventual consistency - ensure role is created before Lambda
    const role = s3ReplicationResource.node.findChild('CustomResourcePolicy').node.defaultChild;
    const lambda = s3ReplicationResource.node.findChild('Resource').node.defaultChild;
    if (role && lambda) {
      lambda.node.addDependency(role);
    }
  }
}
