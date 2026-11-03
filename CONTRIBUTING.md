# Contributing

The procedure for every change. Run all steps in order, every session. One path — do not skip a step, do not add one, do not pick an alternative. One branch, one change, one issue.

## Steps

1. **Branch.** Start from a clean tree, then run:
   ```bash
   git checkout main && git pull --ff-only && git checkout -b <type>/<slug>
   ```
   `<type>` is a commit type (table below); `<slug>` is 2–4 dash-joined words.
   **Done when:** `git status --porcelain` was empty before you branched, and `git branch --show-current` prints your new branch, not `main`.

2. **Change.** Edit only the files the task names.
   **Done when:** the task's acceptance criteria are met and nothing outside the named files changed.

3. **Verify green.** Run both:
   ```bash
   sh test/test.sh
   python3 -I test/install_test.py
   ```
   If either fails, fix and rerun. Do not go to step 4 on a failure.
   **Done when:** `test.sh` prints `ALL PASS` and `install_test.py` prints `PASS`.

4. **Commit.** Stage each file by its explicit path (`git add <path> <path>`) — never `git add -A` or `git add .`. Then write one commit in the format below.
   **Done when:** `git log -1 --format=%s` matches `<type>(<scope>): <subject>`, and `git status --porcelain` shows nothing you did not name.

5. **Open a PR** against `main`, with the title copied from your commit subject.
   **Done when:** the PR is open and CI (`test matrix`, `shellcheck`) is green.

6. **Merge** with **Squash & merge**, delete the branch, then run `git fetch --prune`.
   **Done when:** `main` has one new commit and `git branch -r` no longer lists your branch.

## Commit format

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type** — one row from the table. Pick the one that matches the change.
- **scope** — one lowercase noun for the area touched, e.g. `skills`, `rules`, `settings`, `hooks`. Omit the `(...)` if none fits.
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
fix(hooks): stop crash on empty prompt

Co-Authored-By: <agent> <noreply@…>
Closes #12
```

```
feat(settings)!: rename the forced key

BREAKING CHANGE: what breaks and the migration path.
Co-Authored-By: <agent> <noreply@…>
```
