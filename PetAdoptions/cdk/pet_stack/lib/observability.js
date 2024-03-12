"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Observability = void 0;
const cdk = require("aws-cdk-lib");
const ssm = require("aws-cdk-lib/aws-ssm");
const rum_1 = require("./modules/rum");
const aws_cloudwatch_1 = require("aws-cdk-lib/aws-cloudwatch");
const cr = require("aws-cdk-lib/custom-resources");
const logs = require("aws-cdk-lib/aws-logs");
class Observability extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const fisLogGroup = new logs.LogGroup(this, 'FISLogGroup', {
            logGroupName: 'FISExperiments',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const petSiteUrl = ssm.StringParameter.valueFromLookup(this, '/petstore/petsiteurl');
        //const domain: string = ssm.StringParameter.fromStringParameterAttributes(this, 'getParamPetSiteDomain', { parameterName: "/petstore/petsitedomain"}).stringValue;
        const domain = (petSiteUrl.replace(/^https?:\/\//, '')).toLowerCase();
        if (!domain) {
            throw new Error('domain is required');
        }
        var rum = new rum_1.RUM(this, 'RUM', {
            name: 'Petsite',
            domain: domain
        });
        const putParameter = new cr.AwsCustomResource(this, '/petstore/rumscript', {
            onCreate: {
                service: 'SSM',
                action: 'putParameter',
                parameters: {
                    Name: '/petstore/rumscript',
                    Value: rum.htmlScript,
                    Overwrite: true
                },
                physicalResourceId: cr.PhysicalResourceId.of('/petstore/rumscript'),
            },
            onUpdate: {
                service: 'SSM',
                action: 'putParameter',
                parameters: {
                    Name: '/petstore/rumscript',
                    Value: rum.htmlScript,
                    Overwrite: true
                },
                physicalResourceId: cr.PhysicalResourceId.of('/petstore/rumscript'),
            },
            onDelete: {
                service: 'SSM',
                action: 'putParameter',
                parameters: {
                    Name: '/petstore/rumscript',
                    Value: ' ',
                    Overwrite: true
                },
                physicalResourceId: cr.PhysicalResourceId.of('/petstore/rumscript'),
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });
        // Alarm for Frustrating navigation experience
        const navigationFrustratedMetric = new aws_cloudwatch_1.Metric({
            namespace: 'AWS/RUM',
            metricName: 'NavigationFrustratedTransaction',
            dimensionsMap: {
                application_name: rum.appMonitor.name
            },
            statistic: 'sum',
            period: cdk.Duration.minutes(15)
        });
        const alarm = new aws_cloudwatch_1.Alarm(this, 'AlarmFrustratingNavigation', {
            metric: navigationFrustratedMetric,
            threshold: 3,
            evaluationPeriods: 1,
            treatMissingData: aws_cloudwatch_1.TreatMissingData.NOT_BREACHING,
            comparisonOperator: aws_cloudwatch_1.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            alarmName: 'petsite-frustrating-ux'
        });
        cdk.Tags.of(alarm).add('Name', rum.appMonitor.name);
        // Alarm for Javascript error
        const javascriptMetric = new aws_cloudwatch_1.Metric({
            namespace: 'AWS/RUM',
            metricName: 'JsErrorCount',
            dimensionsMap: {
                application_name: rum.appMonitor.name
            },
            statistic: 'sum',
            period: cdk.Duration.minutes(15)
        });
        const jsAlarm = new aws_cloudwatch_1.Alarm(this, 'AlarmRandomJSError', {
            metric: javascriptMetric,
            threshold: 0,
            evaluationPeriods: 1,
            treatMissingData: aws_cloudwatch_1.TreatMissingData.NOT_BREACHING,
            comparisonOperator: aws_cloudwatch_1.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            alarmName: 'random-js-error'
        });
    }
}
exports.Observability = Observability;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJpbGl0eS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9ic2VydmFiaWxpdHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLDJDQUEyQztBQUUzQyx1Q0FBb0M7QUFFcEMsK0RBQWdHO0FBRWhHLG1EQUFtRDtBQUNuRCw2Q0FBNkM7QUFFN0MsTUFBYSxhQUFjLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDMUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFdBQVcsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUN6RCxZQUFZLEVBQUUsZ0JBQWdCO1lBQzlCLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLHNCQUFzQixDQUFDLENBQUM7UUFDckYsbUtBQW1LO1FBQ25LLE1BQU0sTUFBTSxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQTtRQUVyRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDWixNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDeEMsQ0FBQztRQUVELElBQUksR0FBRyxHQUFHLElBQUksU0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7WUFDN0IsSUFBSSxFQUFFLFNBQVM7WUFDZixNQUFNLEVBQUUsTUFBTTtTQUNmLENBQUMsQ0FBQztRQUVILE1BQU0sWUFBWSxHQUFHLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxxQkFBcUIs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QUFrQixFQUFFLG1DQUFrQixDQUFDLGtDQUFrQztZQUN6RSxTQUFTLEVBQUUsaUJBQWlCO1NBQzdCLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQXJHRCxzQ0FxR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBSVU0gfSBmcm9tICcuL21vZHVsZXMvcnVtJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IEFsYXJtLCBDb21wYXJpc29uT3BlcmF0b3IsIFRyZWF0TWlzc2luZ0RhdGEsIE1ldHJpYyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJ1xuaW1wb3J0IHsgQWxpYXMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCAqIGFzIGNyIGZyb20gJ2F3cy1jZGstbGliL2N1c3RvbS1yZXNvdXJjZXMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5cbmV4cG9ydCBjbGFzcyBPYnNlcnZhYmlsaXR5IGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuICAgIFxuICAgIGNvbnN0IGZpc0xvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0ZJU0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiAnRklTRXhwZXJpbWVudHMnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBwZXRTaXRlVXJsID0gc3NtLlN0cmluZ1BhcmFtZXRlci52YWx1ZUZyb21Mb29rdXAodGhpcywgJy9wZXRzdG9yZS9wZXRzaXRldXJsJyk7XG4gICAgLy9jb25zdCBkb21haW46IHN0cmluZyA9IHNzbS5TdHJpbmdQYXJhbWV0ZXIuZnJvbVN0cmluZ1BhcmFtZXRlckF0dHJpYnV0ZXModGhpcywgJ2dldFBhcmFtUGV0U2l0ZURvbWFpbicsIHsgcGFyYW1ldGVyTmFtZTogXCIvcGV0c3RvcmUvcGV0c2l0ZWRvbWFpblwifSkuc3RyaW5nVmFsdWU7XG4gICAgY29uc3QgZG9tYWluID0gKHBldFNpdGVVcmwucmVwbGFjZSgvXmh0dHBzPzpcXC9cXC8vLCAnJykpLnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBpZiAoIWRvbWFpbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdkb21haW4gaXMgcmVxdWlyZWQnKTtcbiAgICB9XG5cbiAgICB2YXIgcnVtID0gbmV3IFJVTSh0aGlzLCAnUlVNJywge1xuICAgICAgbmFtZTogJ1BldHNpdGUnLFxuICAgICAgZG9tYWluOiBkb21haW5cbiAgICB9KTtcblxuICAgIGNvbnN0IHB1dFBhcmFtZXRlciA9IG5ldyBjci5Bd3NDdXN0b21SZXNvdXJjZSh0aGlzLCAnL3BldHN0b3JlL3J1bXNjcmlwdCcsIHtcbiAgICAgIG9uQ3JlYXRlOiB7XG4gICAgICAgIHNlcnZpY2U6ICdTU00nLFxuICAgICAgICBhY3Rpb246ICdwdXRQYXJhbWV0ZXInLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgTmFtZTogJy9wZXRzdG9yZS9ydW1zY3JpcHQnLFxuICAgICAgICAgIFZhbHVlOiBydW0uaHRtbFNjcmlwdCxcbiAgICAgICAgICBPdmVyd3JpdGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgcGh5c2ljYWxSZXNvdXJjZUlkOiBjci5QaHlzaWNhbFJlc291cmNlSWQub2YoJy9wZXRzdG9yZS9ydW1zY3JpcHQnKSxcbiAgICAgIH0sXG4gICAgICBvblVwZGF0ZTogeyAgICAgICAgXG4gICAgICAgIHNlcnZpY2U6ICdTU00nLFxuICAgICAgICBhY3Rpb246ICdwdXRQYXJhbWV0ZXInLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgTmFtZTogJy9wZXRzdG9yZS9ydW1zY3JpcHQnLFxuICAgICAgICAgIFZhbHVlOiBydW0uaHRtbFNjcmlwdCxcbiAgICAgICAgICBPdmVyd3JpdGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgcGh5c2ljYWxSZXNvdXJjZUlkOiBjci5QaHlzaWNhbFJlc291cmNlSWQub2YoJy9wZXRzdG9yZS9ydW1zY3JpcHQnKSxcbiAgICAgIH0sXG4gICAgICBvbkRlbGV0ZToge1xuICAgICAgICAgIHNlcnZpY2U6ICdTU00nLFxuICAgICAgICAgIGFjdGlvbjogJ3B1dFBhcmFtZXRlcicsXG4gICAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgTmFtZTogJy9wZXRzdG9yZS9ydW1zY3JpcHQnLFxuICAgICAgICAgICAgVmFsdWU6ICcgJyxcbiAgICAgICAgICAgIE92ZXJ3cml0ZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBwaHlzaWNhbFJlc291cmNlSWQ6IGNyLlBoeXNpY2FsUmVzb3VyY2VJZC5vZignL3BldHN0b3JlL3J1bXNjcmlwdCcpLFxuICAgICAgfSxcbiAgICAgIHBvbGljeTogY3IuQXdzQ3VzdG9tUmVzb3VyY2VQb2xpY3kuZnJvbVNka0NhbGxzKHtcbiAgICAgICAgcmVzb3VyY2VzOiBjci5Bd3NDdXN0b21SZXNvdXJjZVBvbGljeS5BTllfUkVTT1VSQ0UsXG4gICAgICB9KSxcbiAgICB9KVxuXG5cbiAgICAvLyBBbGFybSBmb3IgRnJ1c3RyYXRpbmcgbmF2aWdhdGlvbiBleHBlcmllbmNlXG4gICAgY29uc3QgbmF2aWdhdGlvbkZydXN0cmF0ZWRNZXRyaWMgPSBuZXcgTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9SVU0nLFxuICAgICAgbWV0cmljTmFtZTogJ05hdmlnYXRpb25GcnVzdHJhdGVkVHJhbnNhY3Rpb24nLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBhcHBsaWNhdGlvbl9uYW1lOiBydW0uYXBwTW9uaXRvci5uYW1lXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpXG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgYWxhcm0gPSBuZXcgQWxhcm0odGhpcywgJ0FsYXJtRnJ1c3RyYXRpbmdOYXZpZ2F0aW9uJywge1xuICAgICAgbWV0cmljOiBuYXZpZ2F0aW9uRnJ1c3RyYXRlZE1ldHJpYyxcbiAgICAgIHRocmVzaG9sZDogMyxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBDb21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICAgIGFsYXJtTmFtZTogJ3BldHNpdGUtZnJ1c3RyYXRpbmctdXgnXG4gICAgfSk7XG5cbiAgICBjZGsuVGFncy5vZihhbGFybSkuYWRkKCdOYW1lJywgcnVtLmFwcE1vbml0b3IubmFtZSk7XG5cbiAgICAvLyBBbGFybSBmb3IgSmF2YXNjcmlwdCBlcnJvclxuICAgIGNvbnN0IGphdmFzY3JpcHRNZXRyaWMgPSBuZXcgTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9SVU0nLFxuICAgICAgbWV0cmljTmFtZTogJ0pzRXJyb3JDb3VudCcsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIGFwcGxpY2F0aW9uX25hbWU6IHJ1bS5hcHBNb25pdG9yLm5hbWVcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxNSlcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBqc0FsYXJtID0gbmV3IEFsYXJtKHRoaXMsICdBbGFybVJhbmRvbUpTRXJyb3InLCB7XG4gICAgICBtZXRyaWM6IGphdmFzY3JpcHRNZXRyaWMsXG4gICAgICB0aHJlc2hvbGQ6IDAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IFRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgICBhbGFybU5hbWU6ICdyYW5kb20tanMtZXJyb3InXG4gICAgfSlcbiAgfVxufSJdfQ==