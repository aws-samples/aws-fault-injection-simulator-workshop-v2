import { CfnJson, RemovalPolicy, Fn, Duration, Stack, StackProps, CfnOutput, aws_iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { ServiceStackProps } from './common/services-shared-properties';

export class FisLambdaActionsExperimentStack extends Stack {
    constructor(scope: Construct, id: string, props?: ServiceStackProps) {
        super(scope, id, props);

        // create CloudWatch Log Group for the FIS Experiments
        const fisCWLogGroup = new logs.LogGroup(this, 'FISExperimentsLambda', {
            logGroupName: "/aws/lambda/fis-lambda-experiment-logs",
            removalPolicy: RemovalPolicy.DESTROY, // Optional: Specify the removal policy
        });

        // create the S3 Bucket for the Lambda testing
        const fisLambdaExtensionConfigBucket = new Bucket(this, 'FisLambdaExtensionConfigBucket', {
            removalPolicy: RemovalPolicy.DESTROY, // Optional: Specify the removal policy
            encryption: BucketEncryption.S3_MANAGED, // Optional: Specify the encryption method
            versioned: true, // Optional: Enable versioning
            enforceSSL: true, // Optional: Enable SSL/TLS encryption
            blockPublicAccess: {
                blockPublicAcls: true,
                blockPublicPolicy: true,
                ignorePublicAcls: true,
                restrictPublicBuckets: true,
            }, // Optional: Block public access
        });

        // IAM policy for CloudWatch Logging
        const fisRoleCloudWatchPolicy = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "logs:CreateLogDelivery",
                "logs:PutResourcePolicy",
                "logs:DescribeResourcePolicies",
                "logs:DescribeLogGroups"
            ],
            resources: ["*"]
        });

        // IAM policies for FIS
        const fisS3Statement = new PolicyStatement({
            sid: "AllowWritingAndDeletingObjectFromConfigLocation",
            effect: Effect.ALLOW,
            actions: [
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            resources: [`${fisLambdaExtensionConfigBucket.bucketArn}`,
                `${fisLambdaExtensionConfigBucket.bucketArn}/*`,
            ],
        })
        const fisResourceTaggingPolicy = new PolicyStatement({
            sid: "AllowFisToDoTagLookups",
            effect: Effect.ALLOW,
            actions: [
                "tag:GetResources"
            ],
            resources: ["*"]
        });
        const fisLambdaPolicy = new PolicyStatement({
            sid: "AllowFisToInspectLambdaFunctions",
            effect: Effect.ALLOW,
            actions: [
                "lambda:GetFunction"
            ],
            resources: ["*"]
        });
        
        // Create IAM Role named "FisRoleForLambdaExperiments" with the above policies
        const fisRoleForLambdaExperiments = new aws_iam.Role(this, 'FisRoleForLambdaExperiments', {
            assumedBy: new aws_iam.ServicePrincipal('fis.amazonaws.com'),
        });
        fisRoleForLambdaExperiments.addToPolicy(fisS3Statement);
        fisRoleForLambdaExperiments.addToPolicy(fisRoleCloudWatchPolicy);
        fisRoleForLambdaExperiments.addToPolicy(fisResourceTaggingPolicy);
        fisRoleForLambdaExperiments.addToPolicy(fisLambdaPolicy);

        // Output for Lambda functions for FIS Lambda faults
        new CfnOutput(this, "fisLambdaExtensionConfigBucketARN", {
            value: fisLambdaExtensionConfigBucket.bucketArn,
            exportName: "fisLambdaExtensionConfigBucketARN"
        });
    }
}
