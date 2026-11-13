# Update Log

## 2026-11-13
- **TokenEconomizer follows HEAD** (#113): every install run updates its marketplace; HEAD moved → uninstall, clean cache, install. `config/tools.md` drops manual update command.

## 2026-11-11
- **Install guard** ([ADR 0006](adr/0006-install-guard.md), #108): new `mods/install-guard` asks the human for new stacks only. `env.sh` gains `CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS=1`. Bash deny/ask rules leave forced `permissions`. `rules/available_tools.md` drops its Installs section.
- **No native web tools**: ADR 0005 added (#102). Forced deny gains `WebSearch`; install test asserts it. `rules/available_tools.md` gains search chain `firecrawl search` → `sv-agent-env bx` → browser search.

## 2026-11-08
- **dfs skill**: `external-skills.txt` gains `git realroboto/dataforseo-cli`; install links skill `dfs` (#95). `rules/available_tools.md` gains `dfs` CLI line.
- **plan-verifier dropped**: skill and agent removed (#88). `epic-ticket` loses Gate step; flow now Read, Reconcile, Implement, Merge, Close out, Record.

## 2026-11-07
- **lsp mod**: `mods/lsp/` declares bash, astro, nix language servers (#86). Test part 15 validates every mod manifest, runs `plugin test` only for mods with hooks. `config/tools.md` gains lsp section.
- **Handoff**: ADR 0004 added; ADR 0003 amended (meter moved out). `config/tools.md` gains handoff section. CONTEXT.md gains handoff, work line, subject, meter.
- **Restructure**: Docs moved to OKF v0.2 bundle with progressive disclosure. `docs/flint.md` split into `style-core/ruleset.md`, `style-core/hook.md`, `testing.md`. `desktop/README.md` → `style-core/desktop.md`. Installer and tools sections of `README.md`/`AGENTS.md` → `config/`. Guides compressed; stale claims fixed (11-rule ruleset, hardcoded anchor, Cowork `CLAUDE.md` channel, "full prose" escape hatch).
