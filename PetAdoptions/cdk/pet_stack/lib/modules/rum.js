"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUM = void 0;
const aws_cognito_identitypool_alpha_1 = require("@aws-cdk/aws-cognito-identitypool-alpha");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_rum_1 = require("aws-cdk-lib/aws-rum");
const constructs_1 = require("constructs");
const cognito = require("aws-cdk-lib/aws-cognito");
const iam = require("aws-cdk-lib/aws-iam");
class RUM extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        this.identityPool = new aws_cognito_identitypool_alpha_1.IdentityPool(this, 'IdentityPool', {
            identityPoolName: props.name + '-RUM-IdentityPool',
            allowUnauthenticatedIdentities: true
        });
        const applicationName = props.name + '-RUM-AppMonitor';
        const cwRumIdentityPool = new cognito.CfnIdentityPool(this, 'cw-rum-identity-pool', {
            allowUnauthenticatedIdentities: true,
        });
        const cwRumUnauthenticatedRole = new iam.Role(this, 'cw-rum-unauthenticated-role', {
            assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
                "StringEquals": {
                    "cognito-identity.amazonaws.com:aud": cwRumIdentityPool.ref
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "unauthenticated"
                }
            }, "sts:AssumeRoleWithWebIdentity")
        });
        cwRumUnauthenticatedRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "rum:PutRumEvents"
            ],
            resources: ["arn:" + aws_cdk_lib_1.Stack.of(this).partition + ":rum:" + aws_cdk_lib_1.Stack.of(this).region + ":" + aws_cdk_lib_1.Stack.of(this).account + ":appmonitor/" + applicationName]
        }));
        const cwRumIdentityPoolRoleAttachment = new cognito.CfnIdentityPoolRoleAttachment(this, 'cw-rum-identity-pool-role-attachment', {
            identityPoolId: cwRumIdentityPool.ref,
            roles: {
                "unauthenticated": cwRumUnauthenticatedRole.roleArn
            }
        });
        this.appMonitor = new aws_rum_1.CfnAppMonitor(this, 'cw-rum-app-monitor', {
            domain: props.domain,
            name: applicationName,
            appMonitorConfiguration: {
                allowCookies: true,
                enableXRay: true,
                sessionSampleRate: 1,
                telemetries: ['errors', 'performance', 'http'],
                identityPoolId: cwRumIdentityPool.ref,
                guestRoleArn: cwRumUnauthenticatedRole.roleArn
            },
            customEvents: {
                status: 'ENABLED',
            },
            cwLogEnabled: true,
        });
        // Note that JS client is pinned to us-east-1!
        this.htmlScript = `<script>(function(n,i,v,r,s,c,x,z){x=window.AwsRumClient={q:[],n:n,i:i,v:v,r:r,c:c};window[n]=function(c,p){x.q.push({c:c,p:p});};z=document.createElement('script');z.async=true;z.src=s;document.head.insertBefore(z,document.head.getElementsByTagName('script')[0]);})(
'cwr','` + this.appMonitor.attrId + `','1.0.0','` + aws_cdk_lib_1.Stack.of(this).region + `','https://client.rum.us-east-1.amazonaws.com/1.16.1/cwr.js',
{ sessionSampleRate: 1,guestRoleArn: "` + cwRumUnauthenticatedRole.roleArn + `",identityPoolId: "` + cwRumIdentityPool.ref + `",endpoint:"https://dataplane.rum.` + aws_cdk_lib_1.Stack.of(this).region + `.amazonaws.com",telemetries: ["errors","performance","http"],allowCookies: true,enableXRay: true,cookieAttributes:{secure:false}});</script>`;
        // This will record the Page View event
        this.pageViewScript = `<script>function pageId() { const uP = new URLSearchParams(window.location.search); const pT = uP.get('selectedPetType'); return { pageId: window.location.pathname + (!pT ? '' : uP.get('selectedPetType') + '/' + uP.get('selectedPetColor')), pageTags: window.location.pathname === '/' ? [ 'landing' ] : [] } } cwr('recordPageView', pageId());</script>`;
        this.rumHtmlScript = new aws_cdk_lib_1.CfnOutput(scope, 'RUM-HTML-Script', {
            value: this.htmlScript,
            description: 'RUM HTML Script',
            exportName: 'RUM-HTML-Script'
        });
        this.rumPageviewScript = new aws_cdk_lib_1.CfnOutput(scope, 'RUM-Pageview-Script', {
            value: this.pageViewScript,
            description: 'RUM Pageview Script',
            exportName: 'RUM-Pageview-Script'
        });
    }
}
exports.RUM = RUM;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicnVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDRGQUFzRTtBQUN0RSw2Q0FBK0M7QUFDL0MsaURBQW9EO0FBRXBELDJDQUF1QztBQUN2QyxtREFBbUQ7QUFDbkQsMkNBQTJDO0FBUTNDLE1BQWEsR0FBSSxTQUFRLHNCQUFTO0lBUTlCLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZTtRQUNyRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSw2Q0FBWSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdkQsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLElBQUksR0FBRyxtQkFBbUI7WUFDbEQsOEJBQThCLEVBQUUsSUFBSTtTQUN2QyxDQUFDLENBQUM7UUFFSCxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsSUFBSSxHQUFHLGlCQUFpQixDQUFDO1FBRXZELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUNoRiw4QkFBOEIsRUFBRSxJQUFJO1NBQ3ZDLENBQUMsQ0FBQztRQUVILE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUMvRSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsa0JBQWtCLENBQ3JDLGdDQUFnQyxFQUNoQztnQkFDRSxjQUFjLEVBQUU7b0JBQ2Qsb0NBQW9DLEVBQUUsaUJBQWlCLENBQUMsR0FBRztpQkFDNUQ7Z0JBQ0Qsd0JBQXdCLEVBQUU7b0JBQ3hCLG9DQUFvQyxFQUFFLGlCQUFpQjtpQkFDeEQ7YUFDRixFQUNELCtCQUErQixDQUM5QjtTQUNKLENBQUMsQ0FBQztRQUVILHdCQUF3QixDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDekQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1Qsa0JBQWtCO2FBQ2pCO1lBQ0QsU0FBUyxFQUFFLENBQUMsTUFBTSxHQUFHLG1CQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxPQUFPLEdBQUcsbUJBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxtQkFBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEdBQUcsY0FBYyxHQUFHLGVBQWUsQ0FBQztTQUNySixDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sK0JBQStCLEdBQUcsSUFBSSxPQUFPLENBQUMsNkJBQTZCLENBQUMsSUFBSSxFQUNsRixzQ0FBc0MsRUFDdEM7WUFDSSxjQUFjLEVBQUUsaUJBQWlCLENBQUMsR0FBRztZQUNyQyxLQUFLLEVBQUU7Z0JBQ0gsaUJBQWlCLEVBQUUsd0JBQXdCLENBQUMsT0FBTzthQUN0RDtTQUNKLENBQ0osQ0FBQztRQUVGLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSx1QkFBYSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1RCxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07WUFDcEIsSUFBSSxFQUFFLGVBQWU7WUFDckIsdUJBQXVCLEVBQUU7Z0JBQ3JCLFlBQVksRUFBRSxJQUFJO2dCQUNsQixVQUFVLEVBQUUsSUFBSTtnQkFDaEIsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsV0FBVyxFQUFFLENBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNLENBQUM7Z0JBQzlDLGNBQWMsRUFBRSxpQkFBaUIsQ0FBQyxHQUFHO2dCQUNyQyxZQUFZLEVBQUUsd0JBQXdCLENBQUMsT0FBTzthQUNqRDtZQUNELFlBQVksRUFBRTtnQkFDVixNQUFNLEVBQUUsU0FBUzthQUNwQjtZQUNELFlBQVksRUFBRSxJQUFJO1NBQ3JCLENBQUMsQ0FBQztRQUdILDhDQUE4QztRQUM5QyxJQUFJLENBQUMsVUFBVSxHQUFHO1FBQ2xCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsYUFBYSxHQUFHLG1CQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRzt1Q0FDckMsR0FBRyx3QkFBd0IsQ0FBQyxPQUFPLEdBQUcscUJBQXFCLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxHQUFFLG9DQUFvQyxHQUFHLG1CQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyw4SUFBOEksQ0FBQztRQUVsVSx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLGNBQWMsR0FBRyxnV0FBZ1csQ0FBQztRQUd2WCxJQUFJLENBQUMsYUFBYSxHQUFJLElBQUksdUJBQVMsQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLEVBQUU7WUFDMUQsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVO1lBQ3RCLFdBQVcsRUFBRSxpQkFBaUI7WUFDOUIsVUFBVSxFQUFFLGlCQUFpQjtTQUNoQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSx1QkFBUyxDQUFDLEtBQUssRUFBRSxxQkFBcUIsRUFBRTtZQUNqRSxLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWM7WUFDMUIsV0FBVyxFQUFFLHFCQUFxQjtZQUNsQyxVQUFVLEVBQUUscUJBQXFCO1NBQ3BDLENBQUMsQ0FBQztJQUVQLENBQUM7Q0FDSjtBQS9GRCxrQkErRkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJZGVudGl0eVBvb2wgfSBmcm9tICdAYXdzLWNkay9hd3MtY29nbml0by1pZGVudGl0eXBvb2wtYWxwaGEnXG5pbXBvcnQgeyBDZm5PdXRwdXQsIFN0YWNrIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ2ZuQXBwTW9uaXRvciB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1ydW0nO1xuaW1wb3J0IHsgUG9saWN5LCBQb2xpY3lTdGF0ZW1lbnQsIFJvbGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5cblxuZXhwb3J0IGludGVyZmFjZSBSVU1Qcm9wcyB7XG4gICAgbmFtZTogc3RyaW5nXG4gICAgZG9tYWluOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIFJVTSBleHRlbmRzIENvbnN0cnVjdCB7XG4gICAgcHVibGljIHJlYWRvbmx5IGlkZW50aXR5UG9vbDogSWRlbnRpdHlQb29sO1xuICAgIHB1YmxpYyByZWFkb25seSBhcHBNb25pdG9yOiBDZm5BcHBNb25pdG9yO1xuICAgIHB1YmxpYyByZWFkb25seSBodG1sU2NyaXB0OiBzdHJpbmc7XG4gICAgcHVibGljIHJlYWRvbmx5IHBhZ2VWaWV3U2NyaXB0OiBzdHJpbmc7XG4gICAgcHVibGljIHJlYWRvbmx5IHJ1bUh0bWxTY3JpcHQ6IENmbk91dHB1dDtcbiAgICBwdWJsaWMgcmVhZG9ubHkgcnVtUGFnZXZpZXdTY3JpcHQ6IENmbk91dHB1dDtcblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBSVU1Qcm9wcykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIHRoaXMuaWRlbnRpdHlQb29sID0gbmV3IElkZW50aXR5UG9vbCh0aGlzLCAnSWRlbnRpdHlQb29sJywge1xuICAgICAgICAgICAgaWRlbnRpdHlQb29sTmFtZTogcHJvcHMubmFtZSArICctUlVNLUlkZW50aXR5UG9vbCcsXG4gICAgICAgICAgICBhbGxvd1VuYXV0aGVudGljYXRlZElkZW50aXRpZXM6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgYXBwbGljYXRpb25OYW1lID0gcHJvcHMubmFtZSArICctUlVNLUFwcE1vbml0b3InO1xuXG4gICAgICAgIGNvbnN0IGN3UnVtSWRlbnRpdHlQb29sID0gbmV3IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sKHRoaXMsICdjdy1ydW0taWRlbnRpdHktcG9vbCcsIHtcbiAgICAgICAgICAgIGFsbG93VW5hdXRoZW50aWNhdGVkSWRlbnRpdGllczogdHJ1ZSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY3dSdW1VbmF1dGhlbnRpY2F0ZWRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdjdy1ydW0tdW5hdXRoZW50aWNhdGVkLXJvbGUnLCB7XG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uRmVkZXJhdGVkUHJpbmNpcGFsKFxuICAgICAgICAgICAgJ2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbScsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIFwiU3RyaW5nRXF1YWxzXCI6IHtcbiAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphdWRcIjogY3dSdW1JZGVudGl0eVBvb2wucmVmXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIFwiRm9yQW55VmFsdWU6U3RyaW5nTGlrZVwiOiB7XG4gICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YW1yXCI6IFwidW5hdXRoZW50aWNhdGVkXCJcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFwic3RzOkFzc3VtZVJvbGVXaXRoV2ViSWRlbnRpdHlcIlxuICAgICAgICAgICAgKVxuICAgICAgICB9KTtcblxuICAgICAgICBjd1J1bVVuYXV0aGVudGljYXRlZFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgXCJydW06UHV0UnVtRXZlbnRzXCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcImFybjpcIiArIFN0YWNrLm9mKHRoaXMpLnBhcnRpdGlvbiArIFwiOnJ1bTpcIiArIFN0YWNrLm9mKHRoaXMpLnJlZ2lvbiArIFwiOlwiICsgU3RhY2sub2YodGhpcykuYWNjb3VudCArIFwiOmFwcG1vbml0b3IvXCIgKyBhcHBsaWNhdGlvbk5hbWVdXG4gICAgICAgIH0pKTtcblxuICAgICAgICBjb25zdCBjd1J1bUlkZW50aXR5UG9vbFJvbGVBdHRhY2htZW50ID0gbmV3IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sUm9sZUF0dGFjaG1lbnQodGhpcyxcbiAgICAgICAgICAgICdjdy1ydW0taWRlbnRpdHktcG9vbC1yb2xlLWF0dGFjaG1lbnQnLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkZW50aXR5UG9vbElkOiBjd1J1bUlkZW50aXR5UG9vbC5yZWYsXG4gICAgICAgICAgICAgICAgcm9sZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJ1bmF1dGhlbnRpY2F0ZWRcIjogY3dSdW1VbmF1dGhlbnRpY2F0ZWRSb2xlLnJvbGVBcm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG5cbiAgICAgICAgdGhpcy5hcHBNb25pdG9yID0gbmV3IENmbkFwcE1vbml0b3IodGhpcywgJ2N3LXJ1bS1hcHAtbW9uaXRvcicsIHtcbiAgICAgICAgICAgIGRvbWFpbjogcHJvcHMuZG9tYWluLFxuICAgICAgICAgICAgbmFtZTogYXBwbGljYXRpb25OYW1lLFxuICAgICAgICAgICAgYXBwTW9uaXRvckNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICBhbGxvd0Nvb2tpZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgZW5hYmxlWFJheTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzZXNzaW9uU2FtcGxlUmF0ZTogMSxcbiAgICAgICAgICAgICAgICB0ZWxlbWV0cmllczogWydlcnJvcnMnLCAncGVyZm9ybWFuY2UnLCAnaHR0cCddLFxuICAgICAgICAgICAgICAgIGlkZW50aXR5UG9vbElkOiBjd1J1bUlkZW50aXR5UG9vbC5yZWYsXG4gICAgICAgICAgICAgICAgZ3Vlc3RSb2xlQXJuOiBjd1J1bVVuYXV0aGVudGljYXRlZFJvbGUucm9sZUFyblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGN1c3RvbUV2ZW50czoge1xuICAgICAgICAgICAgICAgIHN0YXR1czogJ0VOQUJMRUQnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGN3TG9nRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgfSk7XG5cblxuICAgICAgICAvLyBOb3RlIHRoYXQgSlMgY2xpZW50IGlzIHBpbm5lZCB0byB1cy1lYXN0LTEhXG4gICAgICAgIHRoaXMuaHRtbFNjcmlwdCA9IGA8c2NyaXB0PihmdW5jdGlvbihuLGksdixyLHMsYyx4LHope3g9d2luZG93LkF3c1J1bUNsaWVudD17cTpbXSxuOm4saTppLHY6dixyOnIsYzpjfTt3aW5kb3dbbl09ZnVuY3Rpb24oYyxwKXt4LnEucHVzaCh7YzpjLHA6cH0pO307ej1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTt6LmFzeW5jPXRydWU7ei5zcmM9cztkb2N1bWVudC5oZWFkLmluc2VydEJlZm9yZSh6LGRvY3VtZW50LmhlYWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdKTt9KShcbidjd3InLCdgICsgdGhpcy5hcHBNb25pdG9yLmF0dHJJZCArIGAnLCcxLjAuMCcsJ2AgKyBTdGFjay5vZih0aGlzKS5yZWdpb24gKyBgJywnaHR0cHM6Ly9jbGllbnQucnVtLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tLzEuMTYuMS9jd3IuanMnLFxueyBzZXNzaW9uU2FtcGxlUmF0ZTogMSxndWVzdFJvbGVBcm46IFwiYCArIGN3UnVtVW5hdXRoZW50aWNhdGVkUm9sZS5yb2xlQXJuICsgYFwiLGlkZW50aXR5UG9vbElkOiBcImAgKyBjd1J1bUlkZW50aXR5UG9vbC5yZWYgK2BcIixlbmRwb2ludDpcImh0dHBzOi8vZGF0YXBsYW5lLnJ1bS5gICsgU3RhY2sub2YodGhpcykucmVnaW9uICsgYC5hbWF6b25hd3MuY29tXCIsdGVsZW1ldHJpZXM6IFtcImVycm9yc1wiLFwicGVyZm9ybWFuY2VcIixcImh0dHBcIl0sYWxsb3dDb29raWVzOiB0cnVlLGVuYWJsZVhSYXk6IHRydWUsY29va2llQXR0cmlidXRlczp7c2VjdXJlOmZhbHNlfX0pOzwvc2NyaXB0PmA7XG5cbiAgICAgICAgLy8gVGhpcyB3aWxsIHJlY29yZCB0aGUgUGFnZSBWaWV3IGV2ZW50XG4gICAgICAgIHRoaXMucGFnZVZpZXdTY3JpcHQgPSBgPHNjcmlwdD5mdW5jdGlvbiBwYWdlSWQoKSB7IGNvbnN0IHVQID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTsgY29uc3QgcFQgPSB1UC5nZXQoJ3NlbGVjdGVkUGV0VHlwZScpOyByZXR1cm4geyBwYWdlSWQ6IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSArICghcFQgPyAnJyA6IHVQLmdldCgnc2VsZWN0ZWRQZXRUeXBlJykgKyAnLycgKyB1UC5nZXQoJ3NlbGVjdGVkUGV0Q29sb3InKSksIHBhZ2VUYWdzOiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgPT09ICcvJyA/IFsgJ2xhbmRpbmcnIF0gOiBbXSB9IH0gY3dyKCdyZWNvcmRQYWdlVmlldycsIHBhZ2VJZCgpKTs8L3NjcmlwdD5gO1xuICAgICAgICBcblxuICAgICAgICB0aGlzLnJ1bUh0bWxTY3JpcHQgPSAgbmV3IENmbk91dHB1dChzY29wZSwgJ1JVTS1IVE1MLVNjcmlwdCcsIHtcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLmh0bWxTY3JpcHQsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JVTSBIVE1MIFNjcmlwdCcsXG4gICAgICAgICAgICBleHBvcnROYW1lOiAnUlVNLUhUTUwtU2NyaXB0J1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnJ1bVBhZ2V2aWV3U2NyaXB0ID0gbmV3IENmbk91dHB1dChzY29wZSwgJ1JVTS1QYWdldmlldy1TY3JpcHQnLCB7XG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5wYWdlVmlld1NjcmlwdCxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUlVNIFBhZ2V2aWV3IFNjcmlwdCcsXG4gICAgICAgICAgICBleHBvcnROYW1lOiAnUlVNLVBhZ2V2aWV3LVNjcmlwdCdcbiAgICAgICAgfSk7XG5cbiAgICB9XG59XG5cbiJdfQ==