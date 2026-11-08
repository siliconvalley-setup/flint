# Update Log

## 2026-11-08
- **plan-verifier dropped**: skill and agent removed (#88). `epic-ticket` loses Gate step; flow now Read, Reconcile, Implement, Merge, Close out, Record.

## 2026-11-07
- **lsp mod**: `mods/lsp/` declares bash, astro, nix language servers (#86). Test part 15 validates every mod manifest, runs `plugin test` only for mods with hooks. `config/tools.md` gains lsp section.
- **Handoff**: ADR 0004 added; ADR 0003 amended (meter moved out). `config/tools.md` gains handoff section. CONTEXT.md gains handoff, work line, subject, meter.
- **Restructure**: Docs moved to OKF v0.2 bundle with progressive disclosure. `docs/flint.md` split into `style-core/ruleset.md`, `style-core/hook.md`, `testing.md`. `desktop/README.md` → `style-core/desktop.md`. Installer and tools sections of `README.md`/`AGENTS.md` → `config/`. Guides compressed; stale claims fixed (11-rule ruleset, hardcoded anchor, Cowork `CLAUDE.md` channel, "full prose" escape hatch).
