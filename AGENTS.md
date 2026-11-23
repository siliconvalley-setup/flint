# AGENTS.md

flint = operator's Claude Code config repo + always-on style core. Every trap in linked docs = bug already shipped.

## Every task

- Procedure: [CONTRIBUTING.md](CONTRIBUTING.md). Terms: [CONTEXT.md](CONTEXT.md).
- Before ship: `sh test/test.sh` must end `ALL PASS`. CI = ubuntu/macos/windows + shellcheck.
- Docs index: [docs/index.md](docs/index.md). Code and docs disagree → code wins; fix doc in same change.

## Read before you touch

| Touch | Read first |
|---|---|
| `flint.md`, `flint-submit.md` | [ruleset](docs/style-core/ruleset.md): wording load-bearing, 10,000-char cap, edit both files |
| `hooks/flint-style.sh` | [hook](docs/style-core/hook.md): 8 invariants, no matcher, JSON on all events |
| `desktop/` | [desktop](docs/style-core/desktop.md): verbatim derivado regenerated, others re-derived by checklist |
| `install.py`, `settings*.json`, `env.sh` | [installer](docs/config/installer.md): ownership only from `.flint-state.json` |
| hook or ruleset release | [consumers](docs/config/consumers.md): tag release |
| `test/`, `.github/` | [testing](docs/testing.md): CI traps |
| `mods/`, `tools/` | [mods and tools](docs/config/tools.md) |

## Hard don'ts

- No state machinery in style core (flags, config files, slash commands, badges, off-switch text).
- No bashisms. No second hook implementation (ADR [0002](docs/adr/0002-windows-git-bash-required.md)).
- No hand-edit of `desktop/cowork/SKILL.md`.
