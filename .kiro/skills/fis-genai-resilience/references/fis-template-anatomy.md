# Anatomy of a native FIS experiment template

This describes the **shape** of a native-action experiment so you can generate one for your chosen
hypothesis. It is a skeleton with placeholders — not a ready-to-run experiment. Learn concrete
structure from `fis-template-library/ec2-instances-terminate/` and obey
`fis-template-library/STYLE_GUIDE.md`.

## Required file set (native pattern)

Generate all of these, named `<experiment-name>-<type>`, in a kebab-case directory:

| File | Purpose |
|------|---------|
| `README.md` | Title, fixed template-description paragraph, exact disclaimer, **Hypothesis**, Prerequisites, How it works, Stop Conditions, exact "Observability and stop conditions" text, Next Steps, exact "Import Experiment" block. (Section list and exact-text blocks are in the STYLE_GUIDE.) |
| `AWSFIS.json` | Exactly `{"AWSFIS": {"template": {"version": "1.0"}}}`. |
| `<name>-template.json` | The FIS experiment template (below). |
| `<name>-iam-policy.json` | Least-privilege policy for the FIS role (see iam-and-trust-rules.md). |
| `fis-iam-trust-relationship.json` | Trust policy allowing `fis.amazonaws.com` to assume the role. |

## Experiment template — field by field

```jsonc
{
  "description": "<one sentence: what fault, on what, and what it tests>",

  "targets": {
    "<TargetName>": {
      "resourceType": "<aws:...>",          // MUST match the action's resource type (see below)
      "resourceTags": { "FIS-Ready": "True" },   // tag-scoped targeting — preferred
      "filters": [                                 // optional; narrow further
        { "path": "<attribute path>", "values": ["<value>"] }
      ],
      "selectionMode": "<ALL | COUNT(n) | PERCENT(n)>"
    }
  },

  "actions": {
    "<action-name>": {
      "actionId": "<aws:service:action>",   // confirm against the FIS Actions reference
      "description": "<what this action does>",
      "parameters": { /* exactly the params the action defines; {} if none */ },
      "targets": { "<ActionTargetKey>": "<TargetName>" }  // key name is action-specific
    }
  },

  "stopConditions": [ { "source": "none" } ],   // replace with a CloudWatch alarm for real runs
  "roleArn": "arn:aws:iam::<YOUR AWS ACCOUNT>:role/<YOUR ROLE NAME>",
  "tags": { "Name": "<experiment-name>", "Purpose": "resilience-testing" },
  "experimentOptions": {
    "accountTargeting": "single-account",
    "emptyTargetResolutionMode": "<fail | skip>"
  }
}
```

### Getting the action shape right (critical)

- The **`actionId`**, its **resource type**, and its **parameters** are defined by AWS. Before
  generating, confirm them from the FIS Actions reference or `aws fis get-action --id <actionId>`.
- The `targets` key **inside an action** is named by the action (e.g. `Instances`, `Tasks`,
  `Pods`). It must reference a target whose `resourceType` matches the action's resource type.
- Some actions take **no parameters** (use `{}`); some require several. Don't invent parameters.
- The **target's `resourceType`** and the **action's resource type** must agree. A mismatch fails at
  create time.

### Targeting

- Prefer **tag-based** targeting (`resourceTags`). The workshop uses `FIS-Ready=True`; some scenario
  resources use `AzImpairmentPower=Ready`. Confirm the tag actually exists on the resources.
- Use `filters` to narrow to the right state (e.g. only `RUNNING` tasks/instances, a specific AZ).
- `selectionMode` controls blast radius: start small (`PERCENT(50)` or `COUNT(1)`), not `ALL`.

### emptyTargetResolutionMode

- `fail` — the experiment errors if no targets match. Use when targets must exist.
- `skip` — the action is skipped if no targets match. Use for multi-action templates where some
  actions may legitimately have no targets in a given account.

### Logging (optional but recommended)

Add a `logConfiguration` block pointing at a CloudWatch Logs group (the workshop uses an
`FISExperiments` log group). The log group ARN must match exactly, with no leading slash issues.

## After generating

Run the [validation-checklist.md](validation-checklist.md). For roles, see
[iam-and-trust-rules.md](iam-and-trust-rules.md).
