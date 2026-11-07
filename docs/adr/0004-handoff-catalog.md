---
type: Architecture Decision Record
title: ADR 0004 — Handoff catalog
description: Standalone handoff mod + /handoff skill; one doc per work line under the config dir; meter 250k/300k; no ai-memory.
tags: [adr]
status: stable
---

# ADR 0004 — Handoff catalog: one doc per work line, outside the repo, no ai-memory

Date: 2026-11-07 · Status: accepted · Issue: #70

## Context

Owner restarts long sessions and loses work state. Before: token-budget mod
meter warned at 150k and ordered an ai-memory handoff at 200k
(`memory_handoff_begin`); `/handoff` skill wrote one loose file to the OS temp
dir, with no session id, no catalog and no update, and only the user could
call it. Reboot deleted the file; each restart made a new one. Much work is
business research, not code.

## Decision

1. **Own mod, own skill.** `handoff` mod holds the context meter (warn 250k,
   order 300k) and a SessionStart line naming the count of open handoffs.
   `/handoff` skill writes, lists and resumes; agent can call it. token-budget
   keeps placeholders and fork guard only.
2. **No ai-memory dependency.** Mod and skill name no ai-memory tool; ai-memory
   hooks keep their own capture.
3. **Store under the config dir, per working dir.**
   `${CLAUDE_CONFIG_DIR:-~/.claude}/handoffs/<dir-slug>/`, dir-slug = working
   dir with each non-alphanumeric char as `-` (Claude Code `projects/` rule).
   Survives reboot, stays out of the repo, works without git.
4. **Key = work line, not session.** Resume adds the session id to the doc's
   `sessions`; that session's next `/handoff` rewrites the same file as current
   state plus one History line. Unlinked session with a matching subject asks
   "update or new".
5. **Owner closes.** `status: done` only after the owner says the work line is
   done. Nothing deleted.

## Consequences

- 300k order reachable only on a 1M window: on a 200k window autocompact
  comes first.
- Same repo in two paths = two lists.
- Two sessions on one handoff: last write wins unless the skill sees a newer
  `updated` and merges first (skill rule, not enforced).
- Doc quality (1000-2000 words, sources with `file:line`) rests on the skill
  text; only the mod has automated tests.

## Alternatives rejected

| Option | Reason |
|---|---|
| ai-memory `memory_handoff_begin` | External plugin; single-use handoff, no update per work line |
| One file per session id | Resumed session gets a new id: duplicates per work line |
| Store in `$TMPDIR` | Reboot deletes it |
| Store in repo `.handoffs/` | Dirties repo; research dirs often have no repo |
| Mod writes doc via model completion over transcript | Loses live intent; agent knows open questions and sources |
| Skill named `/resume` | Collides with Claude Code built-in session picker |
