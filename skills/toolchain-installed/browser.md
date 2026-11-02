# Browser automation

Each runtime brings its own browser: `agent-browser` runs its own Chrome for Testing (`~/.agent-browser/browsers/`), `playwright-cli` runs Playwright's Chromium and WebKit (`~/Library/Caches/ms-playwright/`; missing → `playwright-cli install-browser <name>`). The silicon-valley agent account has no GUI session: run both **headless**. The operator's ungoogled-chromium (`/Applications/Chromium.app`) crashes headless there; reach it only over CDP (below).

**Pick the tool:**

| Task | Tool |
|---|---|
| interactive / exploratory, or any dev server (HMR) | `agent-browser` |
| render check, Lighthouse, WebKit | `playwright-cli` stack |
| read a page or docs, no interaction | `firecrawl scrape <url>` (default) · `agent-browser read <url>` (markdown or `llms.txt` docs) · `ctx7 docs` |
| crawl a site, map its URLs, extract JSON by schema | `firecrawl` CLI (fireup engine) |
| did my edit break the layout? | `playwright-cli` screenshots at mobile 375 + desktop 1440, plus a DOM check for clipped or overflowing elements |

**`playwright-cli`** — token-efficient CLI, skill auto-loaded from `~/.claude/skills/playwright-cli/` (full reference there).
- `playwright-cli open <url>` → `type` / `press` / `check` / `click` → `screenshot`
- sessions: `-s=<name>` · `playwright-cli list` · `close-all` · `--help`
- local file: `open file:///path/file.html` — it loads straight from disk

**`agent-browser`** — drives the *rendered* UI, for verifying an interactive change, holding a long-running session, or checking an HMR update: `open` → `snapshot` (accessibility tree, every element a stable `@eN` ref) → act on a ref → **re-snapshot**. Load the version-matched workflow from the CLI itself: `agent-browser skills get core` (`--full` adds references + templates). Pre-configured — invoke directly, no `npm i -g`, no flags.
- **The re-snapshot is the evidence.** Exit status says a command ran; only the snapshot says what rendered — every claim about the UI rests on a final snapshot showing the expected state.
- **Read or interact** — markdown or `llms.txt` docs: `agent-browser read <url>` (no browser); section: `read <url> --filter "<text>"`; outline: `read <url> --outline`; docs discovery: `read <url> --llms index`. Library/framework docs: `ctx7 docs` CLI. Other pages → `firecrawl`, below.
- **Concurrency:** `--session <id>` isolates parallel sessions; `--pin-tab` when sessions share one Chrome.

**`firecrawl`** — default page and docs reader (#466). Fetches through the self-hosted fireup engine on r1 (LAN, `http://192.168.1.2:3002`): renders JS (SPA), keeps link URLs and list numbering. `agent-browser read <url>` runs no JS: on a SPA it returns the loader text; on an anti-bot site it times out.
- Read: `firecrawl scrape <url> --only-main-content`.
- Known fields: `firecrawl scrape <url> --format json --schema '<json>'`. A Haiku call through the fireup gateway; returns only schema fields — warnings outside the schema are lost. Read the markdown when the whole page matters.
- Failed read — loader text (1 line, "Loading…", "Compiling…", body under ~200 B) or empty body is a failure, not an answer. Re-run the same scrape once with `--wait-for 5000`. Still loader text → `agent-browser open` steps below (links are lost); skip the `fireup up` ask. No second retry.
- Connection refused → `agent-browser open <url>` → `wait --text "<expected text>"` (or `wait <selector>`; `networkidle` can hang) → `read` (no URL: the rendered tab) → `close`. Links are lost; tell the human and ask for `fireup up` on r1.
- `json` fails with a gateway connect error → read the markdown; ask the human for `fireup gateway start`.
- Never bypass anti-bot (stealth browser, TLS impersonation, proxy rotation): site terms rule. Blocked page → tell the human.
- Gated `web-search-researcher` keeps `agent-browser read` only (no firecrawl: the engine fetches from r1's network, outside `--allowed-domains`).

## Authentication

**Default** — `agent-browser` opens its own headless Chrome on a temp profile: no window, no personal cookies.

**Operator's Chromium over CDP** (login state, 2FA prompt, YubiKey, password-manager dialog): the operator's ungoogled-chromium listens on loopback CDP `9222` (silicon-valley: started at operator login by the `chromium-cdp` launch agent). Drive it with `--cdp 9222 --pin-tab`; the **agent-browser** skill owns this flow.

**WebKit** (Safari engine) catches iOS-Safari-only breakage: `playwright-cli open <url> --browser=webkit`. In a project: `import {webkit} from 'playwright'`.

**Dev servers (Astro/Vite/Next) and external sites:** wait on a concrete signal — `domcontentloaded` or `load` (agent-browser: `wait --load domcontentloaded`, `wait @eN`, `wait --text`). `networkidle` hangs — the HMR WebSocket never closes.
