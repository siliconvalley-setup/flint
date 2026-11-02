# Mac env — silicon-valley agent account
You run on macOS (Apple silicon) as the `agent` user of the silicon-valley setup: no sudo, no Homebrew, no GUI session. Every tool below is on PATH there; on another Mac, check with `command -v <tool>` first. Claude config is global in `~/.claude/`, linked from the flint repo; never create per-project config.
## Paths
Nix tools: /etc/profiles/per-user/agent/bin (Node 26, Python 3.15, uv, git, gh, rg, fd, jq, ffmpeg, imagemagick and more).
npm CLIs: ~/.npm-global/bin. Node libraries: ~/.npm-global/lib/node_modules (`NODE_PATH`) — `require` them by bare name from any project; ESM `import` does not see them.
Browsers: `agent-browser` has its own Chrome for Testing (~/.agent-browser/browsers); Playwright's browsers are in ~/Library/Caches/ms-playwright. The operator's Chromium is reachable over CDP on 127.0.0.1:9222.
Skills: ~/.claude/skills/
## CLIs
Run each CLI with the Bash tool. Its login is already set up (env vars from silicon-valley secrets), unless its line says otherwise.
Package installs are blocked: `npx`, `npm install`, global `pnpm add`, `pip install`. To add a package to a project, run `pnpm add` inside the project. `pnpm dlx` asks the human first; use it only for an official CLI, for example `pnpm dlx @astrojs/upgrade`.
`rg` — ripgrep, the search tool; use it instead of `grep`, it is 2.4–3.5x faster. It skips hidden files and `.gitignore` matches by default; add `--hidden` (and `-g '!.git'`) for dotfiles.
`firecrawl` — default tool to read a web page or online docs as markdown; it runs the page's JavaScript and keeps the links. Read a page: `firecrawl scrape <url> --only-main-content`. Get named fields as JSON: `firecrawl scrape <url> --format json --schema '<json>'`. Read a whole site: `firecrawl crawl <url> --wait --limit <n>`. List a site's URLs: `firecrawl map <url>`. Output is a loading message or empty: retry once with `--wait-for 5000`; still empty, or firecrawl cannot do the job: load the **toolchain-installed** skill and read its browser section. "Connection refused": ask the human to run `fireup up` on r1 (`ssh r1`). A site blocks bots: stop and tell the human. More options: `firecrawl --help`.
`agent-browser` — controls a real browser. Read a docs page as text, with no browser window (prefers markdown and `llms.txt`): `agent-browser read <url>`; add `--filter "<text>"`, `--outline` or `--llms index` to narrow it. `read` output stops at 50,000 characters and then ends with a `[truncated…]` marker; for a large page run `agent-browser read <url> --max-output 1000000 | rg -n -i '<term>'`; a truncated read never proves a term is absent. Click through a page: `agent-browser open <url>`, then `agent-browser snapshot -i` to get `@ref` ids, then `agent-browser click @ref` or `agent-browser fill @ref "text"`; run `snapshot -i` again after every page change. Screenshot: `agent-browser screenshot [path]`. To use the human's own Chromium (logins, 2FA, cookies), load the **agent-browser** skill first.
`playwright-cli` — Playwright browser for render checks, WebKit and Playwright tests. Load the **playwright-cli** skill before the first call.
`gh` — GitHub CLI: repos, issues, PRs, releases, Actions, and any GitHub API call with `gh api`. List commands: `gh --help`. Wait for a CI run: `gh run watch <id> --exit-status --compact --interval 30` with `run_in_background: true`, and tell the human how long that run usually takes.
`ctx7` — official docs of any library, API, framework or vendor (Google, Meta, SEO, others). Find the library id: `ctx7 library <name>`. Ask its docs: `ctx7 docs <id> "<question>" --json`. More: `ctx7 --help`.
`bwt` — Bing Webmaster Tools API. Call: `bwt <Method> [--flags]`. List methods and flags: `bwt schema`.
`gapi` — Google Ads, Google Tag Manager (GTM), Google Analytics 4 (GA4), Search Console and Indexing API. Call: `gapi <api> <resource...> <method> --params '<json>'`. Load the **gapi** skill before the first call. Login error: `gapi auth status`, then the skill's Setup section.
`gcloud` — Google Cloud CLI. List commands: `gcloud --help`.
`cf` — Cloudflare API: DNS, zones, Workers, R2, KV, D1, Zero Trust. Call: `cf <group> <cmd>`. Find the command for a task: `cf cli search "<task>"` (describe the action and resource type; leave out names, domains and IDs), then `<command> --help`. API details of a command: `cf schema <cmd...>`. Cloudflare docs: `cf docs search "<question>"`. Auth, IDs, errors: load the **cloudflare-cf** skill.
`fbg` — Meta Graph API: Business Manager, Facebook Pages, Instagram, audiences, webhooks. Call: `fbg <VERB> <path> [--k=v] [--paginate]`. More: `fbg --help`.
`vultr-cli` — Vultr cloud: servers, DNS, block storage, Kubernetes. Call: `vultr-cli <resource> <verb>`. List commands: `vultr-cli --help`.
`qb` — QuickBooks CLI: QuickBooks Online (QBO), QuickBooks Desktop (QBD), QBD-to-QBO migration. Before any QuickBooks task, load the **quickbooks-epic** skill; it tells which `qb` command to run. List commands: `qb --help --json`. First use: `qb auth login`. Exit code 2, 4 or 7: stop and show the output to the human. Exit 7: ask the human for the 6-digit code from the e-mail, then run the `qb crm approve` command that the output prints.
## More help — read only when the task needs it
Image, video and VMAF quality (ffmpeg), mockups, icons, Lighthouse, `wrangler dev`, pnpm, other installed CLIs: load the **toolchain-installed** skill.
## Search Rules
- Use the Bash tool for file work: read with `cat`, `head` or `sed -n`, search with `rg`, change files with `sed`, heredocs or short scripts. Use the Read, Edit or Write tool only when Bash cannot do the job.
- Search with `rg` first. Use `ast-grep` only for a code shape that a regex cannot match.
- Find files with `rg -l`, then search only those files.
- Leave out `--vimgrep` (it costs more tokens). Add `-C N` only when you need the lines around a match.
- Read a line range when you know it; read a whole large file only when you need all of it.
