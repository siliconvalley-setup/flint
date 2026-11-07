---
type: Architecture Decision Record
title: ADR 0003 — Token budget
description: Placeholders for large tool results before storage; tb CLI in clone, not MCP; fail open, loudly.
tags: [adr]
status: stable
---

# ADR 0003 — Token budget: placeholders before storage, tb CLI in the clone

Date: 2026-11-06 · Status: accepted · Issue: #46

## Context

One day of agent-account transcripts (2026-11-06) showed that input is the
cost: long contexts that every turn reads again, and large tool results that
stay in them. One 48k-char ticket was read ~33 times by many agents; `sed`,
`cat` and `wc` gave ~46% of all Bash output; one fork inherited ~490k tokens.
Output style does not reach this cost.

## Decision

1. **Rewrite once, before storage; never touch the prefix.** The
   `token-budget` mod rewrites an eligible Read or Bash result in `tool.call`,
   after `next(e)` and before core stores it. It never changes stored rows,
   tool definitions or system-prompt sections: a change to the cached prefix
   mid-session turns a 0.05× cache read into a 1.25–2× cache write. The same
   bytes and intent always give the same placeholder bytes.
2. **A CLI through Bash, not an MCP server.** `tb` adds no tool schema and no
   always-on instruction; each placeholder prints the exact command. An MCP
   server costs every session and subagent its schema (context-mode measured
   +1.2–2k prefix tokens).
3. **`tb` lives in the clone, not on PATH.** `tools/tb.mjs`, called by
   absolute path. The installer has no PATH or bin support, and does not
   change.
4. **Fail open, loudly.** A `tb` failure passes the original result. A failed
   `tb doctor` at session start shows one `TOKEN-BUDGET ERROR` line, and
   placeholders stay off for that session.

## Consequences

- Each large result costs one Node start (~50 ms).
- Placeholders change agent behavior: a placeholder that causes 2 more turns
  at 200k context costs more than it saves. Watch turns per task.
- `node` >= 26 with `node:sqlite` and FTS5 must be on the PATH of the Claude
  Code process. silicon-valley provides and checks it.
- Windows (Git Bash) uses the same path logic, untested; the mod fails open.
- Stored Bash outputs stay out of the shared index, so the 24 h purge
  removes every copy (tool output may hold secrets). `find` searches files
  only, and a stored output's hint has no `search:` part.
- `put` also takes `--session <id>` (not in #46's contract), so `stats` can
  report per session.
- Amended 2026-11-06 (#52). Bash read the agent bounded passes whole: every
  statement but `cd`, `echo`, `wc` pipes through `head`, `tail` (not `-f`) or
  `sed -n`. Transcripts 2026-11-06: 12 of 16 Bash placeholders hit such
  reads, 9 of 12 fetched same lines again within 3 calls. Replay of 225
  transcripts: bytes saved 6.56 MB → 4.84 MB; refetch already gave back most
  of difference, at one more turn each. Superseded 2026-11-07 by
  [#46](https://github.com/realroboto/flint/issues/46) (last amendment below): Bash inside window passes whole, any command; past
  window bounded read gets placeholder too.
- Amended 2026-11-06 (#52). `tb get <ref>` without `#<id>` or range reads
  all. `get` output stays below Bash window (`BASH_MAX_OUTPUT_LENGTH`, flint
  10000); last line `more:` names next range. Past window, Claude Code saved
  output to file, and Read of that file got second placeholder.
- Read of Claude Code `tool-results/` file keeps placeholder: outline is the
  cheap way into large output (#52 option 3a rejected). Superseded in part
  2026-11-06 by [#57](https://github.com/realroboto/flint/issues/57) (second
  amendment below): file of bounded Bash read passes whole. Superseded
  2026-11-06 by [#62](https://github.com/realroboto/flint/issues/62) (last
  amendment below).
- Amended 2026-11-06 (#57). Trigger 4096 B → 16384 B, Read and Bash. Bash
  output under Bash window (10,000 chars) already shows whole. Transcripts
  after #54: 16/16 Bash placeholders (4.4–9.4 KB) and 4/6 Read placeholders
  under 16 KB fetched same bytes again. In flint env Bash branch rarely
  fires: output past window is persisted, and persisted output passes.
  Replay of 585 transcripts: bytes saved 12.63 MB → 6.86 MB; refetch already
  gave back most of difference, at one more turn each. Bash part superseded
  2026-11-07 by [#46](https://github.com/realroboto/flint/issues/46) (last
  amendment below): branch never fired.
- Amended 2026-11-06 (#57). Read of file Claude Code persisted for bounded
  Bash read passes whole: agent asked for every line. Mod keeps those paths
  per session. Persisted output of unbounded command keeps placeholder on
  Read: 18 of 23 unranged `tool-results/` Reads, 10–60 KB each, so skip for
  every `tool-results/` Read (#57 option 1) rejected. Superseded 2026-11-06
  by [#62](https://github.com/realroboto/flint/issues/62) (last amendment
  below).
- Amended 2026-11-06 (#60). Read with `allow_large: true` passes whole, like
  `offset`/`limit`: agent asked for whole file in call. #57 comment
  6700117702: such Read got placeholder, then agent fetched same lines again.
- Amended 2026-11-06 (#62). Read of any file under `tool-results/` passes
  whole, whatever command made it. Outline ranges point at saved file, not
  source, and Edit needs source path: after placeholder, 6 of 8 agents left
  saved file and read source again. Direct Read placeholder: 7 of 11 used
  outline. 4 measured cases: agent fetched 65–124% of bytes again in 3–4
  more calls; placeholder cost more input tokens than whole file in all 4.
  Replay of 616 transcripts: bytes saved 6.60 MB → 6.25 MB, before refetch.
  Risk not measured: large logs and test output, main context near 150k.
- Amended 2026-11-07 (#46 follow-up). Bash placeholder takes place of core
  preview of saved output. 16384 B trigger sat above Bash window: at
  `tool.call` core already saved every stdout past 10,000 chars
  (`persistedOutputPath` set, `stdout` cut to window), and saved output
  passed. Bash branch never fired. Transcripts 2026-11-07 02:48Z–19:30Z:
  0 Bash placeholders, 16 Read; 37 whole Reads of `tool-results/` put 893 KB
  in context. Now Bash eligible = output core saved: mod reads saved file
  (`$.fs.read`), pipes it to `tb put` (stored output, out of shared index,
  24 h purge), drops persisted fields, so core
  shows placeholder inline, not its 2 KB preview. Placeholder of window size
  or more, or failed read: core preview stays. Output inside window passes
  whole, any command (`bounded()` removed). Read of `tool-results/` stays
  whole (#62): now second ask, after placeholder. Replay, 24 h: 279 saved
  outputs, 191 placeholders; model-visible bytes 589,713 B (core preview) →
  672,839 B. Gain only when agent then reads less than whole saved file.
  Measure: whole `tool-results/` Reads per saved output (before: 32 of 163).
  Same shape as context-mode "Externalize" row (host output over cap,
  indexed whole, 98.3% saved in its bench).
- Amended 2026-11-07 (#74, #75, #76). Transcripts 2026-11-07 (24 h, `test/refetch.mjs`):
  101 placeholders, 41 on `git diff`, 24 on code via `cat`, 27 on markdown; agents
  fetched 1,253 KB of 1,919 KB original back within 3 calls, `tb get` used after
  26; headroom's detector order has no markdown class and a diff class
  (`content_detector.rs`). Now `put` decides shape by the text's own evidence:
  unified diff (git header or `---`/`+++` pair) → outline per file, `+n -m` in the
  title; markdown → outline per heading, strict when the text has no markdown name
  (Bash and stored output: heading at column 0, blank line before and after, first
  inside 40 lines, so `#` comments, diff context and code pasted before a doc fail);
  else excerpt. Every hint names one copy-ready part (`get '<ref>#<largest own
  text>'`) and one whole read that passes the mod (`whole: Read <saved file>`, or
  `Read <path> with allow_large`): a wrong placeholder costs one call, never a range
  walk. A Bash command that runs `tb.mjs` keeps its output (#74 stacked case).
  `get` pages by bytes, as core counts (#76). Rejected: SubagentStart instruction
  line (fixed cost per subagent, story 3); Bash code-file exemption by command
  parsing (whole read line gives the same one call); one threshold for Read and
  Bash (#75 option 2a: between 10 and 16 KB the placeholder costs the same one call
  as core's preview). Measure after: `test/refetch.mjs` next3 against orig per kind.
- Amended 2026-11-07 (#70). Context meter (warning 150k, ai-memory handoff
  order 200k) left token-budget mod. Meter part Superseded 2026-11-07 by
  [ADR 0004](./0004-handoff-catalog.md): handoff mod, 250k/300k, order runs
  `/handoff`. token-budget keeps placeholders and fork guard.

## Alternatives rejected

| Option | Reason |
|---|---|
| Shell-output proxy (rtk) | Third-party A/B: −5% to +13% on the bill |
| API proxy (headroom) | Can break the prompt cache |
| context-mode | ELv2 licence; its own 120-session A/B shows +11% USD |
| Image downscaling | Claude Code already resizes images |
| Same-agent re-read dedupe | Read already has `file_unchanged` |
| Embeddings and entities | No evidence of gain; entities overlap ai-memory |
