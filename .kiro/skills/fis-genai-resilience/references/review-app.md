# Reviewing an application for resilience

Goal of Phase 1: produce a concrete picture of the architecture and a short list of candidate
weaknesses you can hypothesize against. **Discover — do not guess.** Resilience reasoning is only as
good as the facts behind it.

## Order of discovery

1. **Live account first.** If the environment has an AWS API MCP server or read-only CLI access,
   enumerate what is actually deployed. This is ground truth and reflects drift the code may not.
2. **Infrastructure code as fallback / corroboration.** CDK, CloudFormation, and deployment scripts
   tell you intent and naming. In the workshop, the PetAdoptions infra lives under
   `PetAdoptions/cdk/pet_stack/` in the infrastructure repo.
3. **Reconcile.** Where live and code disagree, prefer live for "what exists now" and code for
   "what it's named and why."

## What to inventory

Build a compact model — a table is fine — covering:

- **Services and compute platform.** For each service: is it ECS Fargate, ECS-on-EC2, EKS, or
  Lambda? This determines which FIS actions can target it (e.g. `aws:ecs:*` vs `aws:eks:*` vs
  `aws:lambda:*`), and whether an SSM sidecar is present for `aws:ecs:task-*` stress actions.
- **Request / critical path.** Trace a user action end to end (in PetAdoptions: the adoption
  *checkout* flow). Which calls are **synchronous and user-blocking**? Those failures are felt by
  users; asynchronous ones may not be.
- **Data stores.** Engines, single vs multi-AZ, read replicas, failover behaviour (Aurora,
  DynamoDB). Data is usually the hardest part of resilience.
- **Queues and topics.** SQS / SNS: who publishes, who consumes. A queue with a **producer but no
  consumer** is a decoupling point whose failure shows up on the *producer* (publish) side — a
  commonly missed dependency.
- **Isolation boundaries.** AZ spread, cross-AZ calls, load-balancer cross-zone behaviour, VPC
  endpoints. Cross-AZ dependencies are a frequent source of gray failures.
- **What's tagged for fault injection.** Look for the resilience/fault tags the experiments will
  target (`FIS-Ready=True`, or in the workshop `AzImpairmentPower=Ready`).

## Find the single points of failure and untested paths

The valuable hypotheses live where:

- a **synchronous** dependency on the critical path has **no fallback** (failure is user-visible);
- a dependency is assumed reliable but has never been faulted;
- a failure mode is **not already covered** by the workshop's existing experiments (see
  `native-vs-ssm.md` for the catalog of what's already tested) — steer toward the gaps.

## PetAdoptions quick orientation (workshop subject)

A starting map (always re-confirm against the live account / current code, names drift):

- **PetSite** (.NET, EKS) — the storefront and the **checkout** entry point. On adoption it writes a
  transaction, then publishes to **SQS** and **SNS**, and may start a Step Function.
- **PayForAdoption** (Go, ECS Fargate) — payment/transaction writer called synchronously from
  checkout. Writes to Aurora / DynamoDB.
- **PetSearch** (Java/Spring, ECS Fargate + ECS-on-EC2) — search results.
- **PetListAdoptions** (Go, Fargate), **PetAdoptionsHistory** (Python, EKS), **PetFood** (Python,
  EKS), **TrafficGenerator** (Fargate), **StatusUpdater** (Lambda + API Gateway).
- **Data:** Aurora PostgreSQL (writer + reader), DynamoDB `ddb_petadoption`.
- **Messaging:** SQS `sqs_petadoption`, SNS `topic_petadoption`.

Candidate weaknesses this map suggests (confirm before relying on them): the checkout flow depends
synchronously on PayForAdoption tasks; the SQS publish on the checkout path is a dependency whose
impairment is rarely tested; cross-AZ calls between tiers.

Output of Phase 1: a few sentences of architecture + a short bulleted list of candidate weaknesses,
each of which becomes a hypothesis in Phase 2.
