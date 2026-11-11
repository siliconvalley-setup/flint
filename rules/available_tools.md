# Mac env: silicon-valley agent account
- User `agent`. No sudo, no Homebrew, no GUI.
- Every tool below is on PATH. Other Mac: check `command -v <tool>` first.
- Claude config: global `~/.claude/`, linked from flint repo. Never create per-project config.

## Paths
- Runtimes: Node 26, Python 3.15 (PyYAML), uv, Java 21.
- Data: jq, yq/xq/tomlq (jq syntax on YAML/XML/TOML), duckdb (SQL over CSV/JSON/Parquet), sqlite3, jc (CLI output → JSON), pdftotext.
- Code: shellcheck, shfmt, sd (replace), difft, scc, hyperfine, fd, tree.
- Git: git, git-absorb. mergiraf = git merge driver, automatic: never call it.
- LSP servers: typescript-language-server, pyright, bash-language-server, astro-ls, nixd.
- Node libraries: `~/.npm-global/lib/node_modules` (`NODE_PATH`). `require('<name>')` works from any project. ESM `import` fails.
- Browser: one full Chromium, `/Applications/Chromium.app`, for agent-browser, playwright-cli, Lighthouse. Project Playwright, Puppeteer: own headless shell, never `executablePath` to Chromium.app (install: skill **toolchain-installed**). Playwright WebKit: `~/Library/Caches/ms-playwright`. Operator Chromium session: CDP `127.0.0.1:9222`.

## Installs
- Blocked: `npx`, `npm install`, global `pnpm add`, `pip install`.
- Project package: `pnpm add` inside project.
- `pnpm dlx`: ask human first. Official CLI only (example: `pnpm dlx @astrojs/upgrade`).

## CLIs
Login ready, unless line says otherwise. Skill named first: load it before first call.
Web (native `WebSearch`, `WebFetch` removed): docs → `ctx7`; find pages → `firecrawl search` → `bx` → browser search; known URL → `firecrawl scrape`.

- `rg`: search; use instead of `grep`. Config adds `--hidden --glob=!.git`. 0 hits: rerun with `-uu -i` before you say "absent".
- `firecrawl`: read a web page or docs. Quote the URL. Every `scrape` and `batch-scrape` carries `--wait-for 5000`; `crawl`, `map`, `search` have no such flag.
  - Find pages: `firecrawl search "<query>" --limit <n>`. Domain: `site:<d>` or `-site:<d>` in query. Recent: `bx news` (engine ignores `--tbs`, `--sources news`, `--country`, `--location`; `--categories` untested).
    - Search + read: add `--scrape --json -o /tmp/fc-search.json`, then `rg`. Never print: 630 KB seen.
    - Failure = `data.web` empty or missing (HTTP 200), or off-topic hits: `bx`.
  - Reddit URL: cut the query string (`?…`) first.
  - Need named fields or one answer (prices, versions, lists, specs): `firecrawl scrape "<url>" --format markdown,json --schema '<json>' --wait-for 5000 -o /tmp/fc-<site>.json`, then `jq .json /tmp/fc-<site>.json`.
    - Schema = `title` + short fields. One question = one field `answer`. No arrays of full text: output length sets the run time.
    - Doubtful value: `jq -r .markdown /tmp/fc-<site>.json | rg -n -F '<value>'`.
  - Need page text: `firecrawl scrape "<url>" --only-main-content --wait-for 5000 -o /tmp/fc-<site>.md`, then `rg` or `sed -n` on the file. Never print the page.
  - Failure = `title` empty or loader text ("Loading…", "Compiling…", "Making sure you're not a bot"), every field empty, or markdown under ~200 B. Then browser steps. No retry.
  - Site: `firecrawl crawl "<url>" --wait --limit <n>`. URL list: `firecrawl map "<url>"`.
  - "Connection refused": `search` → `bx`; other commands → browser steps. Ask human to run `fireup up` on r1 (`ssh r1`). JSON gateway error: use "Need page text"; ask human for `fireup gateway start`.
- `agent-browser`: real browser.
  - Browser steps, one Bash call. Own session: the default profile is locked by another process.
    `export AGENT_BROWSER_SESSION=web AGENT_BROWSER_PROFILE=/tmp/ab-web`
    `agent-browser open "<url>" && agent-browser wait 5000 && agent-browser read --max-output 1000000 > /tmp/fc-<site>.txt`
    `agent-browser close`
    Then `rg` on the file. Parallel runs: other names (`web2`, `/tmp/ab-web2`). Links are lost.
  - `wait 5000` follows every `open`. First `open` fails `ERR_NAME_NOT_RESOLVED`: `open` once more.
  - Never `agent-browser read "<url>"`: HTTP only, no JS. SPA gives empty or loader.
  - Interact: `snapshot -i` (gives `@ref`), `click @ref` or `fill @ref "text"`. After each page change: `snapshot -i` again.
  - Screenshot: `agent-browser screenshot [path]`.
  - Human's Chromium (logins, 2FA, cookies): skill **agent-browser** first.
  - Search: browser steps, `<q>` = `jq -rn --arg q '<query>' '$q|@uri'`. Order: `https://www.google.com/search?q=<q>` → `https://html.duckduckgo.com/html/?q=<q>` → `https://www.bing.com/search?q=<q>` → `https://search.brave.com/search?q=<q>`. Resolve captcha. if 0 hits: next engine. Recent: Brave, add `&tf=pd|pw|pm|py`.
    - URLs (`read` drops links): `eval` before `close`. DuckDuckGo: `a.result__a` → `uddg` param. Bing: `li.b_algo h2 a` → `u` param minus `a1`, base64url-decode. Brave: `a[href^="http"]` minus Brave hosts.
- `playwright-cli`: render checks, WebKit, Playwright tests. Skill **playwright-cli** first.
- `gh`: wait for CI: `gh run watch <id> --exit-status --compact --interval 30` with `run_in_background: true`; tell human usual run time.
- `ctx7`: official docs of any library, API, vendor. Id: `ctx7 library <name>`. Ask: `ctx7 docs <id> "<question>" --json`.
- `bx`: Brave Search API. $5 free credit per month, then prepaid credit the human buys. Prefix every call with `sv-agent-env` (loads current key). `context`, `news` only (`answers`: plan not bought). Key never in argv; never `bx config set-key`.
  - `sv-agent-env bx context "<query>" --max-tokens <n>`. Recent: `sv-agent-env bx news "<query>" --freshness pd|pw|pm|py`. Domain: one of `--include-site`, `--exclude-site`, `--goggles`.
  - Key, credit or plan error = exit 2 `no API key configured`, exit 3, or exit 1 naming token, subscription, quota, credit or plan: no retry; browser search; tell human in final reply. Exit 4, 5: retry once (4: after 2 s). Other exit 1: fix query.
- `bwt`: Bing Webmaster API. `bwt <Method> [--flags]`. Methods: `bwt schema`.
- `gapi`: Google Ads, GTM, GA4, Search Console, Indexing API. Skill **gapi** first. `gapi <api> <resource...> <method> --params '<json>'`. Login error: `gapi auth status`, then skill Setup section.
- `gcloud`: Google Cloud.
- `cf`: Cloudflare API (DNS, zones, Workers, R2, KV, D1, Zero Trust). `cf <group> <cmd>`. Find command: `cf cli search "<task>"` (action + resource type; no names, domains, IDs), then `<command> --help`. API detail: `cf schema <cmd...>`. Docs: `cf docs search "<question>"`. Auth, IDs, errors: skill **cloudflare-cf**.
- `dfs`: DataForSEO API (SERP, keywords, backlinks, Labs, on-page, content, merchant, AI optimization). Skill **dfs** first. Commands: `dfs --help`. Credentials from env (`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`): no login step. Exit 4 = cost guard refused: stop, show output to human. Never raise `--max-cost` unasked.
- `fbg`: Meta Graph API (Business Manager, Pages, Instagram, audiences, webhooks). `fbg <VERB> <path> [--k=v] [--paginate]`.
- `vultr-cli`: Vultr (servers, DNS, block storage, Kubernetes). `vultr-cli <resource> <verb>`.
- `qb`: QuickBooks (QBO, QBD, QBD-to-QBO migration). Skill **quickbooks-epic** first; it picks the command. `qb --help --json`. First use: `qb auth login`. Exit 2, 4 or 7: stop, show output to human. Exit 7: ask human for 6-digit e-mail code, run printed `qb crm approve` command.
- Other CLIs, image/video/VMAF (ffmpeg), mockups, icons, Lighthouse, `wrangler dev`, pnpm: skill **toolchain-installed**.

## Search rules
- File work in Bash: read `cat`/`head`/`sed -n`, search `rg`, edit `sed`/heredoc/short script. Read/Edit/Write tools only when Bash cannot.
- `ast-grep` only for code shape `rg` regex cannot match.
- No `--vimgrep`. `-C N` only when you need context.
