# Browser

- No GUI session: run every browser **headless**.
- One Chromium: `/Applications/Chromium.app` (`$CHROME_PATH`). agent-browser, playwright-cli, Lighthouse, Puppeteer read it from env. Never download Chrome for Testing or Playwright Chromium.
- `playwright-cli`: Chromium above + Playwright WebKit.
- Logged-in operator session: CDP only (see Login).

## Pick tool

| Task | Tool |
|---|---|
| Interact, explore, dev server (HMR) | `agent-browser` |
| Render check, Lighthouse, WebKit | `playwright-cli` |
| Read page | `firecrawl scrape <url>` |
| Read markdown or `llms.txt` docs | `agent-browser read <url>` |
| Library docs | `ctx7 docs` |
| Crawl site, list URLs, JSON by schema | `firecrawl` |
| Layout broken after edit? | `playwright-cli` screenshots at 375 + 1440 wide, plus DOM check for clipped or overflowing elements |

## playwright-cli
- Load skill **playwright-cli** first.
- Flow: `open <url>`, then `type` / `press` / `check` / `click`, then `screenshot`.
- Sessions: `-s=<name>`, `list`, `close-all`.
- Local file: `open file:///path/file.html`.

## agent-browser
- Flow: `open`, `snapshot` (each element gets `@eN`), act on ref, `snapshot` again.
- Final snapshot is the proof. Exit code proves only that command ran.
- Full workflow for this version: `agent-browser skills get core` (`--full` adds references).
- Parallel sessions: `--session <id>`. Sessions share one Chrome: add `--pin-tab`.
- `read` runs no JavaScript: SPA gives loader text; anti-bot site times out. Use `firecrawl`.

## firecrawl fallbacks
Engine: fireup on r1 (`http://192.168.1.2:3002`). Renders JavaScript, keeps links.
- Failure = loader text ("Loading…", "Compiling…", 1 line, body under ~200 B) or empty body. Never treat it as answer.
- Failure: rerun once with `--wait-for 5000`. Still failure: browser steps below. No second retry.
- Browser steps: `agent-browser open <url>`, `wait --text "<expected text>"` (or `wait <selector>`), `read` (no URL), `close`. Links are lost.
- "Connection refused": browser steps, then tell human links are lost and ask for `fireup up` on r1.
- `--format json` returns only schema fields; warnings outside schema are lost. Whole page matters: read markdown.
- `json` gateway connect error: read markdown; ask human for `fireup gateway start`.
- Subagent `web-search-researcher`: `agent-browser read` only (firecrawl fetches outside `--allowed-domains`).

## Login
- Default `agent-browser`: persistent profile `~/.agent-browser/profile`. Cookies, localStorage, IndexedDB stay across `close` and restarts.
- Over SSH (Claude Desktop): `close` drops cookies younger than ~30 s. After a login, wait 30 s before `close`. UA = normal Chrome, `navigator.webdriver` false.
- One session per profile. Parallel session: add `--profile <own dir>` (same dir → `exit code: 21`).
- Logins, 2FA, YubiKey, password manager: operator Chromium on CDP `9222`. Use `--cdp 9222 --pin-tab`. Skill **agent-browser** owns this flow.

## WebKit
- Safari-only bugs: `playwright-cli open <url> --browser=webkit`.
- In project: `import {webkit} from 'playwright'`.

## Dev servers and slow sites
- Wait for `domcontentloaded` or `load`. agent-browser: `wait --load domcontentloaded`, `wait @eN`, `wait --text`.
- Never wait for `networkidle`: HMR WebSocket keeps it open forever.
