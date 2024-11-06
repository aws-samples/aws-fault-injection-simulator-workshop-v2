import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejslambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs'
import { TargetTag } from '../common/services-shared-properties';
import { Tags } from 'aws-cdk-lib';

export interface StatusUpdaterServiceProps {
  region: string,
  tableName: string,
  fisResourceTag: TargetTag
}

export class StatusUpdaterService extends Construct {

  public api: apigw.RestApi

  constructor(scope: Construct, id: string, props: StatusUpdaterServiceProps) {
    super(scope, id);

    var lambdaRole = new iam.Role(this, 'lambdaexecutionrole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
          iam.ManagedPolicy.fromManagedPolicyArn(this, 'first', 'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'),
          iam.ManagedPolicy.fromManagedPolicyArn(this, 'second', 'arn:aws:iam::aws:policy/AWSLambda_FullAccess'),
          iam.ManagedPolicy.fromManagedPolicyArn(this, 'fifth', 'arn:aws:iam::aws:policy/CloudWatchLambdaInsightsExecutionRolePolicy'),
          iam.ManagedPolicy.fromManagedPolicyArn(this, 'lambdaBasicExecRole', 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    
    var layerArn = "arn:aws:lambda:"+ props.region +":580247275435:layer:LambdaInsightsExtension:21";
    var layer = lambda.LayerVersion.fromLayerVersionArn(this, `LayerFromArn`, layerArn);

    const lambdaFunction = new nodejslambda.NodejsFunction(this, 'lambdafn', {
        runtime: lambda.Runtime.NODEJS_20_X,    // execution environment
        entry: '../../petstatusupdater/index.js',
        depsLockFilePath: '../../petstatusupdater/package-lock.json',
        handler: 'handler',
        memorySize: 128,
        tracing: lambda.Tracing.ACTIVE,
        role: lambdaRole,
        layers: [layer],
        description: 'Update Pet availability status',
        environment: {
            "TABLE_NAME": props.tableName
        },
        bundling: {
          externalModules: [
            '@aws-sdk/client-dynamodb',
            '@aws-sdk/lib-dynamodb',
            'aws-xray-sdk-core'
          ],
          nodeModules: [
             '@aws-sdk/client-dynamodb',
            '@aws-sdk/lib-dynamodb',
            'aws-xray-sdk-core'
          ]
        }        
    });

    Tags.of(lambdaFunction).add(props.fisResourceTag.TagName,props.fisResourceTag.TagValue )

    //defines an API Gateway REST API resource backed by our "petstatusupdater" function.
    this.api = new apigw.LambdaRestApi(this, 'PetAdoptionStatusUpdater', {
        handler: lambdaFunction,
        proxy: true,
        endpointConfiguration: {
            types: [apigw.EndpointType.REGIONAL]
        }, deployOptions: {
            tracingEnabled: true,
            loggingLevel:apigw.MethodLoggingLevel.INFO,
            stageName: 'prod'
        }, defaultMethodOptions: {methodResponses: [] }
        //defaultIntegration: new apigw.Integration({ integrationHttpMethod: 'PUT', type: apigw.IntegrationType.AWS })
    });
  }
}