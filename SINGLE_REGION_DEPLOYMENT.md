# Single Region Deployment Configuration

## Overview
The workshop now supports both single-region and multi-region deployments through environment variable configuration. All multi-region code is preserved but conditionally executed.

## Configuration

### Single Region Deployment (Default)
```bash
# No environment variables needed - single region is default
cdk deploy Services
cdk deploy Applications
# ... other single-region stacks
```

### Multi Region Deployment
```bash
export ENABLE_MULTI_REGION=true
cdk deploy Services
cdk deploy ServicesSecondary
cdk deploy NetworkRegionPeering
# ... all stacks deploy
```

## What Changes in Single Region Mode

### Disabled Features
- **Network Peering**: No Transit Gateway peering between regions
- **S3 Replication**: S3 buckets created without cross-region replication
- **RDS Cross-Region**: No cross-region read replicas
- **Secondary Region Stacks**: All `*Secondary` stacks are skipped

### Preserved Features
- **DynamoDB Global Tables**: Still deployed (as requested)
- **All Code**: Multi-region logic preserved, just conditionally executed
- **IAM Consistency**: All IAM role waiters remain active

## Implementation Details

### Configuration System
- **`deployment-config.ts`**: Centralized configuration based on `ENABLE_MULTI_REGION` env var
- **Conditional Logic**: Uses `if` statements to wrap multi-region features
- **Code Preservation**: Original code commented out, not deleted

### Modified Files
1. **`services.ts`**: Conditional RDS replicas, S3 replication, TGW creation
2. **`pet_stack.ts`**: Conditional secondary region stack deployment  
3. **`services-shared.ts`**: Conditional security group rules for RDS
4. **`fis-workshop-stack.ts`**: Commented out multi-region deployment commands

### Benefits
- **Faster Deployment**: ~50% fewer stacks in single region
- **Lower Costs**: No cross-region resources or data transfer
- **Simpler Dependencies**: No cross-region SSM parameter dependencies
- **Easy Toggle**: Set environment variable to enable multi-region

### Usage Examples

**Single Region (Default)**:
```bash
cd PetAdoptions/cdk/pet_stack/
npm install && npm run build
cdk deploy Services
cdk deploy Applications
cdk deploy FisServerless
cdk deploy Observability
cdk deploy UserSimulationStack
cdk deploy ObservabilityDashboard
```

**Multi Region**:
```bash
export ENABLE_MULTI_REGION=true
cd PetAdoptions/cdk/pet_stack/
npm install && npm run build
cdk deploy Services
cdk deploy ServicesSecondary
cdk deploy NetworkRegionPeering
cdk deploy NetworkRoutesMain
cdk deploy NetworkRoutesSecondary
cdk deploy S3Replica
cdk deploy Applications
cdk deploy ApplicationsSecondary
# ... continue with all stacks
```

## Troubleshooting

### If Multi-Region Features Don't Work
1. Verify `ENABLE_MULTI_REGION=true` is set
2. Check that secondary region stacks are being synthesized: `cdk ls`
3. Ensure AWS credentials work in both regions

### If Single-Region Deployment Fails
1. Verify no multi-region environment variables are set
2. Check that only primary region stacks are synthesized: `cdk ls`
3. Confirm Transit Gateway resources aren't being created unnecessarily

This approach maintains full backward compatibility while providing a clean single-region deployment option.