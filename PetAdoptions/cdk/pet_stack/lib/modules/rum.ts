import { IdentityPool } from '@aws-cdk/aws-cognito-identitypool-alpha'
import { CfnOutput, Stack } from 'aws-cdk-lib';
import { CfnAppMonitor } from 'aws-cdk-lib/aws-rum';
import { Policy, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';


export interface RUMProps {
    name: string
    domain: string
}

export class RUM extends Construct {
    public readonly identityPool: IdentityPool;
    public readonly appMonitor: CfnAppMonitor;
    public readonly htmlScript: string;
    public readonly pageViewScript: string;
    public readonly rumHtmlScript: CfnOutput;
    public readonly rumPageviewScript: CfnOutput;

    constructor(scope: Construct, id: string, props: RUMProps) {
        super(scope, id);

        this.identityPool = new IdentityPool(this, 'IdentityPool', {
            identityPoolName: props.name + '-RUM-IdentityPool',
            allowUnauthenticatedIdentities: true
        });

        const applicationName = props.name + '-RUM-AppMonitor';

        const cwRumIdentityPool = new cognito.CfnIdentityPool(this, 'cw-rum-identity-pool', {
            allowUnauthenticatedIdentities: true,
        });

        const cwRumUnauthenticatedRole = new iam.Role(this, 'cw-rum-unauthenticated-role', {
            assumedBy: new iam.FederatedPrincipal(
            'cognito-identity.amazonaws.com',
            {
              "StringEquals": {
                "cognito-identity.amazonaws.com:aud": cwRumIdentityPool.ref
              },
              "ForAnyValue:StringLike": {
                "cognito-identity.amazonaws.com:amr": "unauthenticated"
              }
            },
            "sts:AssumeRoleWithWebIdentity"
            )
        });

        cwRumUnauthenticatedRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
            "rum:PutRumEvents"
            ],
            resources: ["arn:" + Stack.of(this).partition + ":rum:" + Stack.of(this).region + ":" + Stack.of(this).account + ":appmonitor/" + applicationName]
        }));

        const cwRumIdentityPoolRoleAttachment = new cognito.CfnIdentityPoolRoleAttachment(this,
            'cw-rum-identity-pool-role-attachment',
            {
                identityPoolId: cwRumIdentityPool.ref,
                roles: {
                    "unauthenticated": cwRumUnauthenticatedRole.roleArn
                }
            }
        );

        this.appMonitor = new CfnAppMonitor(this, 'cw-rum-app-monitor', {
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
'cwr','` + this.appMonitor.attrId + `','1.0.0','` + Stack.of(this).region + `','https://client.rum.us-east-1.amazonaws.com/1.16.1/cwr.js',
{ sessionSampleRate: 1,guestRoleArn: "` + cwRumUnauthenticatedRole.roleArn + `",identityPoolId: "` + cwRumIdentityPool.ref +`",endpoint:"https://dataplane.rum.` + Stack.of(this).region + `.amazonaws.com",telemetries: ["errors","performance","http"],allowCookies: true,enableXRay: true,cookieAttributes:{secure:false}});</script>`;

        // This will record the Page View event
        this.pageViewScript = `<script>function pageId() { const uP = new URLSearchParams(window.location.search); const pT = uP.get('selectedPetType'); return { pageId: window.location.pathname + (!pT ? '' : uP.get('selectedPetType') + '/' + uP.get('selectedPetColor')), pageTags: window.location.pathname === '/' ? [ 'landing' ] : [] } } cwr('recordPageView', pageId());</script>`;
        

        this.rumHtmlScript =  new CfnOutput(scope, 'RUM-HTML-Script', {
            value: this.htmlScript,
            description: 'RUM HTML Script',
            exportName: 'RUM-HTML-Script'
        });

        this.rumPageviewScript = new CfnOutput(scope, 'RUM-Pageview-Script', {
            value: this.pageViewScript,
            description: 'RUM Pageview Script',
            exportName: 'RUM-Pageview-Script'
        });

    }
}

