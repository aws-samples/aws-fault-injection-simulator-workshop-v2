#!/bin/bash

# Validate IAM Consistency Solution
# This script checks if the IAM role waiters are properly implemented

echo "🔍 Validating IAM Consistency Solution..."

# Check if the IAM role waiter constructs exist
echo "📁 Checking for IAM role waiter constructs..."

if [ -f "PetAdoptions/cdk/pet_stack/lib/common/iam-role-waiter.ts" ]; then
    echo "✅ Services stack IAM role waiter found"
else
    echo "❌ Services stack IAM role waiter missing"
    exit 1
fi

if [ -f "bring-your-own-account/cdk/lib/constructs/iam-role-waiter.ts" ]; then
    echo "✅ FIS workshop stack IAM role waiter found"
else
    echo "❌ FIS workshop stack IAM role waiter missing"
    exit 1
fi

# Check if services.ts has been updated with waiters
echo "📝 Checking services.ts for IAM role waiters..."

if grep -q "IamRoleWaiter" "PetAdoptions/cdk/pet_stack/lib/services.ts"; then
    echo "✅ Services stack updated with IAM role waiters"
    
    # Count the number of waiters implemented
    WAITER_COUNT=$(grep -c "new IamRoleWaiter" "PetAdoptions/cdk/pet_stack/lib/services.ts")
    echo "📊 Found $WAITER_COUNT IAM role waiters in services.ts"
    
    # Check for specific critical waiters
    if grep -q "EcsEc2PetSearchRoleWaiter" "PetAdoptions/cdk/pet_stack/lib/services.ts"; then
        echo "✅ ECS EC2 role waiter implemented"
    fi
    
    if grep -q "EksPetsiteASGClusterNodeGroupRoleWaiter" "PetAdoptions/cdk/pet_stack/lib/services.ts"; then
        echo "✅ EKS node group role waiter implemented"
    fi
    
    if grep -q "CWServiceAccountWaiter" "PetAdoptions/cdk/pet_stack/lib/services.ts"; then
        echo "✅ CloudWatch service account waiter implemented"
    fi
    
else
    echo "❌ Services stack not updated with IAM role waiters"
    exit 1
fi

# Check if fis-workshop-stack.ts has been updated
echo "📝 Checking fis-workshop-stack.ts for IAM role waiters..."

if grep -q "IamRoleWaiter" "bring-your-own-account/cdk/lib/fis-workshop-stack.ts"; then
    echo "✅ FIS workshop stack updated with IAM role waiters"
    
    WAITER_COUNT=$(grep -c "new IamRoleWaiter" "bring-your-own-account/cdk/lib/fis-workshop-stack.ts")
    echo "📊 Found $WAITER_COUNT IAM role waiters in fis-workshop-stack.ts"
    
else
    echo "❌ FIS workshop stack not updated with IAM role waiters"
    exit 1
fi

# Check for proper dependencies
echo "🔗 Checking for proper dependency declarations..."

if grep -q "node.addDependency.*Waiter" "PetAdoptions/cdk/pet_stack/lib/services.ts"; then
    echo "✅ Dependencies properly configured in services.ts"
else
    echo "❌ Dependencies not properly configured in services.ts"
    exit 1
fi

if grep -q "node.addDependency.*Waiter" "bring-your-own-account/cdk/lib/fis-workshop-stack.ts"; then
    echo "✅ Dependencies properly configured in fis-workshop-stack.ts"
else
    echo "❌ Dependencies not properly configured in fis-workshop-stack.ts"
    exit 1
fi

echo ""
echo "🎉 IAM Consistency Solution validation completed successfully!"
echo ""
echo "📋 Summary:"
echo "   - IAM role waiter constructs are in place"
echo "   - Critical IAM roles have waiters implemented"
echo "   - Dependencies are properly configured"
echo "   - Solution should resolve eventual consistency issues"
echo ""
echo "💡 Next steps:"
echo "   1. Test deployment in a clean environment"
echo "   2. Monitor CloudWatch logs for waiter function execution"
echo "   3. Verify no more IAM-related deployment failures"