---
type: Architecture Decision Record
title: ADR 0006 — Install guard
description: No Bash, Edit or Read permission rules; install-guard mod asks the human for new stacks only; EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS on in CLI.
tags: [adr]
status: stable
---

# ADR 0006 — Install guard: soft gate on new installs

Date: 2026-11-11 · Status: accepted · Issue: #108

## Context

- Operator wants `CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS=1` in agent CLI and SSH `bash -c` sessions.
- Claude Code reads the var from process env only, v2.1.311+; settings `env` ignores it.
- These turn the var off ([permission modes](https://code.claude.com/docs/en/permission-modes#why-the-critical-path-removal-prompt-stays-on)):
  - a deny or ask rule on Bash, Edit or Read;
  - `blockReadsOutsideWorkingDirectories`;
  - a `PermissionRequest` hook or mod;
  - Desktop app, VS Code panel, nested `claude`.
- Measured 2026-11-11: `Bash(npx *)` deny alone → off. A `PreToolUse` hook or mod `tool.call` hook → on.
- Forced `permissions` held 86 Bash deny rules and 1 ask rule. They blocked maintenance (`npx <dev dep>`, Astro upgrade) and missed `env npx`.
- Operator wants: ask for new stacks only, never for maintenance; soft, never stall the agent.

## Decision

1. `env.sh` exports the var. Agent `~/.bashrc` sources it: CLI and SSH `bash -c` get it.
2. Forced settings hold no item of the var-off list. Install test asserts each.
3. Mod `mods/install-guard`, `tool.call` hook on Bash. Text pipeline: drop heredoc bodies → piped-script check → mask quoted separators → drop comments and redirects → split → shift prefixes and flags → track `cd` → verdict.
4. Verdicts:
   - free: lockfile installs, updates, removals, scripts, local paths, other commands;
   - project-dep check: new deps, runners (`npx`, `dlx`, `uvx`), `astro add`;
     - dep = `package.json` key, `node_modules/.bin` entry, or word in `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`;
     - search runs from command dir up to `/`;
   - global-exists check: `-g`, `uv tool install`, `pipx install`; free when install dir exists;
   - always ask: scaffolders, system and toolchain installs, piped install scripts.
5. Ask = deny with reason: keep working, ask human in reply, after yes rerun the segment with prefix `FLINT_INSTALL_OK=1`. Prefix approves its own segment only.
6. Deny text teaches the rule. No rule file repeats it.

## Limits

- Desktop app sessions ignore the var (docs). No workaround. Live check not run: agent account has no GUI.
- Dangerous `rm` commands run with no prompt in main sessions. Subagents keep the check.
- Text classifier, not a shell parser: installs inside scripts, `bash -c` or `xargs` run ungated. Courtesy gate, not a security boundary.
- Agent can type the prefix without a yes. No technical stop.
- On doubt, the command runs. A hook that throws is skipped (fail-open).
