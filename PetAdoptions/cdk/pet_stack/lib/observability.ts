import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { RUM } from './modules/rum';
import * as fs from 'fs';
import { Alarm, ComparisonOperator, TreatMissingData, Metric } from 'aws-cdk-lib/aws-cloudwatch'
import { Alias } from 'aws-cdk-lib/aws-kms';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';

export class Observability extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const fisLogGroup = new logs.LogGroup(this, 'FISLogGroup', {
      logGroupName: 'FISExperiments',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    
    const petSiteUrl = ssm.StringParameter.valueFromLookup(this, '/petstore/petsiteurl');
    //const domain: string = ssm.StringParameter.fromStringParameterAttributes(this, 'getParamPetSiteDomain', { parameterName: "/petstore/petsitedomain"}).stringValue;
    const domain = (petSiteUrl.replace(/^https?:\/\//, '')).toLowerCase()
    
    if (!domain) {
      throw new Error('domain is required');
    }

    var rum = new RUM(this, 'RUM', {
      name: 'Petsite',
      domain: domain
    });

    const putParameter = new cr.AwsCustomResource(this, '/petstore/rumscript', {
      onCreate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: '/petstore/rumscript',
          Value: rum.htmlScript,
          Overwrite: true
        },
        physicalResourceId: cr.PhysicalResourceId.of('/petstore/rumscript'),
      },
      onUpdate: {        
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: '/petstore/rumscript',
          Value: rum.htmlScript,
          Overwrite: true
        },
        physicalResourceId: cr.PhysicalResourceId.of('/petstore/rumscript'),
      },
      onDelete: {
          service: 'SSM',
          action: 'putParameter',
          parameters: {
            Name: '/petstore/rumscript',
            Value: ' ',
            Overwrite: true
        },
        physicalResourceId: cr.PhysicalResourceId.of('/petstore/rumscript'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    })
    
    // Fix IAM eventual consistency - ensure role is created before Lambda
    const role = putParameter.node.findChild('CustomResourcePolicy').node.defaultChild;
    const lambda = putParameter.node.findChild('Resource').node.defaultChild;
    if (role && lambda) {
      lambda.node.addDependency(role);
    }


    // Alarm for Frustrating navigation experience
    const navigationFrustratedMetric = new Metric({
      namespace: 'AWS/RUM',
      metricName: 'NavigationFrustratedTransaction',
      dimensionsMap: {
        application_name: rum.appMonitor.name
      },
      statistic: 'sum',
      period: cdk.Duration.minutes(15)
    });
    
    const alarm = new Alarm(this, 'AlarmFrustratingNavigation', {
      metric: navigationFrustratedMetric,
      threshold: 3,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName: 'petsite-frustrating-ux'
    });

    cdk.Tags.of(alarm).add('Name', rum.appMonitor.name);

    // Alarm for Javascript error
    const javascriptMetric = new Metric({
      namespace: 'AWS/RUM',
      metricName: 'JsErrorCount',
      dimensionsMap: {
        application_name: rum.appMonitor.name
      },
      statistic: 'sum',
      period: cdk.Duration.minutes(15)
    });
    
    const jsAlarm = new Alarm(this, 'AlarmRandomJSError', {
      metric: javascriptMetric,
      threshold: 0,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName: 'random-js-error'
    })
  }
}