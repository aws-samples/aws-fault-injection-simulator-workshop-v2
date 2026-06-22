# Native action vs. SSM automation — and avoiding duplicates

Phase 3 produces one of two kinds of experiment. Choose deliberately.

## Decision

```
Is there an FIS catalog action that produces the failure condition?
        │
        ├── YES ─▶ NATIVE pattern.
        │          One experiment template + FIS role policy + FIS trust.
        │          (see fis-template-anatomy.md)
        │
        └── NO  ─▶ SSM AUTOMATION pattern.
                   Author an SSM Automation doc that applies→waits→restores the fault,
                   invoked by aws:ssm:start-automation-execution.
                   Experiment template + SSM doc + FIS role + SSM automation role + 2 trusts.
                   (see ssm-automation-pattern.md)
```

To check whether a native action exists, consult the **FIS Actions reference**
(`https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html`) or
`aws fis list-actions`. Confirm the exact `actionId`, its **resource type**, and its **parameters**
before generating — do not assume from memory.

### When a native action exists but you still need SSM

Some faults are *partially* covered. Example: `aws:ecs:task-*` stress actions exist but require an
SSM agent sidecar in the task definition. If the target lacks the sidecar, either that's not a
viable native target or you author an SSM/`send-command` approach. Note such constraints in the
experiment README.

## Don't re-test what the workshop already covers

The base workshop already exercises these failure modes. A *new* experiment should target a
**gap**, not duplicate one of these:

| Domain | Already covered by the workshop |
|--------|--------------------------------|
| EC2 | terminate instances (intro), disk fill, latency injection, EBS I/O, spot interruption |
| ECS | task CPU stress, task I/O stress, task network latency/blackhole/packet-loss, terminate node |
| EKS | pod CPU/memory/IO stress, pod network latency/packet-loss, pod delete |
| Lambda | invocation add-delay, invocation error, HTTP integration response, ChaosNodeLayer |
| Data | Aurora instance reboot, Aurora cluster failover, S3 AZ impairment |
| Network | AZ disruption, network disruption, DynamoDB network disruption |
| API | API throttling, API unavailable (inject-api-* against an IAM role) |
| Scenarios | AZ power interruption, AZ application slowdown (latency), cross-AZ traffic slowdown (packet loss) |

### Good "gap" candidates (confirm against the live app first)

- **`aws:ecs:stop-task`** (native) — control-plane stop of a Fargate service's tasks. Distinct from
  the task *stress* actions already covered; tests service task-replacement + ALB re-registration.
- **SQS data-plane impairment** (SSM) — there is **no native FIS action** for impairing an SQS
  queue's send/receive. An SSM automation that attaches a temporary scoped deny policy tests a
  dependency the workshop never faults — and on a producer-only queue the impact surfaces on the
  *publish* side of the critical path. `fis-template-library/sqs-queue-impairment` is the reference
  shape to learn from.
- **`aws:rds:reboot-db-instances`** (native) — reboot (vs. the failover the workshop already does).
- **Connection-limit exhaustion** (SSM) — see `fis-template-library/database-connection-limit-exhaustion`.

These are *suggestions of where the gaps are*, not pre-written experiments. Pick based on the
hypothesis you actually chose in Phase 2, then author it in Phase 3.

## Grounding corpus

Learn the house style from the real templates in `fis-template-library/`:
- **Native example:** `ec2-instances-terminate/` (template + iam-policy + trust + AWSFIS.json + README).
- **SSM example:** `sqs-queue-impairment/` (adds the automation YAML, the SSM automation role policy,
  and the SSM trust).
- **Authoritative rules:** `fis-template-library/STYLE_GUIDE.md`.

Read them for structure. **Do not copy them** — author for your hypothesis.
