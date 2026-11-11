# Mac env: silicon-valley agent account
- User `agent`. No sudo, no Homebrew, no GUI.
- All tools below on PATH; other Mac: `command -v <tool>` first.
- Claude config: global `~/.claude/`, linked from flint repo. Never per-project.
- CLIs: logged in unless noted; bold skill name = load before first call.
- Big output → file, then `rg`/`jq`; never print raw pages/JSON (630 KB seen).

## Toolchain
- Runtimes: Node 26, Python 3.15 (PyYAML), uv, Java 21.
- Data: jq, yq/xq/tomlq (jq syntax on YAML/XML/TOML), duckdb (SQL over CSV/JSON/Parquet), sqlite3, jc (CLI output → JSON), pdftotext.
- Code: shellcheck, shfmt, sd (replace), difft, scc, hyperfine, fd, tree.
- Git: git, git-absorb. mergiraf = automatic merge driver, never call.
- LSP: typescript-language-server, pyright, bash-language-server, astro-ls, nixd.
- Node libs: `NODE_PATH=~/.npm-global/lib/node_modules`; `require('<name>')` works from any project, ESM `import` fails.
- Browsers: one full Chromium `/Applications/Chromium.app` for agent-browser, playwright-cli, Lighthouse. Project Playwright/Puppeteer: own headless shell, never `executablePath` to Chromium.app (install: skill **toolchain-installed**). WebKit: `~/Library/Caches/ms-playwright`. Operator Chromium session: CDP `127.0.0.1:9222`.

## Installs
- Blocked: `npx`, `npm install`, global `pnpm add`, `pip install`. Project deps: `pnpm add` inside the project.
- `pnpm dlx`: ask human first; official CLIs only (`pnpm dlx @astrojs/upgrade`).

## Files & code
- Bash first: read `cat`/`head`/`sed -n`, search `rg`, edit `sed`/heredoc/short script. Read/Edit/Write tools only when Bash cannot.
- `rg`, not `grep`. Config: `--hidden --glob=!.git --smart-case --max-columns=150 --max-columns-preview`. `[... omitted end of long line]` = rg cut, not line end; full line needed → `-M0`, that file only. Single-quote pattern/globs; `-F` literal; `-e` leading `-`.
- No lookaround/backrefs → `-P` (check: `rg --pcre2-version`) or reword; `-U` cross-line. Exit 1 = 0 hits; 2 = error → never "absent" on 2.
- Scope `-t`/`-g` (`--type-list`); many hits: `-l` first, then per-file. Piped output lacks line numbers: `-n`. `-c` = lines, `--count-matches` = hits.
- 0 hits ≠ absent: rerun `-uu -i` (ignored+hidden; `-g '!node_modules'` if huge); then `-L` (symlinks), `--binary` (NUL files), `-E utf-16le` (no BOM). `--files`/`--debug` reveal filtering. Explicit file arg bypasses ignores.
- No `--vimgrep` (quadratic output); `-C N` only when needed.
- `ast-grep` only for code shapes `rg` regex cannot match.

## Web
Native `WebSearch`/`WebFetch` removed. Route: docs → `ctx7`; find pages → `firecrawl search` → `bx` → browser search; known URL → `firecrawl scrape`.

### ctx7 — official docs (any library, API, vendor)
One step: `ctx7 search "<query>"`. Or `ctx7 library <name>` → id (`/` prefix required: `/vercel/next.js`) → `ctx7 docs <id> "<question>" --json`.

### firecrawl — web pages
Quote URLs. `scrape`/`batch-scrape` always `--wait-for 5000` (`crawl`/`map`/`search`: no such flag).
- Find: `firecrawl search "<query>" --limit <n>`; domains: `site:<d>` / `-site:<d>` in query. Recent → `bx news` (engine ignores `--tbs`, `--sources news`, `--country`, `--location`; `--categories` untested).
- Search + read: add `--scrape --scrape-formats markdown --json -o /tmp/fc-search.json`.
- Page text: `firecrawl scrape "<url>" --only-main-content --wait-for 5000 -o /tmp/fc-<site>.md`.
- Fields / one answer (prices, versions, specs): `firecrawl scrape "<url>" --format markdown,json --schema '<json>' --wait-for 5000 -o /tmp/fc-<site>.json` → `jq .json <file>`. Schema = `title` + short fields; one question = one `answer` field; no full-text arrays (output length sets runtime). Doubtful value: `jq -r .markdown <file> | rg -n -F '<value>'`.
- Whole site: `firecrawl crawl "<url>" --wait --limit <n>`; URL list: `firecrawl map "<url>" [--search "<term>"]`. Reddit URLs: strip `?…` first.
- Failures (no retry): search = `data.web` empty/missing (HTTP 200) or off-topic → `bx`. Scrape = empty `title`, loader/bot text ("Loading…", "Compiling…", "Making sure you're not a bot"), all fields empty, or markdown < ~200 B → browser steps.
- "Connection refused": search → `bx`, other commands → browser steps; ask human `fireup up` on r1 (`ssh r1`). JSON gateway error: use Page text mode; ask human `fireup gateway start`.

### bx — Brave Search API
$5 free credit/mo, then human-funded prepaid. Prefix all calls: `sv-agent-env` (loads key); key never in argv, never `bx config set-key`. `context`, `news` only (`answers`: plan not bought).
- `sv-agent-env bx context "<query>" --max-tokens <n>`; recent: `sv-agent-env bx news "<query>" --freshness pd|pw|pm|py`. Domain: one of `--include-site`, `--exclude-site`, `--goggles`.
- Exit 2 (no API key), 3, or 1 naming token/subscription/quota/credit/plan → no retry; browser search; tell human in final reply. Exit 4/5 → retry once (4: after 2 s). Other 1 → fix query.

### agent-browser — real browser
Browser steps = one Bash call, own session (default profile locked):
```bash
export AGENT_BROWSER_SESSION=web AGENT_BROWSER_PROFILE=/tmp/ab-web
agent-browser open "<url>" && agent-browser wait 5000 && agent-browser read --max-output 1000000 > /tmp/fc-<site>.txt
agent-browser close
```
Then `rg` the file. Parallel runs: `web2`, `/tmp/ab-web2`.
- `wait 5000` after every `open`; first `open` fails `ERR_NAME_NOT_RESOLVED` → `open` once more. Known target: `wait --text "<s>"` / `--fn "<cond>"` beats fixed sleep; never `--load networkidle` (SSE/polling never idle).
- Never `read "<url>"`: plain HTTP fetch, no Chrome (SPA → empty/loader). No-URL `read` = rendered active tab.
- Interact: `snapshot -i` → `click @ref` / `fill @ref "text"`; refs die on page change → re-snapshot. Click fails `covered by <el>` (consent banner): dismiss el, re-snapshot, retry.
- Screenshot: `agent-browser screenshot [path]` (`--full` = whole page).
- Human's Chromium (logins, 2FA, cookies): skill **agent-browser**.
- Search: `<q>` = `jq -rn --arg q '<query>' '$q|@uri'`. Order: `https://www.google.com/search?q=<q>` → `https://html.duckduckgo.com/html/?q=<q>` → `https://www.bing.com/search?q=<q>` → `https://search.brave.com/search?q=<q>`.
  - Captcha: ≤1 checkbox click, never image/audio puzzles. Blocked/error/0 hits → next engine; stop at first results; no retries, no revisit.
  - Recent: Brave `&tf=pd|pw|pm|py`; Google `&tbs=qdr:d|w|m|y`; DDG `&df=d|w|m|y`; Bing `&filters=ex1:"ez1"|"ez2"|"ez3"`.
  - Result URLs (`read` drops links): `eval` before `close`. DDG: `a.result__a` → `uddg` param, URL-decode. Bing: `li.b_algo h2 a` → `u` param minus `a1`, base64url-decode (pad `=`). Brave: `a[href^="http"]` minus Brave hosts.

### playwright-cli
Render checks, WebKit, Playwright tests. Skill **playwright-cli**.

## Other CLIs
- `gh` — wait for CI: `gh run watch <id> --exit-status --compact --interval 30` with `run_in_background: true`; tell human usual run time.
- `bwt` — Bing Webmaster: `bwt <Method> [--flags]`; methods: `bwt schema`.
- `gapi` — Google Ads, GTM, GA4, Search Console, Indexing. Skill **gapi**. `gapi <api> <resource...> <method> --params '<json>'`. Login error: `gapi auth status`, then skill Setup.
- `gcloud` — Google Cloud.
- `cf` — Cloudflare (DNS, zones, Workers, R2, KV, D1, Zero Trust): `cf <group> <cmd>`. Find: `cf cli search "<task>"` (action + resource type; no names/domains/IDs) → `<command> --help`. Detail: `cf schema <cmd...>`; docs: `cf docs search "<question>"`. Auth/IDs/errors: skill **cloudflare-cf**.
- `dfs` — DataForSEO (SERP, keywords, backlinks, Labs, on-page, content, merchant, AI optimization). Skill **dfs**; commands: `dfs --help`. Creds from env (`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`), no login. Exit 4 = cost guard refused: stop, show output to human; never raise `--max-cost` unasked.
- `fbg` — Meta Graph (Business Manager, Pages, Instagram, audiences, webhooks): `fbg <VERB> <path> [--k=v] [--paginate]`.
- `vultr-cli` — Vultr (servers, DNS, block storage, Kubernetes): `vultr-cli <resource> <verb>`.
- `qb` — QuickBooks (QBO, QBD, QBD-to-QBO migration). Skill **quickbooks-epic** picks the command; `qb --help --json`. First use: `qb auth login`. Exit 2/4/7: stop, show output to human; 7: ask human for 6-digit e-mail code, run printed `qb crm approve`.
- Anything else — image/video/VMAF (ffmpeg), mockups, icons, Lighthouse, `wrangler dev`, pnpm: skill **toolchain-installed**.
