import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { RUM } from './modules/rum';
import * as fs from 'fs';
import { CustomCanary } from './modules/canary';
import { Alarm, ComparisonOperator, TreatMissingData, Metric } from 'aws-cdk-lib/aws-cloudwatch'
import { Alias } from 'aws-cdk-lib/aws-kms';


export class CustomizationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const petSiteUrl = ssm.StringParameter.fromStringParameterAttributes(this, 'getParamPetSiteUrl', { parameterName: "/petstore/petsiteurl"}).stringValue;
    const domain = petSiteUrl.replace(/^https?:\/\//, '');
    console.log(domain);

    if (!domain) {
      throw new Error('domain is required');
    }

    var rum = new RUM(this, 'RUM', {
      name: 'Petsite',
      domain: domain
    });

    // Iterate over all the subfolders under canaries
    for (const dir of fs.readdirSync(__dirname + '/canaries/')) {
      var customCanary = new CustomCanary(this, dir, {
        script_path: __dirname + '/canaries/' + dir + '/index.js',
        URL: "http://" + domain,
        name: dir,
        RUMName: rum.appMonitor.name
      });

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