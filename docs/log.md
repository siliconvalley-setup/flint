# Update Log

## 2026-11-26
- **Local web stack cutover** (silicon-valley#150, [ADR 0005](adr/0005-no-native-web-tools.md) amendment): `env.sh` drops the r1 `FIRECRAWL_API_URL`; agent URL = silicon-valley `~/.bashrc` (`http://127.0.0.1:3002`). `rules/available_tools.md` **Web**: Route line + `### firecrawl` block = spec text; `bx` block → one benchmark-only line; browser search Google → DuckDuckGo. `toolchain-installed/browser.md` engine note, `agent-browser` reads line follow. `install_test.py`: settings `env` has no `FIRECRAWL_API_URL`; shell and drop tests use `AI_MEMORY_SERVER_URL`.

## 2026-11-24
- **CI checkout v7**: `.github/workflows/ci.yml` `actions/checkout@v4` → `@v7` (v7.0.1, runtime `node24`). Removes Node.js 20 deprecation warning. No checkout release runs on Node 26 yet.
- **rules fix + chat re-derive**: `rules/rules.md` stray `**` → markdown footnote `[^1]`; whitespace-only line removed; end-of-reply line (skipped/unchecked, risk) restored as bare rule, by owner request. `desktop/chat/project-instructions.md` `<rules>` re-derived from current `rules/rules.md` + `rules/coding.md` (tool-specific lines dropped: Explore, ctx7, Biome, git add). `style.md`, `profile.md` unchanged: prose rules not touched.
- **owner manual edits** (`f868d96`, `84b7e19`, `7b2c3c9`, `3cde351`): `rules/coding.md` = Karpathy guidelines (think, simplicity, surgical, goal-driven); `rules/rules.md` = planning block only, senior-dev block dropped; `flint-submit.md` token line softened ("when it makes sense"). Drift fixed: `flint.md` copied from `flint-submit.md` (test 12b), test 3 anchor phrase `Respond concise` → `Optimize time, tools`, `desktop/cowork/SKILL.md` resynced. Chat derivados not re-derived (as 2026-11-11).

## 2026-11-23
- **token-budget removed** ([ADR 0007](adr/0007-remove-token-budget.md), closes #46, #110): `mods/token-budget`, `tools/tb.mjs`, `skills/token-budget-report`, tb suite (test 16), `test/replay.mjs`, `test/refetch.mjs` deleted. CI drops `setup-node`. ADR 0003 deprecated.
- **output style ACF**: new `output-styles/acf.md` (TDAH + autismo: answer first, literal, short blocks, exact resume point). `settings.defaults.json` `outputStyle` `caveman` → `ACF`; `install_test.py` follows. `caveman.md` stays, selectable via `/output-style`.

## 2026-11-21
- **MAX_THINKING_TOKENS**: `env.sh` gains `MAX_THINKING_TOKENS=32000` → bash + `settings.json` `env` (CLI, Desktop). Limit: adaptive reasoning models (Opus 4.7+, Sonnet 5+, Haiku 5.5, Fable) ignore the number; it caps non-adaptive models only (e.g. `claude-omlx`).

## 2026-11-20
- **lsp astro fix**: astro server failed `initialize` ("Can't find typescript.js or tsserverlibrary.js") outside an Astro project. Cause: astro-ls resolves relative `tsdk` against cwd; flint session cwd has no `node_modules/typescript`. Wrapper `mods/lsp/bin/astro-ls-tsdk` picks cwd: project TypeScript, else global. Regression: `test/test.sh` part 15b.

## 2026-11-19
- **Claude Code channel latest**: `settings.json` `autoUpdatesChannel` `stable` → `latest`; `install_test.py`, `env.sh` comment follow. Pair: silicon-valley `sv-agent provision` installs npm `latest`.
- **closeout**: vmCODE no longer consumes flint (vmCODE #165): `consumers.md`, `AGENTS.md`, `hook.md`, `ruleset.md`, `CONTEXT.md` drop it; ADR 0001 amended. `installer.md` names cached-clone re-point.
- **org move**: flint, aviato, CLIs (bing-webmaster-cli, google-apis-cli, dataforseo-cli), fireup, meta-graph-cli, silicon-valley moved `realroboto` → `siliconvalley-setup`. Links and `external-skills.txt` follow; vmCODE, ai-memory-cli stay. `install.py` re-points a cached clone's `origin` to the listed owner before pull. Old log entries keep old names.

## 2026-11-17
- **coding rule: docs check**: `rules/coding.md` gains one paragraph after the explore step: check official docs for the used version (`ctx7` before web search), then write idiomatic code. Limit: file gate `if="you are writing or changing code"` — debug, setup, CLI tasks without code do not load it.
- **owner manual edits** (`4adeef0`, `2ff8aaa`, `9e76867`): `agents/epic-ticket.md` effort `medium` → `high`; `rules/coding.md` explore step names Explore subagent. Reviewed: no drift, tests pass.

## 2026-11-16
- **stack-sweep pnpm pin**: Toolchain step Latest reads the pin from `pnpm outdated --format json` (pnpm ≥12.17 lists `packageManager`; probe 2026-11-16: pin 12.17.0 → row `pnpm`, latest 12.21.0, exit 1). Older pin: `npm view pnpm version`.

## 2026-11-15
- **tailwind-best-practices skill**: vendored verbatim from `evilmartians/agent-skills@14cc6a4` (MIT) into `skills/tailwind-best-practices/`; frontmatter gains `metadata` (source, commit, license). Copy, not `external-skills.txt`: that repo ships 6 skills, owner wants 1. Upstream updates: recopy by hand.

## 2026-11-14
- **ai-memory rule back on, trimmed**: `rules/ai-memory.md.bkp` → `rules/ai-memory.md`. 4,701 → 892 chars: drop text the plugin already loads (server instructions, tool schemas, `ai-memory:*` skills). Keep flint policy: full tool names for `ToolSearch`, extra recall triggers, citation, precedence, CLI traps.

## 2026-11-13
- **writing_preference by task type**: `rules/writing_preference.md` drops `paths`; body in one `<important if="you are writing documents, specifications, or comments">` block, text unchanged. No rule uses `paths`; test 13h removed.
- **Rules by task type** (HumanLayer `<important if>`): `rules/rules.md` = general rules bare + planning block (best in class, owner text verbatim). `rules/coding.md` drops `paths` (probe: never loads above/beside session dir), whole body in one `<important if="you are writing or changing code">` block; gains "least new code" from `rules.md`, "simpler way to build it" push-back; vague request → plan first. Test 13g removed; 13h covers `writing_preference.md` only.
- **Manual-edit drift**: `rules/coding.md`, `writing_preference.md` `paths`: every GitHub Linguist programming/markup/data extension (1,459) minus prose ones; 1,000 in brace groups (per-rule budget), rest unbraced (not counted). `writing_preference.md` adds 42 prose extensions. Tests 13g (same code block), 13h (budget, 40,000-char on-demand cap). Probe: user-level `paths` rules load only for files under session start dir; above/beside never (`../`, absolute globs fail). Owner keeps `paths` for now. Two-phase rewrite of `rules/rules.md` + `coding.md` step 1 reverted (#121): owner text restored verbatim. `desktop/cowork/SKILL.md` resynced after `a95bc8e`. `style-core/ruleset.md` describes one-line `flint.md`.
- **marketingskills for aviato** (realroboto/aviato#87): `external-plugins.txt` gains `git coreyhaines31/marketingskills /Users/Shared/hooli/aviato`. Link `aviato/.claude/skills/marketingskills`, plugin `marketing-skills@skills-dir`, aviato only. Coupling rules live in aviato README.
- **TokenEconomizer as external plugin** (#111): `external-plugins.txt` gains `git microsoft/TokenEconomizer:plugin global`. Marketplace entry and `enabledPlugins` default leave settings; #113 reinstall path removed. `config/tools.md`, `config/installer.md` follow.
- **External plugins** (#112): new `external-plugins.txt`; each repo fetched into `.cache/plugins/<repo>/`, loaded in place. `global` → `CLAUDE_CODE_PLUGIN_DIRS`; project path → `<project>/.claude/skills/<repo>` link in state `links`. `config/installer.md` gains rows.
- **TokenEconomizer follows HEAD** (#113): every install run updates its marketplace; HEAD moved → uninstall, clean cache, install. `config/tools.md` drops manual update command.
- **Resync**: `desktop/cowork/SKILL.md` regenerated after `flint.md` header gained "Don't be lazy. Be proactive." Chat derivados unchanged (header not in them, as #106). ADR 0005 Decision 5 heading matches captcha rule.

## 2026-11-11
- **Install guard** ([ADR 0006](adr/0006-install-guard.md), #108): new `mods/install-guard` asks the human for new stacks only. `env.sh` gains `CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS=1`. Bash deny/ask rules leave forced `permissions`. `rules/available_tools.md` drops its Installs section.
- **No native web tools**: ADR 0005 added (#102). Forced deny gains `WebSearch`; install test asserts it. `rules/available_tools.md` gains search chain `firecrawl search` → `sv-agent-env bx` → browser search.
- **Rules, web search** (#100, #101, closes #98): `rules/available_tools.md` gains `firecrawl search`, then `bx` as paid fallback; #101 trims `bx` entry to facts `bx --help` lacks.
- **Rules, headless browser** (#99): project headless automation uses its framework headless shell, not full Chromium (`SIGSEGV` under parallel load). Generic `CHROME_PATH` dropped. `toolchain-installed` `browser.md`, `node.md` follow.
- **stack-sweep pnpm** (#105): global version = `cd ~ && pnpm --version`; inside a project pnpm reports `packageManager`.
- **Cowork resync** (#106): `desktop/cowork/SKILL.md` regenerated; hook head test derives from `flint.md`.
- **rg rule** (#107): `rules/available_tools.md` explains rg long-line cut and `-M0` escape.

## 2026-11-08
- **dfs skill**: `external-skills.txt` gains `git realroboto/dataforseo-cli`; install links skill `dfs` (#95). `rules/available_tools.md` gains `dfs` CLI line.
- **plan-verifier dropped**: skill and agent removed (#88). `epic-ticket` loses Gate step; flow now Read, Reconcile, Implement, Merge, Close out, Record.

## 2026-11-07
- **lsp mod**: `mods/lsp/` declares bash, astro, nix language servers (#86). Test part 15 validates every mod manifest, runs `plugin test` only for mods with hooks. `config/tools.md` gains lsp section.
- **Handoff**: ADR 0004 added; ADR 0003 amended (meter moved out). `config/tools.md` gains handoff section. CONTEXT.md gains handoff, work line, subject, meter.
- **Restructure**: Docs moved to OKF v0.2 bundle with progressive disclosure. `docs/flint.md` split into `style-core/ruleset.md`, `style-core/hook.md`, `testing.md`. `desktop/README.md` → `style-core/desktop.md`. Installer and tools sections of `README.md`/`AGENTS.md` → `config/`. Guides compressed; stale claims fixed (11-rule ruleset, hardcoded anchor, Cowork `CLAUDE.md` channel, "full prose" escape hatch).
