# Generating resilience hypotheses

A hypothesis turns a vague worry ("I think the payment service is a SPOF") into something you can
actually test. This is the bridge between reviewing an app and authoring an FIS experiment: every
experiment exists to prove or refute one hypothesis.

## The statement format (always use this)

> **"We believe that if [specific failure condition] then [expected system behavior] because
> [underlying assumption about system design]."**

Examples:
- "We believe that if 50% of the PayForAdoption tasks are stopped, then checkout will keep
  succeeding because the ECS service runs multiple tasks across AZs and the ALB routes around the
  stopped ones while ECS launches replacements."
- "We believe that if the order queue rejects SendMessage, then the checkout request will still
  return success to the user because the publish is non-critical and failures are caught and
  logged — *or* it will surface as a user-visible error, revealing a hidden hard dependency."
- "We believe that if the primary Aurora instance reboots, then writes recover within ~30s because
  Multi-AZ failover promotes the standby and the driver reconnects."

The "because" clause is the most important part — it states the assumption you are actually testing.

## Rules

1. **Only hypothesize about what exists.** Use the Phase 1 architecture facts; don't invent
   components.
2. **Each hypothesis must be testable** via an FIS action, a game day, or a load test. If no
   mechanism can produce the failure condition, it's not yet a hypothesis.
3. **Name a steady-state metric.** State how you'll know the system is healthy *before* and *after*
   — e.g. "ALB 5xx ≈ 0 and checkout success rate ≥ baseline." Without it you can't adjudicate.
4. **Prioritize the gaps.** Weight toward: untested failure modes, synchronous critical-path
   dependencies with no fallback, single points of failure, and cross-AZ assumptions.
5. **Be specific about blast radius.** "50% of tasks in one service" not "the cluster."

## Each hypothesis should record

- `statement` — in the format above.
- `steady_state` — the metric(s) that define healthy.
- `failure_condition` — what you will inject.
- `expected_outcome` — what should happen (the prediction you're testing).
- `validation_method` — the FIS action (e.g. `aws:ecs:stop-task`) or "SSM automation: <fault>", or
  game day / load test.
- `priority` — high / medium / low, justified by the rules above.

## Validation methods

| Method | When to use |
|--------|-------------|
| **FIS native action** | The failure maps to a catalog action (instance/task stop, network latency/blackhole, AZ power, RDS/Aurora failover, API error). |
| **FIS + SSM automation** | The failure has **no** native action (e.g. SQS data-plane impairment, connection-limit exhaustion, custom app fault). See `native-vs-ssm.md`. |
| **Game day** | Multi-team coordination, runbook and decision-speed validation. |
| **Load test** | Capacity, autoscaling, and saturation behaviour. |

## Scale

- Simple app: 8–15 hypotheses. Medium: 15–30. Large/complex: 30–50.
- In the workshop you only need a handful — pick the 1–2 highest-priority ones that are **not**
  already covered by the existing experiments, and carry those into Phase 3.

## Closing the loop (Phase 5)

After an experiment runs, the result feeds the next hypothesis:
- **Held** → hypothesize about a deeper / larger-blast-radius failure.
- **Refuted** → hypothesize about the fix ("if we add a stop-condition alarm / fallback, then…").
- **Inconclusive** → refine the steady-state metric or blast radius and re-test.
