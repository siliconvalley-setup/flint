# Astro upgrade protocol

*Reached from `SKILL.md` when gate holds: `astro` in deps.*

Update Astro only via this protocol: `pnpm dlx @astrojs/upgrade` or `pnpm add astro@<N>`, never a bare `<pm> update astro`. Both run free under install-guard. Steps:

1. `agent-browser read` the upgrade hub at `https://docs.astro.build/en/upgrade-astro/` — mandatory. Follow sublink for target major version (`https://docs.astro.build/en/guides/upgrade-to/v<major>/`).
2. Read same via `ctx7 library astro` → `ctx7 docs <id> "<query>" --json` (Bash) for cross-check.
3. Cross-reference breaking changes from guides against codebase before running upgrade.
4. Run `pnpm dlx @astrojs/upgrade` — official CLI handles Astro + all `@astrojs/*` integrations together, resolves peer deps, runs codemods.
