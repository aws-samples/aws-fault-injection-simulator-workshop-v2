import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as loadbalancing from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import fs = require('fs');
import * as cloudwatch  from 'aws-cdk-lib/aws-cloudwatch';
import * as cwactions   from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as mustache  from 'mustache';

export class FisStackAsg extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const vpc = ec2.Vpc.fromLookup(this, 'Petsite-Vpc', { 
      vpcName: 'Services/Microservices'
    });

    const asg = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      //vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }),
      minCapacity: 1,
      desiredCapacity: 1,
      maxCapacity: 9,
      groupMetrics: [autoscaling.GroupMetrics.all()],
    })

    asg.addUserData(fs.readFileSync('scripts/install.sh', 'utf8'))
    
    

        const myAsgCpuMetric = new cloudwatch.Metric({
      namespace: 'AWS/EC2',
      metricName: 'CPUUtilization',
      dimensionsMap: { 
        'AutoScalingGroupName': asg.autoScalingGroupName
      },
      period: cdk.Duration.minutes(1) 
    });

    const myAsgCpuAlarmHigh = new cloudwatch.Alarm(this, 'FisAsgHighCpuAlarm', {
      metric: myAsgCpuMetric,
      threshold: 90.0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      // datapointsToAlarm: 1,
    });

    const myAsgCpuAlarmLow = new cloudwatch.Alarm(this, 'FisAsgLowCpuAlarm', {
      metric: myAsgCpuMetric,
      threshold: 20.0,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 3,
      // datapointsToAlarm: 2,
    });

    const myAsgManualScalingActionUp = new autoscaling.StepScalingAction(this,"ScaleUp", {
      autoScalingGroup: asg,
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      // cooldown: cdk.Duration.minutes(1)
    });
    myAsgManualScalingActionUp.addAdjustment({
      adjustment: 1,
      lowerBound: 0,
      // upperBound: 100
    });
    myAsgCpuAlarmHigh.addAlarmAction(new cwactions.AutoScalingAction(myAsgManualScalingActionUp))

    const myAsgManualScalingActionDown = new autoscaling.StepScalingAction(this,"ScaleDown", {
      autoScalingGroup: asg,
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      // cooldown: cdk.Duration.minutes(1)
    });
    myAsgManualScalingActionDown.addAdjustment({
      adjustment: -1,
      upperBound: 0,
      // lowerBound: -100
    });
    myAsgCpuAlarmLow.addAlarmAction(new cwactions.AutoScalingAction(myAsgManualScalingActionDown))



    const alb = new loadbalancing.ApplicationLoadBalancer(this, 'MyALB', {
      vpc: vpc,
      internetFacing: true
    })

    const listener = alb.addListener('HttpListener', {
      port: 80
    })

    const tg1 = new loadbalancing.ApplicationTargetGroup(this, 'FisAsgTargetGroup', {
      targetType: loadbalancing.TargetType.INSTANCE,
      port: 80,
      targets: [asg],
      vpc,
      healthCheck: {
        healthyHttpCodes: '200-299',
        healthyThresholdCount: 2,
        interval: Duration.seconds(20),
        timeout: Duration.seconds(15),
        unhealthyThresholdCount: 10,
        path: '/'
      }
    });

    listener.addTargetGroups('FisTargetGroup',{
      targetGroups: [tg1],
    });

    listener.connections.allowDefaultPortFromAnyIpv4('Allow access to port 80 from the internet.')

    new CfnOutput(this, 'Intro-Experiment-Hostname', { value: alb.loadBalancerDnsName })

       // Getting AZs from LB because ASG construct doesn't seem to expose them
       const fisAzs = alb.vpc?.availabilityZones || [ 'none', 'none' ];
    
       const outputFisAz1 = new cdk.CfnOutput(this, 'FisAlbAz1', {value: fisAzs[0] });
       const outputFisAz2 = new cdk.CfnOutput(this, 'FisAlbAz2', {value: fisAzs[1] });
   
       const manualDashboard = new cdk.CfnResource(this, 'AsgDashboardEscapeHatch', {
        type: 'AWS::CloudWatch::Dashboard',
        properties: {
          DashboardName: 'FisASG-Dashboard-'+this.region,
          DashboardBody: mustache.render(fs.readFileSync('scripts/dashboard.json', 'utf8'),{
            region: this.region,
            asgName: asg.autoScalingGroupName,
            lbName: alb.loadBalancerFullName,
            targetgroupName: tg1.targetGroupFullName,
            az1: fisAzs[0],
            az2: fisAzs[1],
          })
        }
      });
    // example resource
    // const queue = new sqs.Queue(this, 'CdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
