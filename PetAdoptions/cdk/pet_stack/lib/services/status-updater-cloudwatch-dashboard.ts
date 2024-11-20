import { Construct } from "constructs";
import { Dashboard, GraphWidget, Metric } from "aws-cdk-lib/aws-cloudwatch";
import { Duration } from "aws-cdk-lib";

export interface ObservabilityProps {
    lambdaFunctionNames: string[];
    apiGatewayAPIName: string;
    dashboardNameSuffix: string;
  }

export class StatusUpdaterCloudwatchDashboard extends Construct {

    public dashboard: Dashboard;

    constructor(scope: Construct, id: string, props: ObservabilityProps) {
        super(scope, id);

        this.dashboard = new Dashboard(this, 'StatusUpdaterObservabilityDashboard'+props.dashboardNameSuffix, {
            dashboardName: 'StatusUpdaterObservabilityDashboard-'+props.dashboardNameSuffix,
        });

        // Add metrics for AWS/Lambda
        const lambdaDuration = new Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            statistic: 'Maximum',
            period: Duration.minutes(5),
        });

        const lambdaErrors = new Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            statistic: 'Sum',
            period: Duration.minutes(5),
        });

        const lambdaInvocations = new Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            statistic: 'Sum',
            period: Duration.minutes(5),
        });

        const lambdaInvocationsWidget = new GraphWidget({
            title: 'Lambda Invocations',
        });

        const lambdaErrorsWidget = new GraphWidget({
            title: 'Lambda Errors',
        });

        const lambdaDurationWidget = new GraphWidget({
            title: 'Lambda Duration',
        });

        props?.lambdaFunctionNames.forEach(functionName => {
            console.log(`------------------- functionName for CW Dimension: ${functionName} -----------------`);
            const dimensions = {FunctionName: functionName};

            lambdaInvocationsWidget.addLeftMetric(
                lambdaInvocations.with({dimensionsMap: dimensions})
            );
            lambdaDurationWidget.addLeftMetric(
                lambdaDuration.with({dimensionsMap: dimensions})
            );
            lambdaErrorsWidget.addLeftMetric(
                lambdaErrors.with({dimensionsMap: dimensions})
            );
        });

        //   APIGateway metrics
        const apiGatewayRequestCountMetric = new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: 'Sum',
            period: Duration.minutes(5),
            dimensionsMap: {ApiName: props.apiGatewayAPIName}
        });

        //Widget for APIGateway request count
        const apiGatewayRequestCountWidget = new GraphWidget({
            title: 'APIGateway Request Count',
        });

        // add apiGatewayRequestCountWidget to dashboard
        apiGatewayRequestCountWidget.addLeftMetric(apiGatewayRequestCountMetric);

        //   create metric for APIGateway latency and corresponding widget
        const apiGatewayLatencyMetric = new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            statistic: 'Maximum',
            period: Duration.minutes(5),
            dimensionsMap: {ApiName: props.apiGatewayAPIName}
        });
        const apiGatewayLatencyWidget = new GraphWidget({
            title: 'APIGateway Latency',
        });

        apiGatewayLatencyWidget.addLeftMetric(apiGatewayLatencyMetric);


        const apiGateway5xxErrorsMetric = new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            statistic: 'Sum',
            dimensionsMap: {ApiName: props.apiGatewayAPIName},
            period: Duration.minutes(5),
        });

        const apiGateway4xxErrorsMetric = new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            statistic: 'Sum',
            dimensionsMap: {ApiName: props.apiGatewayAPIName},
            period: Duration.minutes(5),
        });
        // add APIGateway metric for 5XX and 4XX errors to one widget
        const apiGatewayErrorsWidget = new GraphWidget({
            title: 'APIGateway Errors',
        });
        apiGatewayErrorsWidget.addLeftMetric(apiGateway5xxErrorsMetric);
        apiGatewayErrorsWidget.addLeftMetric(apiGateway4xxErrorsMetric);

        // first row API Gateway metrics
        this.dashboard.addWidgets( apiGatewayRequestCountWidget, apiGatewayLatencyWidget, apiGatewayErrorsWidget);
        // second row- Lambda metrics corresponding to API Gateway metrics
        this.dashboard.addWidgets(lambdaInvocationsWidget, lambdaDurationWidget, lambdaErrorsWidget);

        const fisFaultInjectedMetric = new Metric({
            namespace: 'aws-fis-extension',
            metricName: 'FaultInjected',
            statistic: 'Sum',
            period: Duration.minutes(5),
        });
        
        // create a GraphWidget with FIS extension metric 'FaultInjected' in namespace 'aws-fis-extension'
        const fisFaultInjectedAddLatencyWidget = new GraphWidget({
            title: 'FIS FaultInjected Invocation Delay',
        });

        const fisFaultInjectedInvocationErrorWidget = new GraphWidget({
            title: 'FIS FaultInjected Invocation Error',
        });

        const fisFaultInjectedHttpResponseWidget = new GraphWidget({
            title: 'FIS FaultInjected HTTP Integration Response',
        });

        props.lambdaFunctionNames.forEach(functionName => {
     
            const dimensionsAddDelay  = {'FaultId':'aws:lambda:invocation-add-delay', Invocation:functionName};
            const dimensionsInvocationError = {'FaultId':'aws:lambda:invocation-error', Invocation:functionName};
            const dimensionsHttpResponse = {'FaultId':'aws:lambda:invocation-http-integration-response', Invocation:functionName};

            fisFaultInjectedAddLatencyWidget.addLeftMetric(
                fisFaultInjectedMetric.with({dimensionsMap: dimensionsAddDelay})
            );

            fisFaultInjectedInvocationErrorWidget.addLeftMetric(
                fisFaultInjectedMetric.with({dimensionsMap: dimensionsInvocationError})
            );

            fisFaultInjectedHttpResponseWidget.addLeftMetric(
                fisFaultInjectedMetric.with({dimensionsMap: dimensionsHttpResponse})
            );

        });
        this.dashboard.addWidgets(fisFaultInjectedAddLatencyWidget, fisFaultInjectedInvocationErrorWidget, fisFaultInjectedHttpResponseWidget);

    }
}