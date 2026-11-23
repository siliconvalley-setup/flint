---
type: Architecture Decision Record
title: ADR 0007 — Remove token budget
description: token-budget mod, tb CLI, report skill removed; large results go to model whole or as core preview.
tags: [adr]
status: stable
---

# ADR 0007 — Remove token budget

Date: 2026-11-23 · Status: accepted · Replaces: [ADR 0003](./0003-token-budget.md) · Issues: #46, #110

## Context

ADR 0003 added the `token-budget` mod and the `tb` CLI. They need hooks, `node` >= 26 with `node:sqlite` + FTS5, one test suite and one audit skill. ADR 0004 moved the context meter out. `env.sh` sets `CLAUDE_CODE_FORK_SUBAGENT=0`, so forks are off without the mod. Owner decided to remove the rest.

## Decision

1. Delete `mods/token-budget/`, `tools/tb.mjs`, `skills/token-budget-report/`.
2. Delete `test/tb.test.mjs` (test 16), `test/replay.mjs`, `test/refetch.mjs`. CI drops `setup-node`: no CI test needs Node (15b skips without `astro-ls`).
3. Old `tb` data (`${XDG_DATA_HOME:-~/.local/share}/flint-tb`) holds tool output, maybe secrets. No auto-purge remains. Each machine deletes it once by hand: `rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/flint-tb"`. Installer does not: it owns only paths in `.flint-state.json`.

## Consequences

- Large Read and Bash results reach the model whole, or as the core 2 KB preview. Input cost per session can go up.
- Fork guard (deny fork over 100k context) is gone. `CLAUDE_CODE_FORK_SUBAGENT=0` is the only guard.
- Claude Code needs no `node:sqlite` or FTS5.
