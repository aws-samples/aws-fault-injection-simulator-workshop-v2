import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as loadbalancing from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import fs = require('fs');

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const vpc = ec2.Vpc.fromLookup(this, 'Petsite-Vpc', { 
      vpcName: 'Services/Microservices'
    });

    const asg = new autoscaling.AutoScalingGroup(this, 'MyASG', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }),
      minCapacity: 2,
      desiredCapacity: 1,
      maxCapacity: 9,
    })

    asg.addUserData(fs.readFileSync('scripts/install.sh', 'utf8'))

    const alb = new loadbalancing.ApplicationLoadBalancer(this, 'MyALB', {
      vpc: vpc,
      internetFacing: true
    })

    const listener = alb.addListener('HttpListener', {
      port: 80
    })

    listener.addTargets('Targets', {
      port: 80,
      targets: [asg]
    })

    listener.connections.allowDefaultPortFromAnyIpv4('Allow access to port 80 from the internet.')

    new CfnOutput(this, 'Intro-Experiment-Hostname', { value: alb.loadBalancerDnsName })

    // example resource
    // const queue = new sqs.Queue(this, 'CdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
