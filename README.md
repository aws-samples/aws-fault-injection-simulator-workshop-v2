## One Observability Demo

This repo contains a sample application which is used in the One Observability Demo workshop here - https://observability.workshop.aws/

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.


CONSOLE_ROLE_ARN=arn:aws:iam::753618319136:role/Admin

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1
CLUSTER_NAME=PetSite

eksctl get iamidentitymapping --cluster PetSite --region=us-east-1
arn:aws:iam::753618319136:role/Admin

eksctl create iamidentitymapping \
  --cluster ${CLUSTER_NAME} \
  --arn arn:aws:iam::753618319136:role/Admin \
  --username arn:aws:iam::753618319136:role/Admin \
  --group dashboard-view

  aws eks update-kubeconfig --region region_code --name my_cluster
eksctl get iamidentitymapping --cluster PetSite --region=us-east-1
eksctl delete iamidentitymapping --cluster PetSite --arn arn:aws:iam::753618319136:role/Admin  --username fis-experiment

export EKS_ADMIN_ARN=arn:aws:iam::753618319136:role/observabilityworkshop-admin
export CONSOLE_ROLE_ARN=arn:aws:iam::753618319136:role/Admin

cdk deploy --context admin_role=$EKS_ADMIN_ARN Services --context dashboard_role_arn=$CONSOLE_ROLE_ARN --require-approval never

cdk deploy --all --context admin_role=$EKS_ADMIN_ARN  --context dashboard_role_arn=$CONSOLE_ROLE_ARN --require-approval never




arn:aws:iam::753618319136:role/Admin                                                            arn:aws:iam::753618319136:role/Admin                                    dashboard-view
arn:aws:iam::753618319136:role/Admin                                                            fis-experiment
arn:aws:iam::753618319136:role/Admin                                                            isengard-admin
arn:aws:iam::753618319136:role/Services-AdminRole38563C57-FIOJP2KGX4N5                          arn:aws:iam::753618319136:role/Services-AdminRole38563C57-FIOJP2KGX4N5  system:masters
arn:aws:iam::753618319136:role/Services-petsiteNodegroupDefaultCapacityNodeGroupR-1OW5ZA99ZPMOL system:node:{{EC2PrivateDNSName}}                                       system:bootstrappers,system:nodes
arn:aws:iam::753618319136:role/fis-eks-experiment                                               fis-experiment
arn:aws:iam::753618319136:role/fis-eks-experiment                                               fis-experiment
arn:aws:iam::753618319136:role/observabilityworkshop-admin                                      arn:aws:iam::753618319136:role/observabilityworkshop-admin              system:masters




cat << EOF > fis_rbac.yaml
kind: ServiceAccount
apiVersion: v1
metadata:
  namespace: default
  name: fis-experiment
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: default
  name: fis-experiment
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "create", "patch", "delete"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["create", "get", "delete", "deletecollection", "list"]
- apiGroups: [""]
  resources: ["pods/ephemeralcontainers"]
  verbs: ["update"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: fis-experiment
  namespace: default
subjects:
- kind: ServiceAccount
  name: fis-experiment
  namespace: default
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: fis-experiment
roleRef:
  kind: Role
  name: fis-experiment
  apiGroup: rbac.authorization.k8s.io
EOF

kubectl apply -f fis_rbac.yaml


aws eks update-kubeconfig --region us-east-1 --name PetSite




PETLISTADOPTIONS_CLUSTER=$(aws ecs list-clusters | jq '.clusterArns[]|select(contains("PetList"))' -r)
TRAFFICGENERATOR_SERVICE=$(aws ecs list-services --cluster $PETLISTADOPTIONS_CLUSTER | jq '.serviceArns[]|select(contains("trafficgenerator"))' -r)
aws ecs update-service --cluster $PETLISTADOPTIONS_CLUSTER --service $TRAFFICGENERATOR_SERVICE --desired-count 5

