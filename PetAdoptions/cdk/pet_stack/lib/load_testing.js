"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadTesting = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const ecs = require("aws-cdk-lib/aws-ecs");
const ec2 = require("aws-cdk-lib/aws-ec2");
const iam = require("aws-cdk-lib/aws-iam");
class LoadTesting extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create a VPC
        const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });
        // Create an ECS cluster within the VPC
        const cluster = new ecs.Cluster(this, 'Cluster', {
            vpc,
            containerInsights: true,
        });
        // Define the ECS task definition
        const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition');
        // Add permissions to query SSM parameter
        taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ['*'],
            actions: [
                "ssm:GetParameters",
                "ssm:GetParameter",
                "ssm:DescribeParameters",
                "ssm:GetParametersByPath",
                "ssm:ListParameters",
            ]
        }));
        // Add a container to the task definition using your Docker image
        const container = taskDefinition.addContainer('Load_Test_Container', {
            image: ecs.ContainerImage.fromAsset('./lib/load_testing_app/app'),
            logging: new ecs.AwsLogDriver({ streamPrefix: 'LoadTesting' }),
        });
        // Configure container settings, environment variables, etc.
        container.addPortMappings({ containerPort: 80 });
        // Create an ECS service
        new ecs.FargateService(this, 'Load_Test_Service', {
            cluster,
            taskDefinition,
            desiredCount: 5,
        });
    }
}
exports.LoadTesting = LoadTesting;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZF90ZXN0aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibG9hZF90ZXN0aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUFnRDtBQUNoRCwyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBRTNDLDJDQUEyQztBQUkzQyxNQUFhLFdBQVksU0FBUSxtQkFBSztJQUNwQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGVBQWU7UUFDZixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELHVDQUF1QztRQUN2QyxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUMvQyxHQUFHO1lBQ0gsaUJBQWlCLEVBQUUsSUFBSTtTQUN4QixDQUFDLENBQUM7UUFFSCxpQ0FBaUM7UUFDakMsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFN0UseUNBQXlDO1FBQ3pDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDekQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7WUFDaEIsT0FBTyxFQUFFO2dCQUNDLG1CQUFtQjtnQkFDbkIsa0JBQWtCO2dCQUNsQix3QkFBd0I7Z0JBQ3hCLHlCQUF5QjtnQkFDekIsb0JBQW9CO2FBQ3ZCO1NBQ1IsQ0FBQyxDQUFDLENBQUM7UUFFSixpRUFBaUU7UUFDakUsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLFlBQVksQ0FBQyxxQkFBcUIsRUFBRTtZQUNuRSxLQUFLLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsNEJBQTRCLENBQUM7WUFDakUsT0FBTyxFQUFFLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsQ0FBQztTQUMvRCxDQUFDLENBQUM7UUFFSCw0REFBNEQ7UUFDNUQsU0FBUyxDQUFDLGVBQWUsQ0FBQyxFQUFFLGFBQWEsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpELHdCQUF3QjtRQUN4QixJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ2hELE9BQU87WUFDUCxjQUFjO1lBQ2QsWUFBWSxFQUFFLENBQUM7U0FDaEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBNUNELGtDQTRDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFN0YWNrLCBTdGFja1Byb3BzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgZWNyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3InO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliL2NvcmUnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cydcblxuZXhwb3J0IGNsYXNzIExvYWRUZXN0aW5nIGV4dGVuZHMgU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBhIFZQQ1xuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdWcGMnLCB7IG1heEF6czogMiB9KTsgXG4gICAgLy8gQ3JlYXRlIGFuIEVDUyBjbHVzdGVyIHdpdGhpbiB0aGUgVlBDXG4gICAgY29uc3QgY2x1c3RlciA9IG5ldyBlY3MuQ2x1c3Rlcih0aGlzLCAnQ2x1c3RlcicsIHtcbiAgICAgIHZwYyxcbiAgICAgIGNvbnRhaW5lckluc2lnaHRzOiB0cnVlLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIERlZmluZSB0aGUgRUNTIHRhc2sgZGVmaW5pdGlvblxuICAgIGNvbnN0IHRhc2tEZWZpbml0aW9uID0gbmV3IGVjcy5GYXJnYXRlVGFza0RlZmluaXRpb24odGhpcywgJ1Rhc2tEZWZpbml0aW9uJyk7XG5cbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgdG8gcXVlcnkgU1NNIHBhcmFtZXRlclxuICAgIHRhc2tEZWZpbml0aW9uLmFkZFRvVGFza1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcInNzbTpHZXRQYXJhbWV0ZXJzXCIsXG4gICAgICAgICAgICAgICAgXCJzc206R2V0UGFyYW1ldGVyXCIsXG4gICAgICAgICAgICAgICAgXCJzc206RGVzY3JpYmVQYXJhbWV0ZXJzXCIsIFxuICAgICAgICAgICAgICAgIFwic3NtOkdldFBhcmFtZXRlcnNCeVBhdGhcIixcbiAgICAgICAgICAgICAgICBcInNzbTpMaXN0UGFyYW1ldGVyc1wiLFxuICAgICAgICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEFkZCBhIGNvbnRhaW5lciB0byB0aGUgdGFzayBkZWZpbml0aW9uIHVzaW5nIHlvdXIgRG9ja2VyIGltYWdlXG4gICAgY29uc3QgY29udGFpbmVyID0gdGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKCdMb2FkX1Rlc3RfQ29udGFpbmVyJywge1xuICAgICAgaW1hZ2U6IGVjcy5Db250YWluZXJJbWFnZS5mcm9tQXNzZXQoJy4vbGliL2xvYWRfdGVzdGluZ19hcHAvYXBwJyksIFxuICAgICAgbG9nZ2luZzogbmV3IGVjcy5Bd3NMb2dEcml2ZXIoeyBzdHJlYW1QcmVmaXg6ICdMb2FkVGVzdGluZycgfSksXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ29uZmlndXJlIGNvbnRhaW5lciBzZXR0aW5ncywgZW52aXJvbm1lbnQgdmFyaWFibGVzLCBldGMuXG4gICAgY29udGFpbmVyLmFkZFBvcnRNYXBwaW5ncyh7IGNvbnRhaW5lclBvcnQ6IDgwIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGFuIEVDUyBzZXJ2aWNlXG4gICAgbmV3IGVjcy5GYXJnYXRlU2VydmljZSh0aGlzLCAnTG9hZF9UZXN0X1NlcnZpY2UnLCB7XG4gICAgICBjbHVzdGVyLFxuICAgICAgdGFza0RlZmluaXRpb24sXG4gICAgICBkZXNpcmVkQ291bnQ6IDUsIFxuICAgIH0pO1xuICB9XG59Il19