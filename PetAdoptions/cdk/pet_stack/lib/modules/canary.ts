import { Construct } from 'constructs'
import { Canary, Schedule, Test, Code, Runtime, CfnCanary } from 'aws-cdk-lib/aws-synthetics'
import { Duration, Tags } from 'aws-cdk-lib'
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch'

import * as path from 'path'
import * as fs from 'fs'
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam'

export interface CustomCanaryProps {
    name: string
    script_path: string,
    URL: string,
    RUMName: string
}

export class CustomCanary extends Construct {
    constructor(scope: Construct, id: string, props: CustomCanaryProps) {
        super(scope, id)

        if (path.parse(props.script_path).ext !== '.js') {
            throw new Error('Script path must be a javascript file')
        }

        // Overwrite default parameters for Canary by using values into a json file into the folder
        let confDefault = {
            duration: 5,
            name: props.name,
            alerting: true
        }
        let confCanary  = confDefault

        if (fs.existsSync(path.parse(props.script_path).dir + '/conf.json')) {
            let confCustom = JSON.parse(fs.readFileSync(path.parse(props.script_path).dir + '/conf.json', 'utf8'));
            confCanary = Object.assign({}, confDefault, confCustom);
        }
        else {
            confCanary = confDefault
        }

        const canary_script = fs.readFileSync(props.script_path, 'utf8')

        const canary = new Canary(this, 'Canary' + props.name, {
            schedule: Schedule.rate(Duration.minutes(confCanary.duration)),
            test: Test.custom({
              code: Code.fromInline(canary_script),
              handler: 'index.handler',
            }),
            runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_0,
            canaryName: confCanary.name,
            
        });

        // Enable X-Ray
        const cfnCanary = canary.node.defaultChild as CfnCanary;
        cfnCanary.runConfig = {
            activeTracing: true,
            timeoutInSeconds: confCanary.duration*60,
            environmentVariables: {
                URL: props.URL,
            }
        };
        
        canary.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));

        // check if props.name is different from unreliable_api
        if (confCanary.alerting == true) {
            Tags.of(canary).add(props.RUMName, '');

            const alarm = new Alarm(this, 'Alarm' + props.name, {
                metric: canary.metricSuccessPercent(),
                threshold: 95,
                evaluationPeriods: 1,
                treatMissingData: TreatMissingData.BREACHING,
                comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD
            });

            Tags.of(alarm).add(props.RUMName, '');
        }
    }
}