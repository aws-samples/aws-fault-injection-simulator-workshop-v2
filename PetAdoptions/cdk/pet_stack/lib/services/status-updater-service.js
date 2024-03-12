"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusUpdaterService = void 0;
const iam = require("aws-cdk-lib/aws-iam");
const lambda = require("aws-cdk-lib/aws-lambda");
const nodejslambda = require("aws-cdk-lib/aws-lambda-nodejs");
const apigw = require("aws-cdk-lib/aws-apigateway");
const constructs_1 = require("constructs");
class StatusUpdaterService extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        var lambdaRole = new iam.Role(this, 'lambdaexecutionrole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'first', 'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'second', 'arn:aws:iam::aws:policy/AWSLambda_FullAccess'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'fifth', 'arn:aws:iam::aws:policy/CloudWatchLambdaInsightsExecutionRolePolicy'),
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'lambdaBasicExecRole', 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        var layerArn = "arn:aws:lambda:" + process.env.CDK_DEFAULT_REGION + ":580247275435:layer:LambdaInsightsExtension:21";
        var layer = lambda.LayerVersion.fromLayerVersionArn(this, `LayerFromArn`, layerArn);
        const lambdaFunction = new nodejslambda.NodejsFunction(this, 'lambdafn', {
            runtime: lambda.Runtime.NODEJS_16_X, // execution environment
            entry: '../../petstatusupdater/index.js',
            depsLockFilePath: '../../petstatusupdater/package-lock.json',
            handler: 'handler',
            memorySize: 128,
            tracing: lambda.Tracing.ACTIVE,
            role: lambdaRole,
            layers: [layer],
            description: 'Update Pet availability status',
            environment: {
                "TABLE_NAME": props.tableName
            },
            bundling: {
                externalModules: [
                    'aws-sdk'
                ],
                nodeModules: [
                    'aws-xray-sdk'
                ]
            }
        });
        //defines an API Gateway REST API resource backed by our "petstatusupdater" function.
        this.api = new apigw.LambdaRestApi(this, 'PetAdoptionStatusUpdater', {
            handler: lambdaFunction,
            proxy: true,
            endpointConfiguration: {
                types: [apigw.EndpointType.REGIONAL]
            }, deployOptions: {
                tracingEnabled: true,
                loggingLevel: apigw.MethodLoggingLevel.INFO,
                stageName: 'prod'
            }, defaultMethodOptions: { methodResponses: [] }
            //defaultIntegration: new apigw.Integration({ integrationHttpMethod: 'PUT', type: apigw.IntegrationType.AWS })
        });
    }
}
exports.StatusUpdaterService = StatusUpdaterService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHVzLXVwZGF0ZXItc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0YXR1cy11cGRhdGVyLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkNBQTJDO0FBQzNDLGlEQUFpRDtBQUNqRCw4REFBOEQ7QUFDOUQsb0RBQW9EO0FBQ3BELDJDQUFzQztBQU10QyxNQUFhLG9CQUFxQixTQUFRLHNCQUFTO0lBSWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ3pELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztZQUMzRCxlQUFlLEVBQUU7Z0JBQ2IsR0FBRyxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLGtEQUFrRCxDQUFDO2dCQUN6RyxHQUFHLENBQUMsYUFBYSxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsOENBQThDLENBQUM7Z0JBQ3RHLEdBQUcsQ0FBQyxhQUFhLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxxRUFBcUUsQ0FBQztnQkFDNUgsR0FBRyxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUUsa0VBQWtFLENBQUM7YUFDMUk7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLFFBQVEsR0FBRyxpQkFBaUIsR0FBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixHQUFFLGdEQUFnRCxDQUFDO1FBQ25ILElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUVwRixNQUFNLGNBQWMsR0FBRyxJQUFJLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNyRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUssd0JBQXdCO1lBQ2hFLEtBQUssRUFBRSxpQ0FBaUM7WUFDeEMsZ0JBQWdCLEVBQUUsMENBQTBDO1lBQzVELE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUM5QixJQUFJLEVBQUUsVUFBVTtZQUNoQixNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUM7WUFDZixXQUFXLEVBQUUsZ0NBQWdDO1lBQzdDLFdBQVcsRUFBRTtnQkFDVCxZQUFZLEVBQUUsS0FBSyxDQUFDLFNBQVM7YUFDaEM7WUFDRCxRQUFRLEVBQUU7Z0JBQ1IsZUFBZSxFQUFFO29CQUNmLFNBQVM7aUJBQ1Y7Z0JBQ0QsV0FBVyxFQUFFO29CQUNWLGNBQWM7aUJBQ2hCO2FBQ0Y7U0FDSixDQUFDLENBQUM7UUFFSCxxRkFBcUY7UUFDckYsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2pFLE9BQU8sRUFBRSxjQUFjO1lBQ3ZCLEtBQUssRUFBRSxJQUFJO1lBQ1gscUJBQXFCLEVBQUU7Z0JBQ25CLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO2FBQ3ZDLEVBQUUsYUFBYSxFQUFFO2dCQUNkLGNBQWMsRUFBRSxJQUFJO2dCQUNwQixZQUFZLEVBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUk7Z0JBQzFDLFNBQVMsRUFBRSxNQUFNO2FBQ3BCLEVBQUUsb0JBQW9CLEVBQUUsRUFBQyxlQUFlLEVBQUUsRUFBRSxFQUFFO1lBQy9DLDhHQUE4RztTQUNqSCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6REQsb0RBeURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgbm9kZWpzbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCAqIGFzIGFwaWd3IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnXG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RhdHVzVXBkYXRlclNlcnZpY2VQcm9wcyB7XG4gIHRhYmxlTmFtZTogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBTdGF0dXNVcGRhdGVyU2VydmljZSBleHRlbmRzIENvbnN0cnVjdCB7XG5cbiAgcHVibGljIGFwaTogYXBpZ3cuUmVzdEFwaVxuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdGF0dXNVcGRhdGVyU2VydmljZVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIHZhciBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdsYW1iZGFleGVjdXRpb25yb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tTWFuYWdlZFBvbGljeUFybih0aGlzLCAnZmlyc3QnLCAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQW1hem9uRHluYW1vREJGdWxsQWNjZXNzJyksXG4gICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4odGhpcywgJ3NlY29uZCcsICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9BV1NMYW1iZGFfRnVsbEFjY2VzcycpLFxuICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21NYW5hZ2VkUG9saWN5QXJuKHRoaXMsICdmaWZ0aCcsICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9DbG91ZFdhdGNoTGFtYmRhSW5zaWdodHNFeGVjdXRpb25Sb2xlUG9saWN5JyksXG4gICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4odGhpcywgJ2xhbWJkYUJhc2ljRXhlY1JvbGUnLCAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpXG4gICAgICBdXG4gICAgfSk7XG4gICAgXG4gICAgdmFyIGxheWVyQXJuID0gXCJhcm46YXdzOmxhbWJkYTpcIisgcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OICtcIjo1ODAyNDcyNzU0MzU6bGF5ZXI6TGFtYmRhSW5zaWdodHNFeHRlbnNpb246MjFcIjtcbiAgICB2YXIgbGF5ZXIgPSBsYW1iZGEuTGF5ZXJWZXJzaW9uLmZyb21MYXllclZlcnNpb25Bcm4odGhpcywgYExheWVyRnJvbUFybmAsIGxheWVyQXJuKTtcblxuICAgIGNvbnN0IGxhbWJkYUZ1bmN0aW9uID0gbmV3IG5vZGVqc2xhbWJkYS5Ob2RlanNGdW5jdGlvbih0aGlzLCAnbGFtYmRhZm4nLCB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xNl9YLCAgICAvLyBleGVjdXRpb24gZW52aXJvbm1lbnRcbiAgICAgICAgZW50cnk6ICcuLi8uLi9wZXRzdGF0dXN1cGRhdGVyL2luZGV4LmpzJyxcbiAgICAgICAgZGVwc0xvY2tGaWxlUGF0aDogJy4uLy4uL3BldHN0YXR1c3VwZGF0ZXIvcGFja2FnZS1sb2NrLmpzb24nLFxuICAgICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXG4gICAgICAgIG1lbW9yeVNpemU6IDEyOCxcbiAgICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxuICAgICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgICBsYXllcnM6IFtsYXllcl0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnVXBkYXRlIFBldCBhdmFpbGFiaWxpdHkgc3RhdHVzJyxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgIFwiVEFCTEVfTkFNRVwiOiBwcm9wcy50YWJsZU5hbWVcbiAgICAgICAgfSxcbiAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFtcbiAgICAgICAgICAgICdhd3Mtc2RrJ1xuICAgICAgICAgIF0sXG4gICAgICAgICAgbm9kZU1vZHVsZXM6IFtcbiAgICAgICAgICAgICAnYXdzLXhyYXktc2RrJ1xuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy9kZWZpbmVzIGFuIEFQSSBHYXRld2F5IFJFU1QgQVBJIHJlc291cmNlIGJhY2tlZCBieSBvdXIgXCJwZXRzdGF0dXN1cGRhdGVyXCIgZnVuY3Rpb24uXG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ3cuTGFtYmRhUmVzdEFwaSh0aGlzLCAnUGV0QWRvcHRpb25TdGF0dXNVcGRhdGVyJywge1xuICAgICAgICBoYW5kbGVyOiBsYW1iZGFGdW5jdGlvbixcbiAgICAgICAgcHJveHk6IHRydWUsXG4gICAgICAgIGVuZHBvaW50Q29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgdHlwZXM6IFthcGlndy5FbmRwb2ludFR5cGUuUkVHSU9OQUxdXG4gICAgICAgIH0sIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbG9nZ2luZ0xldmVsOmFwaWd3Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCdcbiAgICAgICAgfSwgZGVmYXVsdE1ldGhvZE9wdGlvbnM6IHttZXRob2RSZXNwb25zZXM6IFtdIH1cbiAgICAgICAgLy9kZWZhdWx0SW50ZWdyYXRpb246IG5ldyBhcGlndy5JbnRlZ3JhdGlvbih7IGludGVncmF0aW9uSHR0cE1ldGhvZDogJ1BVVCcsIHR5cGU6IGFwaWd3LkludGVncmF0aW9uVHlwZS5BV1MgfSlcbiAgICB9KTtcbiAgfVxufSJdfQ==