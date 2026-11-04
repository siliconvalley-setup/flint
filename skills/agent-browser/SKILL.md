---
name: agent-browser
description: "Drive a real browser with the agent-browser CLI: open, snapshot, act on @refs, re-snapshot. Use to verify a rendered UI or HMR page, or share the human's macOS Chromium over CDP for 2FA/cookie logins."
allowed-tools: Bash(agent-browser:*)
---

# agent-browser

`agent-browser` drives a real browser from the CLI: `open` → `snapshot` (accessibility tree, every element a stable `@eN` ref) → act on a ref → **re-snapshot**. The re-snapshot is the evidence — exit status says a command ran, only the snapshot says what rendered.

Pre-installed and on PATH. Invoke directly — no `npm i -g`, no `agent-browser install`, no launch flags.

Load the version-matched command reference from the CLI itself:

    agent-browser skills get core          # workflow + common patterns
    agent-browser skills get core --full   # + full command reference

## Two ways to drive

| Mode | Use when | Command |
|------|----------|---------|
| **Local** | verification, HMR, exploration — the agent works alone | `agent-browser open <url>` (`/Applications/Chromium.app`, normal Chrome UA, persistent profile; rules: **toolchain-installed** browser, Login) |
| **Host CDP (shared)** | the task needs the human's real login state — 2FA, YubiKey, password-manager dialog, existing cookies | `agent-browser --cdp 9222 --pin-tab <cmd>` |

Page and docs reads → `firecrawl scrape <url>` (renders JS, keeps links). `agent-browser read <url>` only for docs that serve markdown or `llms.txt`: `--filter "<text>"` (section), `--outline` (headings), `--llms index` (docs discovery). Library/framework docs → `ctx7 docs`. Boundary and fallback → **toolchain-installed** skill (browser).

## Guided human session (host CDP)

The operator's real Chromium (ungoogled-chromium, operator account) exposes a loopback CDP port (`9222`), reachable from the agent account on the same Mac. Driving it puts the agent and the human in **one shared browser**: the human authenticates, the agent drives.

**Contract — every command:** `agent-browser --cdp 9222 --pin-tab <command>`

- `--cdp 9222` on **every** call. A one-time `connect` silently loses the binding, and later commands fall back to a throwaway local browser — no error, invisible ([#1272]).
- `--pin-tab` binds each session to its own tab. The human shares this Chrome; without it `open` navigates the human's active tab ([#1530]).

**First, confirm the port answers** (done when it prints a URL):

    agent-browser --cdp 9222 get url

Refused or reset → the shared browser is down. You cannot start it from the agent account: ask the human to quit Chromium and start it again with `--remote-debugging-port=9222` (silicon-valley: the `chromium-cdp` launch agent does this at operator login; a Chromium already running ignores the flag). Then retry.

For any login step, hand off to the human: you drive the page, they enter the credential (2FA prompt, hardware key, password manager). Match the human's viewport when layout matters: `agent-browser set viewport <w> <h>`.

## Gotchas

- **Port target is `127.0.0.1`, never `localhost`** — macOS resolves `localhost` to `::1` first, and the CDP port listens on IPv4 only (connection reset).
- **Dev servers / HMR:** `networkidle` never resolves (the HMR WebSocket stays open). Wait on `domcontentloaded`, `load`, `@eN`, or `--text`.
- **A click fails when another element covers it** (consent banner, modal). Dismiss the reported blocker, re-snapshot, then retry the ref.

[#1272]: https://github.com/vercel-labs/agent-browser/issues/1272
[#1530]: https://github.com/vercel-labs/agent-browser/issues/1530
