---
name: fis-genai-resilience
description: Use an LLM to validate and test the resilience of an application. Reviews the architecture, generates testable resilience hypotheses, and authors runnable AWS FIS experiments (native-action and SSM-automation) for the user to run. Built for the AWS FIS / chaos-engineering workshop using the PetAdoptions sample app, but the workflow is meant to be taken home and pointed at the user's own application.
tags: [aws, fis, resilience, chaos-engineering, genai, kiro]
---

# FIS GenAI Resilience

## Overview

This skill turns a general-purpose LLM into a **resilience-testing copilot**. You point it at an
application; it helps you find where the application is weak, express those weaknesses as testable
hypotheses, and turn the highest-value hypotheses into **runnable AWS Fault Injection Service (FIS)
experiments** — which you then run and interpret.

The LLM is the **tool**. The application is the **subject**. In the workshop the subject is the
**PetAdoptions** sample app, but the entire point is that you can take this same workflow home and
run it against your own workload.

**The skill does not ship pre-built experiments.** You generate them, live, from your own review of
the application. The skill teaches the *shape* of a valid experiment and points you at a library of
real examples to learn from — it does not hand you an answer key to copy.

## The resilience loop

```
  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────────┐   ┌────────────┐
  │ 1. REVIEW   │──▶│ 2. HYPOTHESIZE│──▶│ 3. AUTHOR   │──▶│ 4. VALIDATE  │──▶│ 5. RUN &   │
  │ the app     │   │  failures     │   │ experiments │   │  & guard     │   │ INTERPRET  │
  └─────────────┘   └──────────────┘   └─────────────┘   └──────────────┘   └─────┬──────┘
        ▲                                                                          │
        └──────────────────────────  generate the next hypothesis  ◀──────────────┘
```

Each phase has a natural-language trigger. You can run the whole loop or jump to a phase.

| Say this | The skill does |
|----------|----------------|
| "Review this application for resilience" | Phase 1 — discover architecture, dependencies, failure domains |
| "What could fail? Generate resilience hypotheses" | Phase 2 — testable "We believe that if… then… because…" statements |
| "Turn hypothesis N into a FIS experiment" / "author a native experiment" / "author an SSM experiment" | Phase 3 — generate a runnable FIS template (native or SSM) |
| "Validate this experiment before I run it" | Phase 4 — lint JSON/YAML, check IAM + stop conditions + safety |
| "I ran it — here are my results. Did the hypothesis hold?" | Phase 5 — interpret observations, then propose the next hypothesis |

---

## Phase 1 — Review the application

Goal: build a concrete picture of the architecture and surface candidate weaknesses. Do **not**
guess — discover. See [references/review-app.md](references/review-app.md) for the full method.

In the workshop the subject is PetAdoptions. Discover it from the live account first
(the AWS API MCP / read-only CLI), falling back to the infrastructure code:

1. **Inventory the services and how they connect** — compute platforms (ECS Fargate, ECS-on-EC2,
   EKS, Lambda), data stores (Aurora, DynamoDB), queues/topics (SQS, SNS), load balancers, the
   request/checkout path.
2. **Map dependencies and isolation boundaries** — which calls are synchronous and in the user's
   critical path; which are cross-AZ; which are single points of failure.
3. **Note what is already tested** — the workshop already faults EC2 termination, ECS task
   CPU/IO/network, EKS pods, Aurora failover, S3, AZ power. Steer new experiments toward
   **untested** failure modes (see [references/native-vs-ssm.md](references/native-vs-ssm.md)).

Output: a short architecture + weakness summary you can hypothesize against.

## Phase 2 — Generate resilience hypotheses

Goal: convert weaknesses into **testable** statements. Use the exact format and rules in
[references/hypothesis-generation.md](references/hypothesis-generation.md):

> **"We believe that if [specific failure condition] then [expected system behavior] because
> [underlying assumption about system design]."**

Each hypothesis must name a **steady-state metric** (how you'll know the system is healthy before
and after) and map to a **validation method** (an FIS action, a game day, a load test). Prioritize
hypotheses that test untested failure modes and single points of failure.

## Phase 3 — Author the experiment

Goal: turn a chosen hypothesis into a **runnable** FIS experiment, in the
[fis-template-library](../../../fis-template-library) house style. There are two authoring patterns —
pick using [references/native-vs-ssm.md](references/native-vs-ssm.md):

- **Native action** — the fault you want is in the FIS action catalog (e.g. `aws:ecs:stop-task`,
  `aws:rds:reboot-db-instances`). Generate a single experiment template + the FIS role policy +
  trust. Anatomy: [references/fis-template-anatomy.md](references/fis-template-anatomy.md).
- **SSM automation** — the fault has **no native action** (e.g. impairing an SQS queue's data
  plane). Generate an SSM Automation document that **applies the fault, waits, and restores it**,
  invoked by `aws:ssm:start-automation-execution`, plus the FIS role, the SSM automation role, and
  both trust relationships. Pattern: [references/ssm-automation-pattern.md](references/ssm-automation-pattern.md).

For either pattern, follow [references/iam-and-trust-rules.md](references/iam-and-trust-rules.md)
for least-privilege roles and `FIS-Ready=True` tag targeting.

**Generate the full file set** the style guide requires (see
[references/fis-template-anatomy.md](references/fis-template-anatomy.md) for the exact list) and use
the angle-bracket placeholders `<YOUR REGION>` / `<YOUR AWS ACCOUNT>` / `<YOUR ROLE NAME>` — never
bake in real account values.

> Learn the shape from real examples in `fis-template-library/` — `ec2-instances-terminate/` is the
> canonical **native** example and `sqs-queue-impairment/` is the canonical **SSM** example. Read
> them for structure; **do not copy them** — author for the hypothesis you actually chose.

## Phase 4 — Validate and guard before running

Goal: never run un-vetted, un-bounded fault injection. Run the full
[references/validation-checklist.md](references/validation-checklist.md). At minimum:

- Every generated `.json` parses; every `.yaml` loads. Action IDs and parameters match the FIS
  Actions reference. Targeting tags exist on real resources.
- A **stop condition** (CloudWatch alarm) or, at minimum, a bounded `duration`/`maxDuration` is in
  place. The SSM document **restores** the fault in every exit path (success, failure, cancel).
- IAM follows least privilege and is scoped by the `FIS-Ready=True` tag.

## Phase 5 — Run and interpret

The **user** runs the experiment (console or CLI). Then bring back the observations — dashboards,
ALB/RUM/X-Ray metrics, the FIS experiment report — and the skill adjudicates the hypothesis
(held / refuted / inconclusive), recommends improvements, and **generates the next hypothesis** to
verify a fix. This closes the loop back to Phase 2.

---

## References

- [references/review-app.md](references/review-app.md) — how to discover an application's
  architecture, dependencies, and failure domains (live account first, IaC fallback).
- [references/hypothesis-generation.md](references/hypothesis-generation.md) — the hypothesis
  statement format, generation rules, steady state, validation methods, prioritization.
- [references/native-vs-ssm.md](references/native-vs-ssm.md) — decision guide: native FIS action vs.
  author an SSM automation; and how to avoid duplicating experiments already in the workshop.
- [references/fis-template-anatomy.md](references/fis-template-anatomy.md) — field-by-field anatomy
  of a native FIS experiment template and its required file set (skeleton + placeholders only).
- [references/ssm-automation-pattern.md](references/ssm-automation-pattern.md) — the
  apply→sleep→restore SSM Automation pattern and the `aws:ssm:start-automation-execution` wiring.
- [references/iam-and-trust-rules.md](references/iam-and-trust-rules.md) — least-privilege FIS / SSM
  role policies, trust relationships, and `FIS-Ready` tag targeting.
- [references/validation-checklist.md](references/validation-checklist.md) — what to check before
  running: JSON/YAML lint, action-shape, stop conditions, safety levers, cleanup guarantees.

## Common mistakes

- **Copying an example instead of authoring for the hypothesis.** The library teaches shape; your
  experiment must target what you actually chose to test.
- **Re-testing what the workshop already covers.** Check the existing catalog (Phase 1) and steer to
  untested failure modes.
- **No stop condition / unbounded duration.** Always bound the blast radius.
- **An SSM document that injects but doesn't reliably restore.** Cleanup must run on success,
  failure, and cancel.
- **Baking real account IDs, AZs, or ARNs into the template.** Use the angle-bracket placeholders.
- **Hypotheses that aren't testable** — no named steady-state metric, or no FIS action that can
  produce the failure condition.
