---
name: stack-sweep
disable-model-invocation: true
description: "Audit every JS dependency for updates: installed vs latest, read each changelog between, cross-check breaking changes against the code, return one report with a verdict each. Type it before upgrading."
---

# /stack-sweep — dependency update audit

Sweep every dependency. For each: current version vs latest, changelog read, cross-reference against codebase, verdict. Output: one consolidated report in the conversation.

## Applicability — read first

Every section below Phase 0 either always applies or names a **gate**. Gate not met, or referenced file/script absent → section **does not apply**: skip silently, zero findings, never ask, never retry. Recommendations may only cite stack Phase 0 detected — never suggest tools, configs, or fixes for a stack the project lacks.

## Phase 0 — Detect

1. **Manifest** — `package.json` at repo root (or workspace roots). None → report "no supported stack (sweep is JS-only)" and **stop**. Clean exit, no findings.
2. **Package manager by lockfile** — `pnpm-lock.yaml` → pnpm · `package-lock.json` → npm · `yarn.lock` → yarn · `bun.lock`/`bun.lockb` → bun. No lockfile → honor `packageManager` field; still nothing → npm. Use detected PM's commands in every later phase; never another PM's.
3. **Stack flags** (gates for sections below): pnpm detected? · `wrangler` or `@cloudflare/*` in lockfile? · `astro` in deps?

Completion: one line stating detected PM + active flags.

## Phase 1 — Inventory

Read `package.json`, inventory **every** dependency field: `dependencies` and `devDependencies` alike — plus `optionalDependencies`/`peerDependencies` if present. Dep is a dep regardless of declaring field; dev tooling (compilers, linters, test runners, build/deploy CLIs) ships breaking changes as readily as runtime libs, often the bulk of the manifest. Get **installed** versions — `package.json` ranges lie: `pnpm ls --depth 0` · `npm ls --depth=0` · `yarn list --depth=0` · `bun pm ls`. Build dep list: name, installed version, range. Also capture PM's own version (`<pm> --version`) and the `packageManager` field — toolchain audited by **Toolchain** section below.

Group for processing order: **core** (framework, renderer, integrations) → **runtime** (app-level libs) → **dev** (build, lint, test tooling — the `devDependencies` block). Within each group, order by coupling: dep with most imports first.

Completion: numbered list of every dep + installed version, grouped and ordered — count reconciled against manifest so **every** `dependencies` **and** `devDependencies` entry is accounted for.

## Phase 2 — Latest versions

For each dep, fetch latest published version via the npm registry API: `curl -s "https://registry.npmjs.org/<pkg>/latest"` (URL-encode scoped names: `@` → `%40`, `/` → `%2f`). Parse `version` field from JSON response.

Build delta: installed → latest. Flag: **patch**, **minor**, or **major** jump.

Completion: every dep has a `current → latest (jump type)` entry. Deps already at latest: noted, excluded from Phase 3.

## Phase 3 — Changelog read

For each dep with a delta, fetch release notes. Ordered preference:

1. `agent-browser read` the GitHub releases page (`https://github.com/<owner>/<repo>/releases`) — most structured.
2. `agent-browser read --raw` the raw CHANGELOG.md from repo (`https://raw.githubusercontent.com/<owner>/<repo>/main/CHANGELOG.md`).
3. Parse `repository.url` from registry JSON to find repo if not obvious.

Read **every release between installed and latest** — not just the latest. Extract per-release:

- Breaking changes
- Bug fixes
- New features
- Deprecations

Completion: structured summary per dep of what changed across all releases in the delta.

## Phase 4 — Cross-reference

For each change from Phase 3, determine if project affected. Method:

1. `grep -rn` the codebase for the API, function, config key, or pattern in the changelog entry.
2. Hit → read surrounding code to confirm real usage, not a comment or unrelated match.
3. Record `file:line` evidence for every affected usage.

Classify each changelog entry into one of:

- **AFFECTED** — we use the changed API/behavior; the fix/break applies to us. Cite `file:line`.
- **OPPORTUNITY** — new feature we don't use yet but could benefit from. State why, briefly.
- **IRRELEVANT** — we don't use the affected API. No further detail needed.

Skip IRRELEVANT from final report — only surface what matters.

Completion: every non-irrelevant changelog entry has a verdict with evidence.

## Phase 5 — Report

Produce a single markdown report in the conversation. Structure:

```
## Stack Sweep — <date>

### Summary
- X deps audited, Y have updates, Z findings

### Toolchain
- node / <pm> / declarations status (→ Toolchain section)

### <dep name> — current → latest (jump type)
**Findings:**
- [AFFECTED] <what changed> — `file:line` — <impact>
- [OPPORTUNITY] <new feature> — <why useful>

(repeat per dep with findings)

### Up to date
- dep1, dep2, ... (no action needed)

### Recommended actions
1. <prioritized list of what to do>
```

Order deps by severity: breaking changes first, then bug fixes that affect us, then opportunities.

Completion: report delivered. Ask user if any finding should become a GitHub issue.

## Phase 6 — Post-update verification

Run after applying updates. Gates are **discovered, not assumed**: read `scripts` in `package.json` (and CI workflows under `.github/workflows/` if present) and run the project's own gates. Tier with no matching script: skipped silently. Tiers are sequential — stop on first failure.

1. **Static** — project's `check`/`typecheck`/`lint` script(s). Must exit 0.
2. **Tests** — project's `test` script. Must exit 0.
3. **Build** — project's `build` script. Must exit 0.
4. **Runtime smoke** — only if a `preview`/`start`/`dev` script exists: start in background, wait for ready line, curl root route plus one dynamic/API route if known. Acceptable codes: 200, 301/302, 401/403 (auth-protected without cookie). Any 500 or connection refused = failure. Kill server after. If the stack rebuilds state on serve (e.g. Cloudflare workerd), run `build` once more after — schema drift can surface only on a build that follows a preview.

No scripts at all → report finding: "no verification gates defined in package.json" — run nothing, invent nothing.

Completion: discovered tiers green, or failures reported with the specific gate that broke.

## Toolchain — Node + package manager

*Gate: Phase 0 found a `package.json`.* Runs on every sweep regardless of manifest declarations.

**Node.** Installed runtime is the target — declarations follow what runs:

1. `node --version` → installed major.
2. Compare `.nvmrc` and `engines.node` against it. Align both to installed major: `.nvmrc` = `<major>`, `engines.node` = `">=<major>"`. **Create either if absent.**
3. Check current LTS (`agent-browser read --raw https://nodejs.org/dist/index.json`, first entry with `"lts"`). Installed major < current LTS → finding: "runtime behind LTS — bump the machine's Node (silicon-valley `modules/agent.nix`)". Do **not** declare beyond installed version.

**pnpm — unpinned (tracks latest).** *Gate: detected PM is pnpm.* Treat pnpm like any tool: target latest.

1. **Check** — `pnpm --version` and the `packageManager` field.
2. **Latest** — `npm view pnpm version`; cross-check `https://github.com/pnpm/pnpm/releases`. `@latest` tracks the mainline pnpm 12 (Rust CLI) line.
3. **Verdict** — below latest → update.
4. **Apply** — set the `packageManager` field to `pnpm@<latest>` (create it if absent), then `pnpm install`. No corepack: the global pnpm comes from the machine (silicon-valley `npm-cli.txt`); global pnpm below latest → finding, the human updates the machine. Confirm with `pnpm --version`.

## Cloudflare stack — workers-sdk lockstep

*Gate: `wrangler` or `@cloudflare/*` in the lockfile.* Present → read [`cloudflare.md`](cloudflare.md): workerd/miniflare **drift** check (two runtimes in tree = SQLite schema death) + bump-in-**lockstep** fix ladder. Absent → skip.

## Astro upgrade protocol

*Gate: `astro` in deps.* Present → read [`astro.md`](astro.md): upgrade-hub + `@astrojs/upgrade` protocol. Never `<pm> update astro`. Absent → skip.
