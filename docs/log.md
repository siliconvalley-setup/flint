# Update Log

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
