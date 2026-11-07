---
type: Guide
title: Hook engineering — trap catalog
description: Generic traps for Claude Code context-injection hooks, each mapped to a shipped upstream bug.
tags: [guide, hooks]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
sources:
  - id: caveman
    resource: https://github.com/JuliusBrussee/caveman
    title: caveman commit history (252 commits, audited 2026-07)
  - id: ponytail
    resource: https://github.com/DietrichGebert/ponytail
    title: ponytail commit history (206 commits, audited 2026-07)
  - id: cc-hooks
    resource: "Claude Code official docs, page /en/hooks"
    title: Claude Code hooks reference
---

# Hook engineering — trap catalog

Generic. Every rule = bug somebody shipped and fixed.[^caveman][^ponytail] flint applies it in [style hook](../style-core/hook.md). Text side: [ruleset design](./ruleset-design.md).

## Event semantics

- **SessionStart context = parent thread only.** Task subagents never see it; register `SubagentStart` too (ponytail #252). Main-only content: deliberately no `SubagentStart`.
- **SubagentStart drops raw stdout silently.** Needs `{"hookSpecificOutput":{"hookEventName":...,"additionalContext":...}}`. Use JSON on all events.[^cc-hooks]
- **Output > 10,000 chars → preview + file path.**[^cc-hooks] Not truncation, not error: oversize ruleset arrives as pointer, no loud marker fires (markers cover missing file only). Budget whole JSON envelope. Escaped `\r\n` costs double on CRLF checkout: pin `eol=lf` in `.gitattributes`. Script read cap (invariant 7) = different, looser guard.
- **Compaction prunes injected context.** SessionStart must re-fire on `compact` (caveman `80a317e`). Empty matcher `''` = catch-all. Neither upstream tuned matcher in 450+ commits.
- **One-shot injection loses to per-turn injections** (caveman `3ed7b73`). Upstream pattern: full ruleset at SessionStart/SubagentStart + one short static anchor at UserPromptSubmit. flint deviates since 2026-11-03: anchor = full copy (`flint-submit.md`).
- **Full rules with examples anchor better than summaries** (caveman `80a317e`: "The old 2-sentence summary was too weak — models drifted back").
- **Hooks run under non-interactive `/bin/sh`.** PATH narrower than login shell (`node: command not found` on nvm/Nix). Guard each interpreter: `command -v X || <loud marker>`.
- **UserPromptSubmit exit 2 rejects and erases user prompt.**[^cc-hooks]

## Script invariants

1. **Exit 0 every path.** Non-zero = banner every turn (caveman #538). `trap '' PIPE` + `|| :` after prints (EPIPE crashed ponytail #149/#152).
2. **Never read stdin.** ponytail read payload, `stdin 'end' never fires` froze sessions (#443/#477). Params from argv: one script, N events, name in `$1`, default for legacy registrations. Waiting on EOF = same bug, slow: caveman #729 measured 48 of 2,076 `UserPromptSubmit` runs killed at timeout (2.3% vs 0.4% sibling without stdin). Killed hook emits no marker. Test termination with stdin held open, apart from EPIPE case. Must read payload → act on first complete parse, release stdin, do not exit outright (stdout truncates).
3. **Loud marker, never silent-empty.** caveman #587: wrong relative path served stale ruleset for months; #592: missing binary coerced to success. Emit `<NAME> HOOK ERROR: ...` as `additionalContext`. File baked into image: build-time `[ -s file ]` beats runtime fallback.
4. **Whitelist `$1`** before hand-built JSON (injection).
5. **Quote every expansion.** caveman #157: unquoted root broke space-in-home users (`Cannot find module '/Users/Tyler'`).
6. **Symlink-refuse user-writable read paths.** caveman `5ad8f6d`: symlinked flag file injected secret bytes. Root-owned baked paths exempt.
7. **Cap reads** (`head -c 65536`), decode `errors="replace"`: byte cap can split UTF-8; `UnicodeDecodeError` = empty context.
8. **POSIX sh over node/deps.** Node hooks broke on ESM/CJS (`"type": "module"` in ancestor `package.json` → `require is not defined`, caveman `b50aa6d`) and Windows exec. sh + guarded python-for-JSON: none of these; Git Bash runs it unchanged.
9. **No hand-synced copies.** Register source file path (flint registers clone absolute path). Copies go stale silently (installed plugin seen 35 commits behind; marketplace clones never auto-update).
10. **Old-artifact guard when script gains argv behavior.** New args against old deployed script → wrong behavior. Gate registration on deployed script having new behavior.

## Plugin vs hook vs skill

| Shape | Use for |
|---|---|
| plugin/marketplace | distribution to third parties with versioned installs. Own always-on use: overhead (clone drift, bootstrap, state). caveman+ponytail: ~1,141 lines JS, only job state = bug factory |
| hook + plain text file | always-on instruction injection. Fixed point deletes classes: trigger misfires (caveman #598), mode filters swallowing bullets (ponytail #571, twice), arg-parse clobber (#314), flag-file attack surface |
| skill | on-demand procedures. Model-invoked, non-deterministic load: wrong for always-on |

## Process

Before write or replace of plugin/hook: clone upstream repos with full history, mine `git log` for fixed bugs. Two parallel research agents (one per repo, new design as audit criterion) gave ~30 findings in minutes. First flint draft violated 7.

[^caveman]: caveman commit history
[^ponytail]: ponytail commit history
[^cc-hooks]: Claude Code hooks reference
