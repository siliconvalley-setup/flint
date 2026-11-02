# Mac env: silicon-valley agent account
- macOS, Apple silicon, user `agent`. No sudo, no Homebrew, no GUI.
- Every tool below is on PATH. Other Mac: check `command -v <tool>` first.
- Claude config: global `~/.claude/`, linked from flint repo. Never create per-project config.

## Paths
- Nix tools: `/etc/profiles/per-user/agent/bin` (Node 26, Python 3.15, uv, git, gh, rg, fd, jq, ffmpeg, imagemagick, more).
- npm CLIs: `~/.npm-global/bin`. `ai-memory`: `~/.local/bin`.
- Node libraries: `~/.npm-global/lib/node_modules` (`NODE_PATH`). `require('<name>')` works from any project. ESM `import` fails.
- Browsers: `agent-browser` own Chrome for Testing (`~/.agent-browser/browsers`). Playwright: `~/Library/Caches/ms-playwright`. Operator Chromium: CDP `127.0.0.1:9222`.
- Skills: `~/.claude/skills/`.

## Installs
- Blocked: `npx`, `npm install`, global `pnpm add`, `pip install`.
- Project package: `pnpm add` inside project.
- `pnpm dlx`: ask human first. Official CLI only (example: `pnpm dlx @astrojs/upgrade`).

## CLIs
Run with Bash. Login ready (env vars from secrets), unless line says otherwise. Skill named first: load it before first call.

- `rg`: search; use instead of `grep`. Config adds `--hidden --glob=!.git`. 0 hits: rerun with `-uu -i` before you say "absent".
- `firecrawl`: default to read web page or docs as markdown.
  - Page: `firecrawl scrape <url> --only-main-content`
  - JSON fields: `firecrawl scrape <url> --format json --schema '<json>'`
  - Site: `firecrawl crawl <url> --wait --limit <n>`
  - URL list: `firecrawl map <url>`
  - Empty or loading output: retry once with `--wait-for 5000`. Still empty: skill **toolchain-installed**, browser section.
  - "Connection refused": ask human to run `fireup up` on r1 (`ssh r1`).
  - Site blocks bots: stop, tell human.
- `agent-browser`: real browser.
  - Read page as text: `agent-browser read <url>`. Narrow: `--filter "<text>"`, `--outline`, `--llms index`.
  - Output stops at 50,000 chars, ends `[truncated…]`. Large page: `agent-browser read <url> --max-output 1000000 | rg -n -i '<term>'`. Truncated read never proves term absent.
  - Interact: `open <url>`, `snapshot -i` (gives `@ref`), `click @ref` or `fill @ref "text"`. After each page change: `snapshot -i` again.
  - Screenshot: `agent-browser screenshot [path]`.
  - Human's Chromium (logins, 2FA, cookies): skill **agent-browser** first.
- `playwright-cli`: render checks, WebKit, Playwright tests. Skill **playwright-cli** first.
- `gh`: GitHub repos, issues, PRs, releases, Actions, `gh api`. Wait for CI: `gh run watch <id> --exit-status --compact --interval 30` with `run_in_background: true`; tell human usual run time.
- `ctx7`: official docs of any library, API, vendor. Id: `ctx7 library <name>`. Ask: `ctx7 docs <id> "<question>" --json`.
- `bwt`: Bing Webmaster API. `bwt <Method> [--flags]`. Methods: `bwt schema`.
- `gapi`: Google Ads, GTM, GA4, Search Console, Indexing API. Skill **gapi** first. `gapi <api> <resource...> <method> --params '<json>'`. Login error: `gapi auth status`, then skill Setup section.
- `gcloud`: Google Cloud. `gcloud --help`.
- `cf`: Cloudflare API (DNS, zones, Workers, R2, KV, D1, Zero Trust). `cf <group> <cmd>`. Find command: `cf cli search "<task>"` (action + resource type; no names, domains, IDs), then `<command> --help`. API detail: `cf schema <cmd...>`. Docs: `cf docs search "<question>"`. Auth, IDs, errors: skill **cloudflare-cf**.
- `fbg`: Meta Graph API (Business Manager, Pages, Instagram, audiences, webhooks). `fbg <VERB> <path> [--k=v] [--paginate]`.
- `vultr-cli`: Vultr (servers, DNS, block storage, Kubernetes). `vultr-cli <resource> <verb>`.
- `qb`: QuickBooks (QBO, QBD, QBD-to-QBO migration). Skill **quickbooks-epic** first; it picks the command. `qb --help --json`. First use: `qb auth login`. Exit 2, 4 or 7: stop, show output to human. Exit 7: ask human for 6-digit e-mail code, run printed `qb crm approve` command.
- Other CLIs, image/video/VMAF (ffmpeg), mockups, icons, Lighthouse, `wrangler dev`, pnpm: skill **toolchain-installed**.

## Search rules
- File work in Bash: read `cat`/`head`/`sed -n`, search `rg`, edit `sed`/heredoc/short script. Read/Edit/Write tools only when Bash cannot.
- `rg` first. `ast-grep` only for code shape regex cannot match.
- Find files: `rg -l`, then search only those.
- No `--vimgrep`. `-C N` only when you need context.
- Known line range: read only it. Whole large file only when you need all of it.
