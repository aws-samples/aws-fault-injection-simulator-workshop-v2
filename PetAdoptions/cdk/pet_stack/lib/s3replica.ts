import { Construct } from 'constructs'
import { SSMParameterReader } from './common/ssm-parameter-reader';
import { Stack } from 'aws-cdk-lib';
import { S3ReplicaProps } from './common/services-shared-properties';
import * as s3 from 'aws-cdk-lib/aws-s3'
import { S3ReplicationSetup } from './common/s3_replication_enabler';


export class S3Replica extends Stack {
  constructor(scope: Construct, id: string, props: S3ReplicaProps) {
    super(scope, id, props);


    const ssmS3BucketMainARN = new SSMParameterReader(this, 'ssmS3BucketMainARN', {
      parameterName: "/petstore/s3bucketarn",
      region: props.MainRegion
    });
    const s3BucketMainARN = ssmS3BucketMainARN.getParameterValue();

    const ssmS3BucketSecondaryARN = new SSMParameterReader(this, 'ssmS3BucketSecondaryARN', {
      parameterName: "/petstore/s3bucketarn",
      region: props.SecondaryRegion
    });
    const s3BucketSecondaryARN = ssmS3BucketSecondaryARN.getParameterValue();


    const ssmExistingRoleArn = new SSMParameterReader(this, 'existingRoleArn', {
      parameterName: "/petstore/s3iamroleresplication",
      region: props.MainRegion
    });
    const existingRoleArn = ssmExistingRoleArn.getParameterValue();
    
  
    
    // In your stack definition
    new S3ReplicationSetup(this, 'S3Replication', {
      s3BucketARNPrimary: s3BucketMainARN,
      s3BucketARNSecondary: s3BucketSecondaryARN,
      s3ReplicationRoleARN: existingRoleArn
    });
    

  }
}

