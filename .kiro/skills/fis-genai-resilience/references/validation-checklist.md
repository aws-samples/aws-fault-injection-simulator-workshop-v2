# Validation checklist — before you run

Never run un-vetted, un-bounded fault injection. Run this whole checklist on the generated experiment
before it touches an account. Anything you can't confirm by **reading the file** (or checking the live
account) is a blocker, not a "probably fine."

The list is grouped so a human reviewer can sign off section by section. The first four sections apply
to **every** experiment; the SSM section applies only to the SSM-automation pattern.

## 1. It parses and the shapes are real

- [ ] Every generated `.json` parses; every `.yaml` loads. (`jq . <file>.json`, a YAML lint, or
      `aws fis create-experiment-template --cli-input-json` in `--dry-run`-style validation.)
- [ ] The **`actionId`** exists and is spelled exactly as in the FIS Actions reference
      (`aws fis get-action --id <actionId>`).
- [ ] The action's **parameters** are exactly those the action defines — none invented, none missing.
      Actions with no parameters use `{}`.
- [ ] The **target `resourceType` matches the action's resource type**. A mismatch fails at create
      time. (SSM-invocation actions have resource type *None* → top-level `targets` is `{}`.)

## 2. Blast radius is bounded

- [ ] Targets are selected by **tag** (`resourceTags`), not a hardcoded ARN.
- [ ] You confirmed against the live account that the tag matches **only** the resources you intend to
      hit — no more, no fewer. (`aws resourcegroupstaggingapi get-resources --tag-filters ...`)
- [ ] `selectionMode` is deliberately small to start — `COUNT(1)` or a specific `PERCENT()`, not
      `ALL`.
- [ ] `filters` narrow to the right state where relevant (e.g. only `RUNNING`, only a given AZ).

## 3. It will stop

- [ ] There is a **stop condition** (a CloudWatch alarm) **or** a bounded `duration` / `maxDuration`.
      No experiment should be able to run indefinitely.
- [ ] If a stop-condition alarm is referenced, that alarm **exists** in this account and is in `OK`
      state before you start.
- [ ] For the SSM pattern, the FIS action's `maxDuration` is **longer** than the document's internal
      `duration` plus overhead — otherwise FIS kills the run before it can restore.

## 4. IAM is least privilege

- [ ] FIS role grants only the action's documented permissions — no blanket `*` (see
      [iam-and-trust-rules.md](iam-and-trust-rules.md)).
- [ ] Permissions are scoped by the same tag (or ARN) the template targets.
- [ ] `iam:PassRole` is scoped to the specific role ARN(s).
- [ ] Trust relationships name the correct service principal(s).

## 5. SSM automation only — it restores on every exit

This is the section that most often hides a problem. Read the document, don't assume.

- [ ] The document follows **apply → wait → restore**.
- [ ] `applyFault` and `wait` both set **`onFailure: step:restoreFault`** and
      **`onCancel: step:restoreFault`** — so an error or a cancel still cleans up.
- [ ] `restoreFault` is the **inverse** of `applyFault` and **raises** (does not swallow) if it can't
      fully clean up — a silently-failed restore leaves the system impaired.
- [ ] Apply is **idempotent** and restore handles the "partially applied" case.
- [ ] Region comes from `{{global:REGION}}` (or a parameter), not a hardcoded string.
- [ ] **Mental dry-run:** "If I cancel this experiment 30 seconds in, does the account return to
      normal on its own?" If you can't answer yes from the document, do not run it.

## 6. No baked-in values

- [ ] No real account ID, AZ, or ARN where a placeholder belongs. `<YOUR REGION>` /
      `<YOUR AWS ACCOUNT>` / `<YOUR ROLE NAME>` are filled with **your** values at run time, not
      committed.

## 7. Human sign-off

- [ ] A person (you) has read the template and the policy end to end and can explain the action, the
      target, the stop condition, and (SSM) the restore step.
- [ ] You hardened **at least one** thing the generator left loose (tighter targeting, a real stop
      condition, narrower IAM, a more robust restore).

> The AI's self-validation is a first pass, not the sign-off. Fault injection is a destructive action;
> the human who runs it owns the review.
