export interface DeploymentConfig {
  enableMultiRegion: boolean;
  enableNetworkPeering: boolean;
  enableS3Replication: boolean;
  enableRDSCrossRegion: boolean;
}

export function getDeploymentConfig(): DeploymentConfig {
  const enableMultiRegion = process.env.ENABLE_MULTI_REGION === 'true';
  
  return {
    enableMultiRegion,
    enableNetworkPeering: enableMultiRegion,
    enableS3Replication: enableMultiRegion,
    enableRDSCrossRegion: enableMultiRegion,
  };
}