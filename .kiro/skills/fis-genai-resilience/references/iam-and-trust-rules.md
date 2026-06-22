# IAM and trust rules for FIS experiments

Every experiment needs at least one **role FIS assumes** to act on your behalf, and — for the SSM
pattern — a second role the **automation document** assumes. Generate these as least-privilege, and
**never bake in real account IDs**: use the angle-bracket placeholders (`<YOUR AWS ACCOUNT>`,
`<YOUR REGION>`, `<YOUR ROLE NAME>`).

## The two role patterns

| Pattern | Roles you generate | Trust files |
|---------|--------------------|-------------|
| **Native action** | FIS role only | `fis-iam-trust-relationship.json` |
| **SSM automation** | FIS role **and** SSM automation role | `fis-iam-trust-relationship.json` **and** `ssm-iam-trust-relationship.json` |

## Trust relationships

The FIS role must trust the FIS service principal:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "fis.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

The SSM automation role (SSM pattern only) trusts the SSM service principal — same shape, with
`Principal.Service` set to `ssm.amazonaws.com`. If the automation acts through yet another principal
(e.g. it runs commands on EC2 via `aws:runCommand`), generate that principal's trust file too.

> **Hardening (optional, recommended):** scope the trust with a `Condition` on `aws:SourceAccount`
> (your account) and, for FIS, `aws:SourceArn` of the experiment template, to prevent confused-deputy
> use. Note this in the README if you add it.

## FIS role policy — least privilege

The FIS role grants **only the fault actions this experiment performs**, scoped to the resources it
targets. Do not use `Action: "*"` or `Resource: "*"` across the board.

- **Permissions = the action's required permissions.** Each FIS action documents the IAM permissions
  it needs (see the FIS Actions reference). Grant those, nothing more. Example: an
  `aws:ecs:stop-task` experiment needs `ecs:StopTask` / `ecs:DescribeTasks` / `ecs:ListTasks`, not
  `ecs:*`.
- **Scope by the targeting tag.** Mirror your template's tag targeting with a condition so the role
  can only act on tagged resources:

```json
{
  "Effect": "Allow",
  "Action": ["<service:FaultAction>", "<service:DescribeAction>"],
  "Resource": "*",
  "Condition": { "StringEquals": { "aws:ResourceTag/FIS-Ready": "True" } }
}
```

  (Use the tag your template actually targets — the workshop uses `FIS-Ready=True`; some scenario
  resources use `AzImpairmentPower=Ready`. Not all actions support resource-tag conditions; where
  they don't, scope by resource ARN/prefix instead and say so in the README.)
- **Logging.** If the template has a `logConfiguration`, add `logs:CreateLogDelivery` /
  `logs:PutLogEvents` (or the CloudWatch Logs permissions the log destination needs).

## SSM-pattern roles (two roles, distinct jobs)

For the SSM automation pattern the work is split across two roles — keep them separate:

- **FIS role** — starts and observes the automation: `ssm:StartAutomationExecution`,
  `ssm:GetAutomationExecution`, `ssm:StopAutomationExecution`, plus **`iam:PassRole`** for the SSM
  automation role only (scope the `Resource` to that one role ARN, not `*`).
- **SSM automation role** — does the actual fault and its inverse: only the fault APIs (e.g.
  `sqs:SetQueueAttributes` to apply and remove a deny), tag-scoped, plus whatever `aws:executeScript`
  needs. It must be able to **restore** as well as apply — granting the inverse of the apply API on
  the same resources covers both directions.

## `iam:PassRole` — the common mistake

The principal that **starts** the experiment must be allowed to pass the FIS role to FIS (and, for
SSM, to pass the automation role). Scope `PassRole` to the specific role ARNs:

```json
{
  "Effect": "Allow",
  "Action": "iam:PassRole",
  "Resource": [
    "arn:aws:iam::<YOUR AWS ACCOUNT>:role/<YOUR FIS ROLE NAME>",
    "arn:aws:iam::<YOUR AWS ACCOUNT>:role/<YOUR SSM AUTOMATION ROLE NAME>"
  ]
}
```

> In the **workshop** account the ParticipantRole already grants `fis:*`, `ssm:*`, and
> `iam:CreateRole` / `iam:CreatePolicy` / `iam:AttachRolePolicy` / `iam:PassRole`, so participants can
> create and pass these roles directly. When you take this **home**, your own principal needs the same
> `iam:PassRole` (scoped) plus permission to create the roles, or have them created for you.

## Checklist

- [ ] FIS role trusts `fis.amazonaws.com`; SSM role (if any) trusts `ssm.amazonaws.com`.
- [ ] FIS policy grants only the action's documented permissions — no blanket `*`.
- [ ] Permissions are scoped by the same tag (or ARN) the template targets.
- [ ] `iam:PassRole` is scoped to the specific role ARN(s), not `*`.
- [ ] SSM automation role can both **apply and restore** the fault.
- [ ] No real account IDs / ARNs hardcoded — placeholders only.

See [fis-template-anatomy.md](fis-template-anatomy.md) for the native template,
[ssm-automation-pattern.md](ssm-automation-pattern.md) for the SSM pattern, and
[validation-checklist.md](validation-checklist.md) before running.
