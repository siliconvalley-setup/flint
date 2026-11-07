---
type: Component
title: Mods and tools
description: token-budget mod, handoff mod, sleep-guard mod, TokenEconomizer plugin, tokscan cost report — requirements and use.
tags: [config, mods, tools]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
---

# Mods and tools

## token-budget (`mods/token-budget/` + `tools/tb.mjs`)

Section index + placeholders for large Read results and Bash output Claude Code saved past its window, fork guard. Decision + amendments: ADR [0003](../adr/0003-token-budget.md).

- Needs `node` >= 26 with `node:sqlite` + FTS5 on PATH of Claude Code process. Runs `node tools/tb.mjs` from clone (not on PATH).
- Missing → first tool result shows one `TOKEN-BUDGET ERROR` line; results pass unchanged.
- Check: `node tools/tb.mjs doctor` prints `ok`.
- Shape by content: diff → outline per file; markdown (strict for Bash output: headings at column 0 with blank lines around, first inside 40 lines; loose for `.md` paths) → outline per heading; else head, tail, intent hits. Every placeholder ends with one copy-ready `tb get` and one `whole: Read …` that passes the mod. Output of a `tb.mjs` command never gets a placeholder.

## handoff (`mods/handoff/` + `skills/handoff/`)

Context meter + handoff catalog. Decision: ADR [0004](../adr/0004-handoff-catalog.md).

- Meter: main-thread context past 250k → one warning; past 300k → one order to run `/handoff`. Once per upward crossing; drop or compaction re-arms.
- Session start (not compaction): one line `N open handoffs for this directory: run /handoff list`, only when N > 0.
- Store: `${CLAUDE_CONFIG_DIR:-~/.claude}/handoffs/<working dir, non-alphanumeric → ->/`. One `.md` per work line; `status: open` in frontmatter counts.
- Skill: `/handoff` write or update, `/handoff list [--all]`, `/handoff resume [words|nº]`.
- Missing store or unreadable file → no line, no error. Store that cannot be listed → runtime skips hook and shows the error.

## sleep-guard (`mods/sleep-guard/`)

Wait and stop rules on Bash calls, main conversation and every subagent. Decision lives in vmCODE `docs/adr/sleep-guard.md`.

## TokenEconomizer (plugin)

- Needs `python3` >= 3.10 on PATH; below that run warns, hook does nothing.
- Setup from `TE_*` lines in `env.sh`.
- Never self-updates. Version stays `0.1.0`, so Claude Code keeps old cached code even when `installed_plugins.json` shows new `gitCommitSha`. Update: close every Claude session, then:

```sh
claude plugin marketplace update tokeneconomizer && claude plugin uninstall tokeneconomizer@tokeneconomizer && rm -rf <config dir>/plugins/cache/tokeneconomizer && claude plugin install tokeneconomizer@tokeneconomizer
```

## Cost report (`tools/tokscan.py`)

```sh
python3 -I tools/tokscan.py 2026-11-06
```

- Prints per day: totals per token kind, weighted cost (units of base input price; model ratios from pricing page) + USD, row per session, top subagents, tool use per category, Bash per program, largest tool results, files read 3+ times per session.
- Range `A..B` (local dates). `--compare A..B C..D` = deltas. `--json` = same data. `--no-prompts` hides prompt/input previews.
- Reads `$CLAUDE_CONFIG_DIR` (or `~/.claude`) only, sends nothing.
- Claude Code deletes transcripts after `cleanupPeriodDays` (default 30): run baseline compare before.
