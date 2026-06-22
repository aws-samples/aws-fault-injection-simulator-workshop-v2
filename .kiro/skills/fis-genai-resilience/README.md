# fis-genai-resilience (Kiro skill)

This folder is a **Kiro Agent Skill**: a self-contained, invokable procedure that turns a
general-purpose AI assistant into a resilience-testing assistant for AWS applications. It walks you
through reviewing an application, generating testable failure hypotheses, authoring runnable AWS Fault
Injection Service (FIS) experiments, validating them, and interpreting the results.

It is the engine behind the workshop's **GenAI Resilience-Testing Assistant** capstone module, but it
is deliberately portable: copy this one folder into any project and point Kiro at it.

> **Who reads what:** `SKILL.md` is written for the *assistant* (it is the instructions Kiro follows).
> This `README.md` is written for *you*, the human, to understand what the skill is and how it loads.

## What's in here

| Path | What it is |
|------|-----------|
| `SKILL.md` | The skill itself: frontmatter (`name`, `description`) plus the phase-by-phase instructions the assistant follows. |
| `references/` | Supporting docs the assistant pulls in **only when a phase needs them** (template anatomy, the native-vs-SSM decision, IAM/trust rules, the validation checklist, etc.). |

## How Kiro loads it (why it's in `.kiro/skills/`)

Kiro CLI **auto-discovers** skills placed under `.kiro/skills/<skill-name>/` at two scopes:

- **Workspace:** `.kiro/skills/` in the project you launch Kiro from (this is where this skill lives,
  inside the cloned workshop repo).
- **Global:** `~/.kiro/skills/` in your home directory, available in every project.

For the **default agent** (what you get when you run a bare `kiro-cli`), discovery is automatic — **no
install, no registration, no flags.** Kiro reads each skill's `name` and `description` at session
start and activates the skill when your request matches the description (or when you call it as a slash
command). Reference files load lazily, only when the instructions point to them, so the skill stays
cheap on context until you actually need a given piece.

> The folder location matters: a skill in a generic `skills/` folder is **not** discovered. It must be
> under `.kiro/skills/` for Kiro to find it.

## How to use it

Launch Kiro from the repo root so the workspace skill is in scope, then invoke it:

```bash
cd ~/fis-workshop     # the cloned aws-fault-injection-simulator-workshop-v2 repo
kiro-cli
```

```text
/fis-genai-resilience
Review the PetAdoptions application for resilience and start the loop at Phase 1.
```

You can also just describe what you want ("help me find an untested failure mode and write an FIS
experiment for it") and Kiro will activate the skill based on its `description`.

## Take it home

To use this against your own application:

1. Copy this `fis-genai-resilience/` folder into your project's `.kiro/skills/` directory (or into
   `~/.kiro/skills/` to have it everywhere).
2. Launch `kiro-cli` from that project and invoke `/fis-genai-resilience`.
3. Use **read-only** AWS credentials for the review and hypothesis phases; grant write/FIS permissions
   only when you are ready to actually run an experiment, and run it in a non-production environment
   first.

## Skill vs. custom agent

This is intentionally a **skill**, not a custom agent. A skill is the right primitive for an
on-demand, portable workflow: it auto-discovers under the default agent with zero setup, and it
travels as a single folder.

You would only wrap this in a **custom agent** (`.kiro/agents/`) if you needed to pin a specific model,
attach particular MCP servers, restrict the tool allowlist, or enforce a hook/guardrail — none of
which this workflow requires. A custom agent also breaks auto-discovery: it must register the skill in
its `resources` (via a `skill://` URI) and be launched explicitly with `kiro-cli chat --agent <name>`.
If those needs ever arise, the agent would *reuse this same skill* rather than replace it, so nothing
here is throwaway.

## Editing the skill

- Keep `SKILL.md` frontmatter valid: `name` is lowercase letters/numbers/hyphens (≤64 chars) and
  `description` (≤1024 chars) is what Kiro matches against requests — make it specific.
- When you add a file to `references/`, link it from `SKILL.md` with a one-line description, and have
  the relevant phase point to it (reference files only load when the instructions direct Kiro to
  them).
