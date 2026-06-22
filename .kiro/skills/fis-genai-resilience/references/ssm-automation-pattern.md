# The SSM-automation fault pattern

Use this when the failure you want to inject has **no native FIS action** (see `native-vs-ssm.md`).
You author an SSM Automation document that performs the fault and then undoes it, and FIS invokes it
with `aws:ssm:start-automation-execution`. This is a skeleton of the **pattern** — generate the
actual fault logic for your hypothesis. Learn concrete structure from
`fis-template-library/sqs-queue-impairment/` and `fis-template-library/database-connection-limit-exhaustion/`.

## The golden rule: apply → wait → restore, with cleanup on every exit

The fault must be **time-bounded** and **self-healing**. The document applies the fault, sleeps for a
caller-supplied duration, then restores — and restore must also run if a step **fails** or the
experiment is **cancelled**. Prefer applying and removing the fault via the **same (inverse) API**
so cleanup is reliable (e.g. add a deny statement with `SetQueueAttributes`, remove it the same way).

## Required file set (SSM pattern)

| File | Purpose |
|------|---------|
| `README.md` | Same required sections as the native pattern (STYLE_GUIDE). |
| `AWSFIS.json` | `{"AWSFIS": {"template": {"version": "1.0"}}}`. |
| `<name>-experiment-template.json` | FIS template whose action is `aws:ssm:start-automation-execution`. |
| `<name>-automation.yaml` | The SSM Automation document (schemaVersion `0.3`). |
| `<name>-fis-role-iam-policy.json` | FIS role: start/stop/get automation + `iam:PassRole` + logging. |
| `<name>-ssm-automation-role-iam-policy.json` | The role the **automation** assumes: only the fault APIs, tag-scoped. |
| `fis-iam-trust-relationship.json` | Trust for `fis.amazonaws.com`. |
| `ssm-iam-trust-relationship.json` | Trust for `ssm.amazonaws.com`. |

(If the automation acts through yet another principal — e.g. runs commands on EC2 — add that
principal's trust file too, as `database-connection-limit-exhaustion` does for EC2.)

## Experiment template (SSM invocation)

```jsonc
{
  "description": "<fault, target, and what it tests>",
  "targets": {},
  "actions": {
    "<apply-fault>": {
      "actionId": "aws:ssm:start-automation-execution",
      "description": "<run the automation that applies and restores the fault>",
      "parameters": {
        "maxDuration": "PT20M",   // MUST exceed the document's internal duration + overhead
        "documentArn": "arn:aws:ssm:<YOUR REGION>:<YOUR AWS ACCOUNT>:document/<YOUR AUTOMATION DOCUMENT NAME>",
        "documentParameters": "{\"<param>\": \"<value>\", \"duration\": \"PT10M\", \"AutomationAssumeRole\": \"arn:aws:iam::<YOUR AWS ACCOUNT>:role/<YOUR SSM AUTOMATION IAM ROLE NAME>\"}"
      },
      "targets": {}
    }
  },
  "stopConditions": [ { "source": "none" } ],
  "roleArn": "arn:aws:iam::<YOUR AWS ACCOUNT>:role/<YOUR FIS IAM ROLE NAME>",
  "tags": { "Name": "<experiment-name>", "Purpose": "resilience-testing" },
  "experimentOptions": { "accountTargeting": "single-account", "emptyTargetResolutionMode": "skip" }
}
```

Notes:
- `aws:ssm:start-automation-execution` has **resource type None**, so the template's top-level
  `targets` is `{}` and the action's `targets` is `{}`. The automation finds its own targets (e.g.
  by tag) inside the document.
- `documentParameters` is a **JSON string** (escaped), not a JSON object.
- `maxDuration` (the FIS ceiling) must be longer than the document's own `duration` parameter.
- To ramp severity, chain multiple `start-automation-execution` actions with `aws:fis:wait` between
  them using `startAfter` (the `sqs-queue-impairment` template does this).

## SSM Automation document skeleton (schemaVersion 0.3)

```yaml
description: "<apply a bounded fault to <target> selected by tag, then restore>"
schemaVersion: "0.3"
assumeRole: "{{ AutomationAssumeRole }}"
parameters:
  tagKey:        { type: String, default: "FIS-Ready" }
  tagValue:      { type: String, default: "True" }
  duration:      { type: String, default: "PT10M" }        # ISO-8601
  region:        { type: String, default: "{{global:REGION}}" }
  AutomationAssumeRole: { type: String, default: "" }
mainSteps:
  - name: discoverTargets         # find resources by tag
    action: aws:executeScript
    # ... returns a StringList of target identifiers ...

  - name: applyFault              # apply the fault (idempotent)
    action: aws:executeScript
    onFailure: "step:restoreFault"   # <-- cleanup on failure
    onCancel:  "step:restoreFault"   # <-- cleanup on cancel
    # ... mutate state; raise on partial failure ...

  - name: wait
    action: aws:sleep
    onFailure: "step:restoreFault"
    onCancel:  "step:restoreFault"
    inputs: { Duration: "{{ duration }}" }

  - name: restoreFault            # inverse of applyFault; MUST surface failures
    action: aws:executeScript
    isEnd: true
    # ... undo the mutation; if any target can't be restored, raise so FIS marks it failed ...
```

### Authoring rules for the document

- **Idempotent apply**, **reliable restore.** Restore must handle the "already partially applied"
  case and must **raise** (not swallow) if it can't fully clean up — a silently-failed cleanup leaves
  the system impaired.
- **Scope the fault narrowly.** Prefer tag conditions (`aws:ResourceTag/FIS-Ready: True`) and, where
  possible, an optional `targetPrincipalArn` so you can impair only the app's role rather than all
  callers.
- **Use built-in env/region** (`{{global:REGION}}`) — don't hardcode regions.
- **Restore via the inverse of apply** so the same permission set covers both directions.

## After generating

Validate against [validation-checklist.md](validation-checklist.md) and set roles per
[iam-and-trust-rules.md](iam-and-trust-rules.md).
