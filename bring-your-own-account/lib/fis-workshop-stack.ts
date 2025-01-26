import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { randomBytes } from 'crypto';

interface FisWorkshopStackProps extends cdk.StackProps {
    // environmentName: string;
    eeTeamRoleArn: string;
    isEventEngine: string;
    gitBranch: string;
}

export class FisWorkshopStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: FisWorkshopStackProps) {
        super(scope, id, props);

        // Define CloudFormation parameters
        // const environmentName = new cdk.CfnParameter(this, 'EnvironmentName', {
        //     type: 'String',
        //     default: props.environmentName,
        //     description: 'An environment name that is prefixed to resource names'
        // });
        const gitBranch = new cdk.CfnParameter(this, 'GitBranch', {
            type: 'String',
            description: 'Git branch to check out. KEEP EMPTY FOR MAIN BRANCH',
            default: props.gitBranch
        });

        const eeTeamRoleArn = new cdk.CfnParameter(this, ' eeTeamRoleArn', {
            type: 'String',
            description: '',
            default: props.eeTeamRoleArn
        });

        const isEventEngine = new cdk.CfnParameter(this, 'IsEventEngine', {
            type: 'String',
            description: 'Whether this is running in Event Engine',
            default: props.isEventEngine,
            allowedValues: ['true', 'false']
        });



        // Generate random string for S3 bucket name
        const randomString = randomBytes(2).toString('hex');
        const bucketName = `fis-asset-${randomString}`;

        // Create S3 bucket for assets
        const assetBucket = new s3.Bucket(this, 'assetBucketFIS', {
            bucketName: bucketName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            versioned: true,
        });

        // Deploy buildspecs
        new s3deploy.BucketDeployment(this, 'assetBucketFISDeployment', {
            sources: [
                s3deploy.Source.asset(path.join(__dirname, 'artifacts'), {
                    bundling: {
                        image: cdk.DockerImage.fromRegistry('ubuntu'),
                        user: "root",
                        command: [
                            'bash', '-c', `
                apt-get update && \
                apt-get install -y zip && \
                mkdir -p /asset-output/build && \
                mkdir -p /asset-output/destroy && \
                cp /asset-input/buildspec-build.yml /asset-output/build/buildspec.yml && \
                cp /asset-input/buildspec-destroy.yml /asset-output/destroy/buildspec.yml && \
                cd /asset-output/build && zip -r ../build.zip . && \
                cd /asset-output/destroy && zip -r ../destroy.zip . 
                `
                        ]
                    }
                })
            ],
            destinationBucket: assetBucket,
            destinationKeyPrefix: 'assets'
        });

        // Create IAM Role for CodeBuild
        const codeBuildServiceRole = new iam.Role(this, 'CodeBuildServiceRole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            description: 'Service role for CodeBuild',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess') // As per workshop requirements
            ]
        });

        // Create CodeBuild Project for Workshop Build
        const buildProject = new codebuild.Project(this, 'WorkshopBuildProject', {
            projectName: 'FIS-Workshop-Build',
            role: codeBuildServiceRole,
            timeout: cdk.Duration.minutes(180),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                privileged: true,
                computeType: codebuild.ComputeType.LARGE,
                environmentVariables: {
                    AWS_DEFAULT_REGION: {
                        value: this.region
                    },
                    ASSET_BUCKET: {
                        value: assetBucket.bucketName
                    },
                    GIT_BRANCH: {
                        value: gitBranch.valueAsString
                    },
                    EE_TEAM_ROLE_ARN: {
                        value: eeTeamRoleArn.valueAsString
                    },
                    IS_EVENT_ENGINE: {
                        value: isEventEngine.valueAsString
                    }

                }
            },
            cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        'runtime-versions': {
                            nodejs: '16'
                        },
                        commands: [
                            'nohup /usr/local/bin/dockerd --host=unix:///var/run/docker.sock --host=tcp://127.0.0.1:2375 --storage-driver=overlay2 &',
                            'timeout 15 sh -c "until docker info; do echo .; sleep 1; done"',
                            'npm install -g aws-cdk'
                        ]
                    },
                    pre_build: {
                        commands: [
                            'git clone --single-branch https://github.com/aws-samples/aws-fault-injection-simulator-workshop-v2.git',
                            'cd aws-fault-injection-simulator-workshop-v2/scripts/',
                            'bash cdkbootstrap.sh'
                        ]
                    },
                    build: {
                        commands: [
                            'cd ../PetAdoptions/cdk/pet_stack/',
                            'npm install',
                            'npm run build',
                            'cdk deploy Services --context admin_role=${EE_TEAM_ROLE_ARN} --context is_event_engine=${IS_EVENT_ENGINE} --require-approval=never --verbose -O ./out/out.json',
                            'cdk deploy ServicesSecondary --context admin_role=${EE_TEAM_ROLE_ARN} --context is_event_engine=${IS_EVENT_ENGINE} --require-approval=never --verbose -O ./out/out.json',
                            'cdk deploy NetworkRegionPeering --require-approval=never --verbose -O ./out/out.json',
                            'cdk deploy NetworkRoutesMain --require-approval=never --verbose -O ./out/out.json',
                            'cdk deploy NetworkRoutesSecondary --require-approval=never --verbose -O ./out/out.json',
                            'cdk deploy S3Replica --require-approval=never --verbose -O ./out/out.json',
                            'cdk deploy Applications --require-approval=never --verbose -O ./out/out.json',
                            'cdk deploy ApplicationsSecondary --require-approval=never --verbose -O ./out/out.json',
                            'cdk deploy FisServerless --require-approval never --verbose -O ./out/out.json',
                            'cdk deploy Observability --require-approval never --verbose -O ./out/out.json',
                            'cdk deploy ObservabilitySecondary --require-approval never --verbose -O ./out/out.json',
                            'cdk deploy UserSimulationStack --require-approval never --verbose -O ./out/out.json',
                            'cdk deploy UserSimulationStackSecondary --require-approval never --verbose -O ./out/out.json',
                            'cdk deploy ObservabilityDashboard --require-approval never --verbose -O ./out/out.json'
                        ]
                    }
                },
                artifacts: {
                    files: [
                        '**/*'
                    ],
                    'base-directory': 'aws-fault-injection-simulator-workshop-v2/PetAdoptions/cdk/pet_stack/out'
                },
                cache: {
                    paths: [
                        '/root/.npm/**/*',
                        '/root/.docker/**/*'
                    ]
                }
            })
        });

        // Create CodeBuild Project for Workshop Destroy
        const destroyProject = new codebuild.Project(this, 'WorkshopDestroyProject', {
            projectName: 'FIS-Workshop-Destroy',
            role: codeBuildServiceRole,
            timeout: cdk.Duration.minutes(180),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                privileged: true,
                computeType: codebuild.ComputeType.LARGE,
                environmentVariables: {
                    AWS_DEFAULT_REGION: {
                        value: this.region
                    },
                    ASSET_BUCKET: {
                        value: assetBucket.bucketName
                    }
                }
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        'runtime-versions': {
                            nodejs: '16'
                        },
                        commands: [
                            'npm install -g aws-cdk'
                        ]
                    },
                    build: {
                        commands: [
                            'git clone --single-branch https://github.com/aws-samples/aws-fault-injection-simulator-workshop-v2.git',
                            'cd aws-fault-injection-simulator-workshop-v2/PetAdoptions/cdk/pet_stack/',
                            'npm install',
                            'npm run build',
                            'cdk destroy --force --all'
                        ]
                    }
                }
            })
        });

        // Create CodePipeline Role
        const codePipelineServiceRole = new iam.Role(this, 'CodePipelineServiceRole', {
            assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
            ]
        });

        // Create CodePipeline
        const pipeline = new codepipeline.Pipeline(this, 'WorkshopPipeline', {
            pipelineName: 'FIS-Workshop-Pipeline',
            role: codePipelineServiceRole,
            artifactBucket: assetBucket,
            stages: [
                {
                    stageName: 'Source',
                    actions: [
                        new codepipeline_actions.S3SourceAction({
                            actionName: 'S3Source',
                            bucket: assetBucket,
                            bucketKey: 'assets/build.zip',
                            output: new codepipeline.Artifact('SourceOutput'),
                            role: codePipelineServiceRole
                        })
                    ]
                },
                {
                    stageName: 'Build',
                    actions: [
                        new codepipeline_actions.CodeBuildAction({
                            actionName: 'BuildAction',
                            project: buildProject,
                            input: new codepipeline.Artifact('SourceOutput'),
                            outputs: [new codepipeline.Artifact('BuildOutput')],
                            role: codePipelineServiceRole
                        })
                    ]
                }
            ]
        });

        // Outputs
        new cdk.CfnOutput(this, 'AssetBucketName', {
            value: assetBucket.bucketName,
            description: 'Name of the S3 bucket created for FIS workshop assets'
        });

        new cdk.CfnOutput(this, 'PipelineName', {
            value: pipeline.pipelineName,
            description: 'Name of the CodePipeline'
        });

        new cdk.CfnOutput(this, 'BuildProjectName', {
            value: buildProject.projectName,
            description: 'Name of the Build Project'
        });

        new cdk.CfnOutput(this, 'DestroyProjectName', {
            value: destroyProject.projectName,
            description: 'Name of the Destroy Project'
        });
    }
}