---
name: closeout
description: "Reconcile the project record with the checkout: sweep session junk, update docs, CLAUDE.md, ADRs, fix stales, commit per CONTRIBUTING.md. Use at session end, after an epic ticket, or before handoff."
---

# closeout — reconcile the record with the checkout

Run at the end of a work session. Make the project's written record match what the code now **is**, clear the session's junk, and leave the tree clean and committed.

Three words carry the work: the **footprint** is everything this session touched or produced; a **stale** is prose describing a world the checkout no longer matches; the **snapshot** is the current state of the checkout. Skip any step whose artifacts the project lacks (no ADRs, no README) — do not invent them.

## 1. Map the footprint

Enumerate everything this session touched or produced: `git status`, `git diff --stat` against the session's start, and untracked paths. Classify each path **keep** (real work) or **junk** (scratch file, temp dir, debug print, commented-out block, failed experiment left behind).

Completion: every changed and untracked path is classified keep or junk — none unaccounted for.

## 2. Sweep junk

Remove the junk you produced this session — throwaway files, scratch dirs, debug output — and the imports, variables, and functions your own kept changes orphaned. Leave pre-existing dead code alone unless the task named it.

Completion: `git status` shows only intended work; no session scratch remains in the tree.

## 3. Reconcile docs with the snapshot with ASD-STE100 Simplified Technical English

For every behavior, interface, flag, or file your kept changes altered, find the prose that describes it and make it match the checkout: READMEs, module and architecture docs, subdirectory `CLAUDE.md` / `AGENTS.md`, and code comments and docstrings. Grep the changed symbol names across docs to find every describer.

Reconciling is **subtractive**, not just additive: an agent-facing doc loads on every turn against a finite instruction budget, so prune the line that stopped being relevant instead of appending beside it, prefer describing a stable **capability** over a file path that will move, and link to a doc rather than repeat it inline. Keep each file ruthlessly small.

When a file has grown past ruthlessly-small and trimming alone won't fix it, **progressively disclose**: extract each topic section into its own child doc and leave a conversational pointer in place ("For TypeScript conventions, see `docs/TYPESCRIPT.md`"), so the section loads only when relevant. Create the nested structure if none exists yet — child docs cross-link and may point at external references:

```
docs/
├── TYPESCRIPT.md   → references TESTING.md
├── TESTING.md      → references the test runners
└── BUILD.md        → references the build config
```

Completion: every changed symbol's documentation is verified against the current code — no doc still describes the old behavior.

## 4. Amend ADRs

For each decision this session changed, amend the existing ADR in place to reflect the current state and note the superseded reasoning — do not stack a new ADR unless the decision is genuinely new.

Completion: no ADR contradicts the snapshot.

## 5. Hunt stales

Beyond what you changed: scan the docs you passed through this session for stales. A stale is **context poisoning** — a doc naming a moved path or a removed behavior misleads every future agent with full confidence, so a wrong line is worse than no line. Fix each stale you can substantiate against the code; list the rest for the user rather than guessing.

Completion: every stale found is fixed or listed.

## 6. Commit

Check for the repo's own contribution procedure first — a `CONTRIBUTING.md`, a commit-convention section in its `AGENTS.md`/`CLAUDE.md`. Found one: it is the source of truth over every default below, including ones it doesn't spell out for this exact situation — branch-per-change granularity, message format, and whether a push or a PR follows the commit all bind here, not just the ones it states outright. Don't split a documented single-branch step back out into a "pragmatic" shortcut, and don't invent an exception it doesn't state.

No documented procedure found: one commit covering the whole footprint, message in en-US, plain `git commit` — no push, no PR, unless asked.

Completion: tree clean, every change committed under the winning procedure.

Close by reporting: stales you could not fix, and any error or warning surfaced during the run.
