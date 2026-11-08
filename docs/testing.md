---
type: Procedure
title: Testing and CI
description: Test matrix, what each suite guards, installer test seams, CI traps already hit.
tags: [testing, ci]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
---

# Testing and CI

```sh
sh test/test.sh   # must end ALL PASS
```

CI: same matrix on ubuntu/macos/windows + shellcheck, `timeout-minutes: 10`. Windows runner = only Windows coverage (Git Bash path). Never skip test there without printed `(skipped: reason)` line.

## Matrix (`test/test.sh`)

| Part | Guards |
|---|---|
| hook contract | JSON per event, loud markers, empty/unreadable ruleset marker, argv whitelist, symlink refusal, 64 KB cap, EPIPE, stdin-open termination (6b), shell syntax (10x) |
| 11 installer suite (`test/install_test.py`) | registration, idempotency, re-pointing, foreign-hook preservation, no-clobber on invalid JSON, registered command run end-to-end through bash |
| 12 / 12b | per-turn anchor = `flint-submit.md`; `flint-submit.md` = `flint.md` |
| 13a–13f budgets | envelope ≤ 9,300 · profile ≤ 1,500 · project instructions ≤ 8,000 · chat style ≤ 8,000 · cowork skill ≤ 64 KB |
| 14 parity | `desktop/cowork/SKILL.md` = header + `unwrap(flint.md)` (`tools/resync.py --check`). Chat derivados not byte-checked |
| mod suites | `claude plugin validate` per `mods/*` + `claude plugin test` per mod with `hooks/hooks.json`; skipped without `claude` (CI runners: local run only) |
| tb suite | `node --test test/tb.test.mjs`; skipped when `node tools/tb.mjs doctor` fails |
| tokscan suite | `test/tokscan_test.sh`: shell-built fixture transcripts, asserts `--json` + text |

`test/replay.mjs` (offline replay) and `test/refetch.mjs` (net tokens of each saved Bash output and tb placeholder against inline whole, by size, Bash split file read / other) read private transcripts; stay out of matrix.

## Installer tests

- Fake `HOME` and `CLAUDE_CONFIG_DIR`, set `FLINT_OFFLINE` + `FLINT_CLAUDE_BIN`. Installer writes under HOME (ai-memory link), fetches into `.cache/`, calls `claude`: test without fakes touches real machine.
- Test that checks machine binary also sets `PATH`, else this machine's tools decide result.
- Fake home sets `HOME` and `USERPROFILE`: `Path.home()` ignores `$HOME` on Windows. Keep real default-branch test (no `CLAUDE_CONFIG_DIR`).

## CI traps already hit

- **Native Windows python cannot resolve Git Bash POSIX paths.** `python -c 'open("/tmp/...")'` passes on unix, `FileNotFoundError` on Windows. Build fixtures with `printf`/`dd`/`tr`; pass content by pipe, not path.
- **No unbounded producer in fixture pipeline.** `yes x | tr -d '\n' | head -c 5242880` hung `matrix (macos-latest)` for full 6h timeout, 2026-07-21 to 2026-07-29; ubuntu, Windows, shellcheck green. Log stops after `ok  8 symlink refused`; cleanup: `Terminate orphan process: pid (1237) (tr)`. Runner ignores `SIGPIPE`, children inherit: `tr` gets `EPIPE`, spins on `yes`. Dev Mac passes in < 1 s. Use bounded producer (`dd if=/dev/zero count=N`). 6h cancel = skipped test with no `(skipped: reason)` line.
- **`env -i` not faithful on MSYS.** Stripping `SYSTEMROOT` breaks process spawn; "interpreter missing" probe false-fails. Gate on `uname -s` (`MINGW*|MSYS*|CYGWIN*` → `ok … (skipped)`).
- **`ln -s` on Git Bash may copy, not link.** Symlink test checks `[ -L ]` first, else skip.
- **Write through leftover test symlink follows it.** Fixture that linked `/etc/hosts`: `rm -f` before later step opens same path for write.
