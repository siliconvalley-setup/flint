# AGENTS.md — traps for anyone (human or LLM) editing this repo

Read this before touching anything. Every trap below is a bug that already
shipped somewhere — upstream, or in this repo's own CI history.

## The two files that ARE the product

- **`flint.md` wording is load-bearing.** Many rules were benchmark-validated
  or bug-fixed upstream. Check the provenance table (`docs/flint.md` §4)
  before changing ANY existing rule — if the rule is in the table, "tightening"
  or paraphrasing it silently discards the fix. Adding a new rule is cheap;
  editing an old one needs a reason stronger than style.
- **`hooks/flint-style.sh` carries 8 invariants** (`docs/flint.md` §5), each a
  fixed upstream bug: always exit 0 · never read stdin · whitelist `$1` ·
  loud `FLINT HOOK ERROR` marker (never silent-empty) · symlink-refuse
  user-writable fallbacks · `head -c 65536` cap + `decode(...,"replace")` ·
  quote every expansion · POSIX sh only. Breaking one reintroduces the bug.
  Full trap catalog: `docs/hook-engineering.md`.

## Hard don'ts

- **No state machinery in the style core** (`flint.md` + the hook). The
  installer is the only place state lives (`.flint-state.json`, see below).
  No flag files, config files, slash commands, badges,
  or any sentence in `flint.md` phrasing an off-switch as a command. Intensity
  tiers (lite/full/ultra) and Persistence are calibration TEXT the model
  self-selects from, not state (`docs/flint.md` §7). Upstream's state machinery
  (~1,141 lines of JS) was the bug factory.
- **The ruleset's real ceiling is 10,000 CHARACTERS, not 64 KB.** Claude Code
  caps hook output strings there and past it swaps the text for a preview +
  file path — the ruleset arrives as a pointer, no error, no loud marker
  (official docs `/en/hooks`; `docs/hook-engineering.md`). Budget the JSON
  envelope, not `flint.md`: 8,802 chars of ruleset emit 9,107 on LF. NEUTRALIZED
  — `.gitattributes` pins `eol=lf` on every checkout, the Windows runner
  included, so the CRLF double-cost (each escaped `\r\n` counts twice) is
  dead as long as the pin stays; delete `.gitattributes` and Windows-only
  spend reopens, which no local LF run will catch. Against test 13a's 9,300
  guard a new rule now spends from **~193 characters**, not 58 KB.
- **No matcher on any hook registration** — the empty matcher is what re-fires
  the ruleset after compact; a matcher kills the style mid-session silently.
- **No raw stdout on SubagentStart** — silently dropped. All three events emit
  the `hookSpecificOutput` JSON shape, uniformly.
- **No bashisms.** macOS `/bin/sh` (bash 3.2), Debian dash, and Git Bash must
  all run the hook and `test/test.sh`: no `[[ ]]`, no arrays, no
  `${var:0:5}`, no GNU-only flags, no `mapfile`.
- **No second hook implementation.** Windows = Git Bash required (ADR 0002);
  `install.ps1` stays a thin validator. A PowerShell port duplicates every
  invariant — the drift between two copies is the bug class flint exists to
  kill.
- **No hand-edits to derivados.** `desktop/cowork/SKILL.md` is REGENERATED
  (header + verbatim ruleset); `desktop/chat/project-instructions.md`,
  `chat/style.md`, and `chat/profile.md` are re-derived (condensed/paraphrased)
  via the checklist in `desktop/README.md`. Ruleset changed → run the whole
  checklist, then `sh test/test.sh` (budget guards + test 14's byte parity via
  `tools/resync.py --check` enforces the one verbatim file).

## CI traps already hit in this repo (don't re-learn them)

- **Native Windows python cannot resolve Git Bash POSIX paths** — a
  `python -c 'open("/tmp/...")'` fixture works on unix runners and throws
  `FileNotFoundError` on Windows. Build test fixtures with shell tools
  (`printf`/`dd`/`tr`), pass content via pipes, not paths.
- **Never put an UNBOUNDED producer in a fixture pipeline** — `yes x | tr -d
  '\n' | head -c 5242880` hung `matrix (macos-latest)` for the full 6h Actions
  timeout on every run from 2026-07-21 to 2026-07-29, while ubuntu, Windows and
  shellcheck stayed green. The log stops after `ok  8 symlink refused`; cleanup
  reports `Terminate orphan process: pid (1237) (tr)`. The runner ignores
  `SIGPIPE` and children inherit it, so `tr` takes `EPIPE` instead of dying and
  spins on `yes` forever. A developer Mac has the default disposition and
  passes in under a second — this is CI-only. Use a bounded producer (`dd
  if=/dev/zero count=N`) so every stage reaches EOF on its own. **A 6h
  cancellation is a skipped test with no `(skipped: reason)` line printed.**
- **`env -i` is not faithful on MSYS** — stripping SYSTEMROOT breaks process
  spawning entirely, so the "interpreter missing" probe false-fails. Gate
  such probes on `uname -s` (`MINGW*|MSYS*|CYGWIN*` → skip with an `ok …
  (skipped)` line).
- **`ln -s` on Windows Git Bash may silently copy instead of symlink** — any
  symlink-behavior test must first verify `[ -L ]` actually holds and skip
  otherwise.
- **Writing "through" a leftover test symlink follows it** — a fixture that
  symlinked `/etc/hosts` must be `rm -f`'d before a later step opens the same
  path for writing.
- **`Path.home()` ignores `$HOME` on Windows** — tests that fake a home set
  both `HOME` and `USERPROFILE`; the real default branch (no
  `CLAUDE_CONFIG_DIR`) has its own test — keep it.

## Installer (`install.py`) — the config half

- **Ownership comes from `.flint-state.json` only.** Forced keys/sub-keys,
  defaults flint set (with the value), env and plugin dirs, links. Prune and
  `--uninstall` touch nothing outside it — that is what keeps the user's
  keys, a herdr hook and their own files safe. Never prune by guessing.
- **Settings are written before the network/CLI steps, and the state right
  after them.** A crash in a fetch or `claude plugin` must not leave
  settings written without the state that names them.
- **A default is flint's only while it holds flint's value.** A user edit
  makes it theirs; never overwrite it.
- **Tests fake HOME as well as CLAUDE_CONFIG_DIR, and set FLINT_OFFLINE +
  FLINT_CLAUDE_BIN** (test seams, not user switches: `--uninstall` is the
  only switch). The installer writes under HOME (ai-memory link), fetches
  into the repo's `.cache/` and calls `claude`; a test without the fakes
  touches the real machine. A test that checks a machine binary also sets
  PATH, or this machine's tools decide the result.
- **Plugins: install what is missing, never a blanket update.** ai-memory
  alone is updated, and only while older than the machine's `ai-memory`
  binary — the plugin must not run ahead of its server client. The cache
  dedupe touches flint's plugins only, and only with an install record.
- **Windows = style core only** (`FULL` gate). No links there: `ln -s` and
  Python symlinks need developer mode.

## Consumers — edits here propagate

Two kinds. vmCODE vendors `hooks/flint-style.sh` and `flint.md`
byte-for-byte at a pinned tag, with a parity check on its side.
silicon-valley clones flint on its agent account and runs
`git pull && ./install.sh` on `update`, so it takes `main` — the whole config,
not only the style core. The repo is private: a consumer needs read access.
- Keep the hook's THREE-geometry ruleset resolution (`/etc/claude-docs` →
  `../flint.md` → `../container-docs/flint.md`) — dropping the last one
  breaks the vmCODE vendored layout.
- Changed hook or ruleset → tag a release; consumers bump the pin. Never
  assume a consumer pulls `main`.
- The UserPromptSubmit anchor line is hardcoded in the hook, separate from
  `flint.md` — core-rule changes need a manual anchor re-sync (and the
  installed-clone model means users get hook changes on `git pull` with no
  re-install).

## Before shipping anything

```sh
sh test/test.sh        # must end ALL PASS — hook contract, installer seam,
                       # budgets, canary
```

CI runs the same matrix on ubuntu/macos/windows + shellcheck. The Windows
runner is the only Windows coverage this project has — never skip a test
there without a printed `(skipped: reason)` line.
