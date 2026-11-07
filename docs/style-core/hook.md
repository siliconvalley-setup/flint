---
type: Component
title: Style hook (hooks/flint-style.sh)
description: POSIX-sh hook — events, output shape, ruleset resolution, registration, 8 invariants.
tags: [style-core, hook]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
---

# Style hook (`hooks/flint-style.sh`)

Delivers [ruleset](./ruleset.md). One script, 3 events. Event name from `$1` (argv), never stdin. Generic trap catalog: [hook engineering](../guides/hook-engineering.md).

## Events

| Event | Payload | Why |
|---|---|---|
| `SessionStart` | `flint.md` | load rules once per session |
| `SubagentStart` | `flint.md` | SessionStart context = parent thread only; Task subagents never see it |
| `UserPromptSubmit` | `flint-submit.md` (copy of `flint.md`, same lookup + guards) | attention anchor: one-shot injection loses to per-turn injections (caveman `3ed7b73`) |

All 3 events emit this JSON on stdout:

```json
{"hookSpecificOutput": {"hookEventName": "<the event>", "additionalContext": "<the text>"}}
```

Never raw text: `SubagentStart` silently drops raw stdout (official `/en/hooks`: "shown to the user only; Claude doesn't see it").

## Ruleset resolution

1. `/etc/claude-docs/flint.md` — baked container path, root-owned.
2. `"$(dirname "$0")/../flint.md"` — clone geometry.
3. `"$(dirname "$0")/../container-docs/flint.md"` — vmCODE vendored geometry. Keep: drop breaks vmCODE.
4. None, empty or unreadable → `FLINT HOOK ERROR: ...` as `additionalContext`, exit 0.

Paths 2–3 user-writable → symlinks refused. JSON encode via `python3`, else `python` (Git Bash often ships only that name; python2 fails encode into marker).

## Registration (`install.py`)

- No matcher (`'matcher': ''`). Empty matcher fires on `startup`, `resume`, `clear`, `compact`. Compaction prunes injected context; matcher = style dies mid-session, silent.
- Command quoted (`"<path>" <Event>`), forward slashes: survives spaces; Git Bash, native Python, Claude Code all parse it.
- Windows: Claude Code runs shell hooks via Git Bash (PowerShell fallback only). Git Bash required, one sh implementation (ADR [0002](../adr/0002-windows-git-bash-required.md)). `install.ps1` = thin validator. No PowerShell port.

## Invariants

Each = fixed upstream bug. Break one → bug returns.

1. **Exit 0 on every path.** Non-zero = failure banner every turn (caveman #538). `UserPromptSubmit` exit 2 rejects and erases user prompt. Guards: `trap '' PIPE` (EPIPE, ponytail #149), `|| :` after prints, `emit_marker` ends `exit 0`.
2. **Never read stdin.** ponytail read it, froze sessions (#443/#477). Python stage reads `head -c` pipe, not hook stdin. Test 6b: hook exits with stdin held open. Hook that waits for EOF dies at timeout (caveman #729), emits nothing; invariant 4 cannot fire.
3. **Whitelist `$1`.** Unknown → `SessionStart`. Never interpolate raw argv into payload (JSON injection).
4. **Loud marker, never silent-empty.** caveman #587: wrong relative path served stale ruleset for months. Resolution uses `-s` (not `-f`); encode exits into marker on empty input. 0-byte file, `EACCES`, delete-after-check race → marker.
5. **Refuse symlinked fallbacks.** caveman `5ad8f6d`: symlinked read injected secret-file bytes. `/etc` path root-owned; only fallbacks need `[ -L ]`.
6. **Cap read `head -c 65536`**, decode `.decode("utf-8", "replace")` (byte cap can split UTF-8; `UnicodeDecodeError` = empty context). Memory guard only; real cap = 10,000 chars output.
7. **Quote every expansion.** caveman #157: unquoted root broke users with space in home path. Applies to registered command too.
8. **POSIX sh only.** macOS `/bin/sh` (bash 3.2), Debian dash, Git Bash. No `[[ ]]`, arrays, `${var:0:5}`, GNU-only flags, `mapfile`. CI: `bash -n`, `sh -n`, `zsh -n`, shellcheck.

## Failure surfaces

- `FLINT HOOK ERROR: …` in session: hook ran, cannot deliver (`flint.md` missing/empty at every path, or `python3`/`python` absent/unusable).
- Claude Code own hook error: clone moved or deleted, registered path gone. Fix: `./install.sh` from new clone location.

## Recipes

- Edit hook: read invariants, edit, `sh test/test.sh`. Live at once (settings point at clone). Tag release for vmCODE.
- Add/remove event: `EVENTS` in `install.py` → `case` whitelist in hook → `test/install_test.py` → Events table above.
