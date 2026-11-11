# Browser

- No GUI session: run every browser **headless**.
- One full Chromium: `/Applications/Chromium.app`. agent-browser, playwright-cli, Lighthouse find it through their own env vars. Never download Chrome for Testing or Playwright full Chromium.
- Project headless automation (tests, scripts, build checks) = framework headless shell. A full build headless crashes under parallel load (silicon-valley#48).
  - Playwright: `pnpm exec playwright install --only-shell chromium` (`playwright-core` package: `pnpm exec playwright-core install --only-shell chromium`). Launch without `executablePath`.
  - Puppeteer: `pnpm exec puppeteer browsers install` (pnpm skips its postinstall; env limits the download to the headless shell). Launch with `launch({ headless: 'shell' })`; plain `launch()` fails "Could not find Chrome".
- `playwright-cli`: Chromium above + Playwright WebKit.
- Display: agent-browser + playwright-cli Chromium = operator Mac built-in display (screen, viewport, DPR 2, color scheme). Screenshots 2× pixels. Need other size: agent-browser `set viewport <w> <h> [scale]`, playwright-cli `resize <w> <h>`.
- Logged-in operator session: CDP only (see Login).

## Pick tool

| Task | Tool |
|---|---|
| Interact, explore, dev server (HMR) | `agent-browser` |
| Render check, Lighthouse, WebKit | `playwright-cli` |
| Find pages | `firecrawl search`; fallback chain: `rules/available_tools.md` |
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
- Failure test and browser steps: `rules/available_tools.md`, blocks `firecrawl` and `agent-browser`.

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
