---
name: progressive-disclosure
description: "Restructure the agent docs into one README.md per directory, with CLAUDE.md and AGENTS.md as symlinks to it; migrate scattered rules into it. Type it to replace a bloated root CLAUDE.md/AGENTS.md."
disable-model-invocation: true
---

# Progressive disclosure for agent docs

Turn a project's agent guidance into one document per directory, next to the code it governs, readable by every tool and by humans. Replaces a bloated root file, tool-locked rule folders, and Claude-only `CLAUDE.md` scattered without a plan.

The shape: a **canonical `README.md`** per relevant directory, with `CLAUDE.md` and `AGENTS.md` as **same-directory relative symlinks** to it. One source, three names, three readers — a human sees the rendered README in the folder view, Claude Code auto-loads the `CLAUDE.md` (and every ancestor) on demand when work touches the directory, other agents read `AGENTS.md`. Zero drift.

## Foundations

Load these before deciding what goes where:

- **Instruction budget.** The root file loads every session, whole. Past ~150–200 total instructions adherence degrades and the agent silently filters. A line earns its place only if removing it would cause a mistake — the **line test**. Aim well under 200 lines per file; fewer is read more.
- **Point, don't embed.** Reference other material with a markdown link, not an inlined copy. The agent reaches it when a branch needs it; unrelated tasks never pay for it.
- **Capability over path.** Describe what a directory does and how to act in it. A hard-coded file inventory goes stale on the next rename and then actively misleads — an enumerated path list is the anti-pattern this skill exists to retire. Point at the check or the decision that stays true, not the list that rots.
- **Minimal-but-real.** A directory doc still loads into context when work touches it. An empty stub spends load to say nothing; write one or two real lines (what lives here + a link up) or write nothing.
- **Sections agents expect.** Reuse README vocabulary — Structure, Commands, Conventions, Testing. Invented headings add friction.
- **Positive phrasing.** State the target behaviour. Reserve a prohibition for a guardrail you cannot phrase positively, and pair it with the positive.

## The procedure

Each step ends on its stated criterion. Do them in order — the prep step must land before any symlink exists.

### 1. Map the ground

List every directory, every existing agent doc (`CLAUDE.md` / `AGENTS.md` / `README.md`, noting which are already symlinks), and every scattered-rule mechanism (a `.claude/rules/` folder, path-scoped rule frontmatter, a `docs/` pile). Read the build/verify scripts and any doc-linter.
**Done when:** you can name the full doc surface and every rule that must find a home.

### 2. Classify SAFE vs RISKY (exposure)

A markdown file placed in the wrong directory can become a public URL or break the build. **Before** planning any README, find where markdown is *served* or *ingested* — this is capability discovery, not a fixed list, because it differs per framework:

- **Served as a route** — static-site generators map files under a pages/content root to URLs. A `README.md` there becomes `/README`. Check the framework's routing root and its page extensions (markdown usually counts).
- **Ingested as a content entry** — a content-collection / data loader globs markdown and validates it against a schema. A `README.md` caught by the glob loads as an entry and fails the schema → **build break**. Read the glob patterns; a `_`-prefix or a narrow base may or may not exclude a README.
- **Copied verbatim** — a `public/` / `static/` dir ships its bytes as-is; a `README.md` becomes a fetchable file.

Everything else — source dirs the framework only imports, build/script/doc dirs — is **SAFE**. A RISKY directory gets **no** `.md`; cover it from its nearest SAFE ancestor's README (the ancestor's `CLAUDE.md` auto-loads when work descends into the RISKY child).
**Done when:** every directory is SAFE or RISKY, and each RISKY one has a named SAFE ancestor covering it.

### 3. Prep the doc-linter (do this first)

If the repo has a check that validates references inside docs, symlink proliferation and mirrored external docs will trip it. Fix the check's inputs **before** creating symlinks, so the tree is never red:

- A link-checker that resolves path-shaped tokens will see the same basename (`README.md`, `CLAUDE.md`, `AGENTS.md`) multiply from one to dozens and fail bare citations as ambiguous. Find existing **bare** citations of a root-level doc and qualify or de-mark them first. (Directory-qualified citations like `src/foo/CLAUDE.md` survive — the symlink keeps that exact path.)
- Mirrors of external articles cite paths from *other* projects. Exempt the folder that holds them from the document set the checks read (the same way product-copy or generated dirs are already exempted).
**Done when:** the doc-linter runs green on the current tree, with the exemption and citation fixes committed.

### 4. Convert existing docs

For each existing subdirectory agent doc: `git mv` it to `README.md`, then create the two symlinks (see Symlink mechanics). Give the content a **line-test pass** — cut what the default already does, strip dense glyphs/prose that hurt a low-capacity reader — not a rewrite.
**Done when:** every former `CLAUDE.md` is a canonical `README.md` + two symlinks, line-test applied, no enumerated path inventory left.

### 5. Fill the SAFE tree

Add a README + two symlinks to every SAFE directory that still lacks one, down to the depth you want maintainable (a uniform "every SAFE dir" rule is the most memorable). Each is minimal-but-real.
**Done when:** every SAFE directory has the three-name doc; no RISKY directory has any.

### 6. Migrate the scattered rules

Fold each rule into the README of the directory it governs — a component-surface rule into the components README, a sub-surface rule into that sub-directory's README, a routing rule into the nearest SAFE ancestor of the routes. Trim to capability. The directory-proximity auto-load replaces the rule mechanism's path-scoping: an ancestor `CLAUDE.md` loads whenever work touches the subtree, which is the scope the old `paths:` frontmatter bought. Then delete the rule mechanism and confirm nothing in settings references it.
**Done when:** the rules folder is gone, every rule has a home, and no config points at the removed mechanism.

### 7. Verify

Run the doc-linter per commit; run the full build once before the PR. Ship in logical commits (prep → mirrors → convert → fill → migrate) on one branch.
**Done when:** the whole build is green.

## Traps

Check each against your plan every run — these are where a modularization goes wrong:

- **Exposure leak.** A `.md` under a routing/content/public root → public URL or schema-break build failure. Cure: step 2, and cover RISKY dirs from a SAFE ancestor.
- **Linter symlink collision.** Bare basename citations (`README.md`) go ambiguous once symlinks multiply the name. A root-level file has no directory to qualify with — de-mark it (drop the code span) or add an allowance. Cure: step 3, before symlinks.
- **Relative-path citation.** A doc-linter that matches inline-code paths resolves them literally — `` `../README.md` `` matches no tracked path and fails. Point to siblings/parents with **markdown links** (invisible to such a checker); reserve inline-code for real repo-root-relative paths.
- **Stub poison.** An empty placeholder README loads into context and dilutes attention. Cure: minimal-but-real (step 5).
- **Lost scope.** Deleting a path-scoped rule without a doc in (or above) that directory drops its guidance. Confirm the owning SAFE directory — or its nearest SAFE ancestor — carries it before deleting.
- **Root collapse.** Don't merge the human front-door README with the agent doc at the root. Different audiences, different budgets. Keep the root as it is (agent doc canonical + human README separate); apply the symlink model to subdirectories.
- **Unchecked island.** A dir the doc-gate exempts (product copy, mirrors) holds docs nothing validates. Keep those correct by review and note it.

## Symlink mechanics

Per SAFE directory, canonical `README.md` beside two symlinks:

```bash
cd the/dir
ln -s README.md CLAUDE.md
ln -s README.md AGENTS.md
```

- **Same-directory, relative** target (`README.md`, not a path) — so the link resolves wherever the repo is checked out, and a doc-linter resolves every name's relative links identically.
- Git tracks a symlink as its own object (mode `120000`); commit it as-is. Verify: `git ls-files -s the/dir/CLAUDE.md` shows `120000`.
- A tool reading `CLAUDE.md` follows the link and gets the README body.
- Symlinks need `git config core.symlinks true` (default on Linux/macOS). On a Windows checkout git may write plain-text files holding the target path — call it out if that platform is in scope.

## Adapting to a project

The model is framework-agnostic; the exposure rules (step 2) and the doc-linter fixes (step 3) are what change. Read the actual routing root, content globs, and doc checks before classifying — never assume a framework routes or ingests markdown the same way as the last one. If the repo has no doc-linter, skip step 3 and the linter traps entirely.
