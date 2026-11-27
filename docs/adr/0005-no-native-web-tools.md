---
type: Architecture Decision Record
title: ADR 0005 — No native web tools
description: Forced deny removes native WebSearch, WebFetch; one search chain: firecrawl search (Local web stack since 2026-11-26) → agent-browser, CLI and Desktop SSH.
tags: [adr]
status: stable
---

# ADR 0005 — No native web tools: one search chain, free first

Date: 2026-11-11 · Status: accepted · Issue: #102

## Context

Native `WebFetch` already in forced deny. Native `WebSearch` stayed: ~425
calls in 41 CLI transcripts (2026-11-01..09); agents skipped rule path
`firecrawl search` → `bx` (#98, #100, #101). Native search: US-only, opaque
engine, domain allow/block only, no recency control; not operator's SearXNG on
r1 (fireup#63). `firecrawl search` fails silently: HTTP 200, empty `data.web`.
Rules named no tier after `bx` and read a dead `bx` key (422 → exit 1) as
"fix query". `bx` key reached a session only through env captured at session
or helper start: stale after rotation.

## Decision

1. **Deny bare `WebSearch`** in forced `permissions.deny`, beside `WebFetch`.
   Bare name removes tool from context, not a per-call block. One install
   reaches CLI, Desktop SSH (its Claude Code reads agent
   `~/.claude/settings.json`) and subagents (inherit parent rules; flint agents
   set no `tools`). No allow or ask entry, no managed settings, no hook.
2. **One chain, free first**, same on both surfaces. Rules:
   `rules/available_tools.md`.

   | Tier | Tool | Cost | Use |
   |---|---|---|---|
   | 0 | `ctx7` | free | library and API docs |
   | 1 | `firecrawl search` | free (r1) | default: SearXNG, DuckDuckGo fallback |
   | 2 | `sv-agent-env bx context` / `bx news` | paid, $5 free credit per month | tier 1 empty, off-topic or down; recency; domain re-rank |
   | 3 | agent-browser: Google → DuckDuckGo HTML → Bing → Brave | free, 6–8 s per engine | tier 2 key, credit or plan error |

3. **Paid key never blocks work.** Key, credit or plan error → tier 3; agent
   tells operator in final reply.
4. **`bx` through `sv-agent-env`**: sources `~/.bashrc` per call, so rotated
   key reaches running sessions with no restart.
5. **Captcha: ≤1 checkbox click, never image/audio puzzle; still blocked → next engine.** Google first = operator choice.

## Consequences

- Install test asserts `WebSearch` in forced deny: later edit cannot restore
  it silently.
- Google gave captcha on every probe from this IP (2026-11-11): tier 3
  usually pays one Google call before DuckDuckGo.
- r1 and Mac share one public IP: engine block hits tiers 1 and 3 together;
  tier 2 (API) immune. Keep Brave key valid.
- r1 runs Firecrawl `latest`: update can change ignored flags (`--tbs`,
  `--sources news`, `--country`, `--location`). Re-check `searxng.js` params
  after update.
- Tier 3 depends on result page layout; selectors can break.
- ~1,400 searches per month: tier 2 stays in free credit only while tier 1
  takes most queries.

## Gaps

- Tier 1 has no recency until fireup maps `tbs` → SearXNG `time_range`.
- Not probed: Google results (captcha), Bing date filter, Brave `tf=pm`/`tf=py`,
  `bx` credit-exhausted status (rule matches stderr text).
- Not covered: Claude Desktop Cowork (local VM) sessions, web search MCP
  servers.

## Amendment 2026-11-26 — Local web stack (silicon-valley#150)

Tier 1 moves from r1 to the silicon-valley Local web stack
([silicon-valley ADR 0005](https://github.com/siliconvalley-setup/silicon-valley/blob/main/docs/adr/0005-local-web-stack.md)).

- `firecrawl` = Search bridge `127.0.0.1:3002`. Search = Google AI Overview +
  Google + DuckDuckGo via the operator's Chromium. Walled sites read through
  it; other pages via the Page reader. `--tbs` works: tier 1 recency gap closed.
- URL source = silicon-valley agent `~/.bashrc`. `env.sh` drops the r1
  `FIRECRAWL_API_URL`; `install.sh` removes the key from settings `env`.
- New chain: `ctx7`; `firecrawl search` → browser search (Google →
  DuckDuckGo). Superseded: decision 2 tier 2, decisions 3–4. Tier 3 narrowed to
  Google → DuckDuckGo: Bing and Brave steps removed. `bx` = benchmark reference
  only, never a search step.
- Errors name cause and action. Cap, Cooldown and login wall → wait or stop,
  not the next tier.
- Pace: ≤ 20 searches per 15 min, ≤ 60 per 60 min, all users together.
- Superseded consequences: shared-IP tier 2 immunity, r1 `latest` flag drift,
  Brave key and credit budget.
- Rules text: `rules/available_tools.md` **Web** = silicon-valley spec #126
  section **Client URL and agent rules**, verbatim.
- Rollback: revert this change, then run `./install.sh`. r1 Firecrawl +
  SearXNG stay running.

## Amendment 2026-11-27 — CDP wall rule removed (owner)

- Removed: "Never read or search over CDP 9222 to pass a wall." Owner, 2026-11-27: she never set this rule; an agent wrote it.
- Removed from `rules/available_tools.md` **Web** and `skills/agent-browser/SKILL.md`. The **Web** text no longer matches silicon-valley spec #126 verbatim on this line.
- Kept: CDP 9222 only for a task the human asks in their session.

## Rollback

Remove `WebSearch` from `settings.json` `permissions.deny` and its assert in
`test/install_test.py`, then run `./install.sh`.
