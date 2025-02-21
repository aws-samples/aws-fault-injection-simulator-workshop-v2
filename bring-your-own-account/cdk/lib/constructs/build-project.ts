import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface BuildProjectProps {
  assetBucket: s3.IBucket;
  environmentVariables?: { [key: string]: codebuild.BuildEnvironmentVariable };
}

export class BuildProject extends Construct {
  public readonly project: codebuild.Project;

  constructor(scope: Construct, id: string, props: BuildProjectProps) {
    super(scope, id);

    this.project = new codebuild.Project(this, 'BuildProject', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      source: codebuild.Source.s3({
        bucket: props.assetBucket,
        path: 'assets/build.zip'
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true,
        environmentVariables: {
          AWS_DEFAULT_REGION: { value: cdk.Stack.of(this).region },
          ASSET_BUCKET: { value: props.assetBucket.bucketName },
          ...props.environmentVariables
        }
      },
      artifacts: codebuild.Artifacts.s3({
        bucket: props.assetBucket,
        path: 'build-output',
        includeBuildId: true
      })
    });

    // Add permissions
    this.addPermissions();
  }

  private addPermissions() {
    this.project.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudformation:*',
        's3:*',
        'iam:*',
        'ec2:*',
        'dynamodb:*',
        'lambda:*',
        'apigateway:*',
        'cloudwatch:*',
        'logs:*',
        'eks:*',
        'sts:AssumeRole'
      ],
      resources: ['*']
    }));
  }
}
