# Troubleshooting IAM Consistency Issues

## Quick Diagnosis

If you're still experiencing IAM-related deployment failures after implementing the solution, follow these steps:

### 1. Check CloudWatch Logs

Look for the IAM role waiter Lambda function logs:
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/" | grep -i waiter
```

### 2. Common Error Patterns

**Error**: `InvalidUserID.NotFound` or `The role defined for the function cannot be assumed by Lambda`
- **Cause**: IAM role not yet propagated
- **Solution**: Waiter should handle this automatically; check waiter logs

**Error**: `AccessDenied` when assuming role
- **Cause**: Trust policy or permissions issue
- **Solution**: Verify role trust policy allows the service principal

### 3. Verify Waiter Configuration

Check that waiters are properly configured:
```typescript
// Correct implementation
const roleWaiter = new IamRoleWaiter(this, 'MyRoleWaiter', {
    role: myRole,
});

// Ensure dependency is added
myResource.node.addDependency(roleWaiter);
```

### 4. Manual Testing

Test role assumption manually:
```bash
aws sts assume-role --role-arn "arn:aws:iam::ACCOUNT:role/ROLE_NAME" --role-session-name "test-session"
```

### 5. Increase Waiter Timeout

For persistent issues, increase the timeout:
```typescript
const roleWaiter = new IamRoleWaiter(this, 'MyRoleWaiter', {
    role: myRole,
    timeout: Duration.minutes(10), // Increased from default 5 minutes
});
```

### 6. Check for Missing Waiters

Ensure all critical roles have waiters:
- Roles used in EC2 launch templates
- Roles used in EKS node groups  
- Roles used in Kubernetes service accounts
- Roles used immediately after creation

### 7. Regional Considerations

IAM is a global service, but propagation can vary by region. Consider:
- Using longer timeouts for cross-region deployments
- Testing in the same region first

### 8. Alternative Solutions

If waiters don't resolve the issue:

**Option 1: Add explicit delays**
```typescript
// Not recommended, but can be used as last resort
const delay = new cdk.CustomResource(this, 'Delay', {
    serviceToken: delayProvider.serviceToken,
    properties: { DelaySeconds: '60' }
});
```

**Option 2: Use existing roles**
```typescript
// Reference existing role instead of creating new one
const existingRole = iam.Role.fromRoleArn(this, 'ExistingRole', roleArn);
```

### 9. Monitoring

Set up CloudWatch alarms for waiter failures:
```typescript
const waiterAlarm = new cloudwatch.Alarm(this, 'WaiterFailureAlarm', {
    metric: waiterFunction.metricErrors(),
    threshold: 1,
    evaluationPeriods: 1,
});
```

### 10. Best Practices

- Always add dependencies when using waiters
- Use descriptive names for waiter constructs
- Monitor waiter execution times
- Test in clean environments regularly
- Keep waiter timeouts reasonable (5-10 minutes max)

## Getting Help

If issues persist:
1. Check AWS CloudFormation events for detailed error messages
2. Review CDK synthesis output for missing dependencies
3. Verify IAM permissions for the deployment role
4. Consider opening an AWS support case for persistent IAM propagation issues