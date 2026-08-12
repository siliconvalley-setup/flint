# Contributing

The procedure for every change. Run all steps in order, every session. One path — do not skip a step, do not add one, do not pick an alternative. One branch, one change, one issue.

## Steps

1. **Branch.** Start from a clean tree, then run:
   ```bash
   git checkout master && git pull --ff-only && git checkout -b <type>/<slug>
   ```
   `<type>` is a commit type (table below); `<slug>` is 2–4 dash-joined words.
   **Done when:** `git status --porcelain` was empty before you branched, and `git branch --show-current` prints your new branch, not `master`.

2. **Change.** Edit only the files the task names.
   **Done when:** the task's acceptance criteria are met and nothing outside the named files changed.

3. **Verify green.** Run both:
   ```bash
   pnpm build
   pnpm test
   ```
   If either fails, fix and rerun. Do not go to step 4 on a failure.
   **Done when:** `pnpm build` prints 0 errors and `pnpm test` prints 0 failures.

4. **Commit.** Stage each file by its explicit path (`git add <path> <path>`) — never `git add -A` or `git add .`. Then write one commit in the format below.
   **Done when:** `git log -1 --format=%s` matches `<type>(<scope>): <subject>`, and `git status --porcelain` shows nothing you did not name.

5. **Open a PR** against `master`, with the title copied from your commit subject.
   **Done when:** the PR is open and step 3's two commands are green in CI.

6. **Merge** with **Squash & merge**, delete the branch, then run `git fetch --prune`.
   **Done when:** `master` has one new commit and `git branch -r` no longer lists your branch.

## Commit format

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type** — one row from the table. Pick the one that matches the change.
- **scope** — one lowercase noun for the area touched, e.g. `quote`, `api`. Omit the `(...)` if none fits.
- **subject** — imperative ("add", not "added"), lowercase, ≤72 chars, no trailing period.
- **body** — omit it, unless step "breaking change" below applies.
- **footer** — always add `Co-Authored-By: <agent> <noreply@…>`. If the change closes an issue, add `Closes #N`.

| Type | Use when the change is |
|---|---|
| `feat` | a new feature |
| `fix` | a bug fix |
| `refactor` | same behavior, cleaner code |
| `perf` | a speedup, same behavior |
| `docs` | docs only |
| `test` | tests only |
| `build` | the build system or deps |
| `chore` | anything else |
| `ci` | CI config |
| `style` | formatting only, no logic |
| `revert` | undoing a prior commit |

**Breaking change:** put `!` before the `:` and add a `BREAKING CHANGE: <what breaks>` footer (those two words uppercase).

### Examples

```
fix(quote): stop crash on empty email

Co-Authored-By: <agent> <noreply@…>
Closes #128
```

```
feat(api)!: rename the auth endpoint

BREAKING CHANGE: what breaks and the migration path.
Co-Authored-By: <agent> <noreply@…>
```
