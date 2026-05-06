# FIS Workshop - Single Region Migration Context

## Task for this session

**Delete all deployed stacks in AWS, then redeploy from scratch to validate the single-region migration works end-to-end.**

## AWS Account

- **Account:** 518664963531
- **Region:** us-east-1
- **Role:** Admin (assumed via Isengard)

## Stacks to destroy (in reverse dependency order)

```bash
cd PetAdoptions/cdk/pet_stack
cdk destroy UserSimulationStack --force
cdk destroy ObservabilityDashboard --force
cdk destroy Observability --force
cdk destroy FisServerless --force
cdk destroy Applications --force
cdk destroy Services --force
```

## Stacks to deploy (in order)

```bash
cd PetAdoptions/cdk/pet_stack
npm run build
cdk deploy Services --require-approval=never -O ./out/out.json
cdk deploy Applications --require-approval=never -O ./out/out.json
cdk deploy FisServerless --require-approval=never -O ./out/out.json
cdk deploy Observability --require-approval=never -O ./out/out.json
cdk deploy UserSimulationStack --require-approval=never -O ./out/out.json
cdk deploy ObservabilityDashboard --require-approval=never -O ./out/out.json
```

## Prerequisites before deploying

1. **Docker Desktop must be running** — CDK builds container images locally
2. **CDK Bootstrap** already done (CDKToolkit stack exists) — do NOT destroy it
3. `npm install` and `npm run build` already completed in `PetAdoptions/cdk/pet_stack/`

## Known issues and fixes applied

- **GOPROXY DNS timeout in Docker**: The UserSimulationStack builds a Go container locally. Changed `ENV GOPROXY=https://proxy.golang.org,direct` to `ENV GOPROXY=direct` in `lib/user_simulation-stack.ts` (line ~223). This avoids DNS resolution failures inside Docker on VPN.
- **HTTP-only ALB**: The PetSite ALB listens on port 80 only (no HTTPS). Corporate VPN/proxy may block access. Workaround: disconnect VPN or access from non-corp network. The one-observability-demo solves this with CloudFront in front.
- **Services stack takes ~20 min** due to EKS cluster creation.
- **Applications stack** depends on Services (needs EKS cluster + ECS clusters).

## What was changed (all uncommitted)

### Files modified
- `app/pet_stack.ts` — Single-region entry point (6 stacks)
- `lib/services.ts` — Removed TGW, multi-region branching
- `lib/applications.ts` — Local SSM instead of cross-region reader
- `lib/common/services-shared.ts` — Simplified VPC, DDB, RDS, S3 (no replicas)
- `lib/common/services-shared-properties.ts` — Removed multi-region interfaces
- `lib/dashboards/az_dashboard.ts` — Uses `stack.region` directly
- `lib/observability_dashboard.ts` — AZ dashboard only
- `lib/user_simulation-stack.ts` — GOPROXY=direct fix
- `PetAdoptions/payforadoption-go/Dockerfile` — Updated
- `PetAdoptions/petlistadoptions-go/Dockerfile` — Updated
- `bring-your-own-account/cdk/lib/fis-workshop-stack.ts` — Removed secondary deploys
- `buildspec.yml` — Updated for single-region

### Files deleted
- `lib/network_connect.ts`
- `lib/network_routes.ts`
- `lib/s3replica.ts`
- `lib/common/tgw-connection-accepter.ts`
- `lib/common/ssm-parameter-reader.ts`
- `lib/common/s3_replication_enabler.ts`
- `lib/dashboards/multi_region_dashboard.ts`

### Git status
All changes are **unstaged** on the `single-region` branch (branched from `main`). Nothing committed yet.

## Validation checklist after redeploy

- [ ] All 6 stacks reach CREATE_COMPLETE
- [ ] PetSite ALB returns HTTP 200: `curl http://<petsite-alb-dns>/`
- [ ] ECS services running at desired count (petsearch 2/2, listadoptions 2/2, payforadoption 2/2, trafficgenerator 1/1)
- [ ] EKS cluster ACTIVE with petsite pods running
- [ ] UserSimulation traffic generator producing load
- [ ] CloudWatch dashboard (ObservabilityDashboard) visible in console
