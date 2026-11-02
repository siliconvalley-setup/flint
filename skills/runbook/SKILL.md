---
name: runbook
description: "Curate docs/runbook.md, a priority-sorted runbook of recurring guidance: merge, prune stale items, cap categories at 10, give items a \"Do instead\". Use every session: read and curate it before work."
---

# runbook

You maintain a per-repo markdown runbook, not a chronological log. The runbook
must be continuously curated for fast reuse in future sessions.

**This skill is always active. Every session. No trigger required.**

## Session Start: Read And Curate

First thing, every session — read `docs/runbook.md` before doing anything
else. Internalize what's there and apply it silently. Don't announce that you
read it. Just apply what you know.

Every time you read it, curate it immediately:

- Re-prioritize items by importance (highest first).
- Merge duplicates and remove stale/low-signal notes (VERY IMPORTANT).
- Keep only recurring, high-frequency guidance.
- Ensure each item contains an explicit "Do instead" action.
- Enforce category caps (top 10 per category).

If no runbook exists yet, create one at `docs/runbook.md`:

```markdown
# Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. [YYYY-MM-DD] Directive
   Do instead: concrete repeatable action.
   [Project repository name]

## Shell & Command Reliability
1. [YYYY-MM-DD] Directive
   Do instead: concrete repeatable action.
   [Project repository name]

## Domain Behavior Guardrails
1. [YYYY-MM-DD] Directive
   Do instead: concrete repeatable action.
   [Project repository name]

## User Directives
1. [YYYY-MM-DD] Directive
   Do instead: exactly follow this preference.
   [Project repository name]
```

Adapt categories to the repo, but keep category structure and priority ordering.
Do not use raw journal-style entries.

## Continuous Runbook Updates

Update during work whenever you learn something reusable.

What qualifies for inclusion:

- Frequent gotchas or surprising behavior in this repo/toolchain.
- User directives that affect repeated behavior.
- Non-obvious tactics that repeatedly work.

What does not qualify:

- One-off timeline notes.
- Verbose postmortems without reusable action.
- Pure mistake logs without "Do instead" guidance.

Entry format requirements:

- Include date added (`[YYYY-MM-DD]`).
- Include short rule title.
- Include explicit `Do instead:` line.
- Keep writing focused, brief, and extremely concise and action-oriented. Sacrifice grammar for the sake of concision.
- ≤160 chars per line, no trailing period.

## Category And Priority Policy

- Organize notes by category.
- Keep each category sorted by importance descending.
- Re-evaluate category choice and priority whenever editing.
- Maximum 10 items per category; if over 10, remove lowest-priority entries.
- Prefer fewer high-signal items over broad coverage.

## Practical Rule

Think of runbook as a live knowledge base for future execution speed and
reliability, not a history file.

## Example Entry

```markdown
1. **[2026-08-21] `rg` fails on giant expanded path lists**
   Do instead: run `rg` on directory roots or iterate files via `while IFS= read -r`
   [cbooks]

2. **[2026-08-13] @types/node held at 24.x (matches Node 24 runtime); typescript held at 6.x (TS7 by request)**
   Do instead: don't bump @types/node past runtime major; skip TS7
   [partenza]

3. **[2026-08-12] `pnpm dev` crashes once on cold `.vite` (after any install/lockfile change)**
   Do instead: just rerun `pnpm dev` — warm cache boots. Known upstream race (#16248/#17288/#17456). ⊥ chase config fix
   [crm] [cbooks] [partenza]
```