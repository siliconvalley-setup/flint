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

## Alternatives rejected

| Option | Reason |
|---|---|
| Shell-output proxy (rtk) | Third-party A/B: −5% to +13% on the bill |
| API proxy (headroom) | Can break the prompt cache |
| context-mode | ELv2 licence; its own 120-session A/B shows +11% USD |
| Image downscaling | Claude Code already resizes images |
| Same-agent re-read dedupe | Read already has `file_unchanged` |
| Embeddings and entities | No evidence of gain; entities overlap ai-memory |
