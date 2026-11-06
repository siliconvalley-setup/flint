# flint

The operator's Claude Code configuration, in one repo: skills, agents, rules,
output style, settings policy, plugins, mods, statusline and env — laid out
like `~/.claude`, applied by one idempotent `./install.sh`. Works on any
Claude Code CLI or Desktop Code tab on macOS or Linux; Windows gets the
style core only.

It also carries the original flint **style core**: terse prose, minimal code,
always on. One plain-text ruleset ([`flint.md`](flint.md)), one POSIX-sh hook
([`hooks/flint-style.sh`](hooks/flint-style.sh)) with zero state machinery —
a near-verbatim merge of [caveman](https://github.com/JuliusBrussee/caveman)
(terse prose) and [ponytail](https://github.com/DietrichGebert/ponytail) (lazy
code); the [provenance table](docs/flint.md) maps each rule to its origin.

## Install

Requires Python 3 and git on PATH (npm for the `@reallroboto/qb` skill,
`claude` for plugins — both optional, the run warns and a re-run completes).

```sh
git clone https://github.com/realroboto/flint.git ~/flint
cd ~/flint
./install.sh          # Windows (PowerShell): .\install.ps1 — style core only
```

`$CLAUDE_CONFIG_DIR` is honored (default `~/.claude`). Don't delete the
clone: everything points at it.

| Repo | Lands in the config dir as |
|---|---|
| `skills/<name>/`, `agents/*.md`, `rules/*.md`, `output-styles/*.md` | one symlink each, to the clone |
| `external-skills.txt` | each source fetched into `.cache/` (git or `npm pack`), its `skills/*/` linked |
| `settings.json` | **forced** keys; a dict merges per sub-key, so your other sub-keys stay |
| `settings.defaults.json` | set only where absent — your `/model` pick or statusline wins; `enabledPlugins` per entry |
| `env.sh` | every `export` copied into `settings.json` `env` |
| `mods/<name>/` | appended to `env.CLAUDE_CODE_PLUGIN_DIRS` |
| `statusline/` | the default `statusLine` command |
| `hooks/flint-style.sh` | 3 style hooks (`SessionStart`, `SubagentStart`, `UserPromptSubmit`) |

Plus: `claude plugin install` for each plugin `settings.defaults.json`
enables that is missing (a warning names a missing machine binary —
`typescript-language-server`, `pyright`, `ai-memory`), the ai-memory plugin
updated while older than the `ai-memory` binary, one cached version per
flint plugin, and a link `<ai-memory data dir>/auth-token` →
`~/.config/ai-memory-auth-token` when that secret file exists. Data dir as the
binary resolves it: `AI_MEMORY_DATA_DIR`, else macOS
`~/Library/Application Support/ai-memory`, Linux
`${XDG_DATA_HOME:-~/.local/share}/ai-memory`. `"${FLINT}"` in a settings
string = the clone path.

The `token-budget` mod needs `node` >= 26 with `node:sqlite` and FTS5 on the
PATH of the Claude Code process: it runs `node tools/tb.mjs` from the clone.
Without it, the first tool result of a session shows one `TOKEN-BUDGET ERROR`
line and tool results pass unchanged. Check with `node tools/tb.mjs doctor`
(prints `ok`). See ADR 0003.

TokenEconomizer needs `python3` >= 3.10 on PATH (the run warns below that;
its hook then does nothing). Its setup comes from the `TE_*` lines in
`env.sh`. It never updates by itself. Its version stays `0.1.0`, so
Claude Code keeps the old cached code even when `installed_plugins.json`
shows the new `gitCommitSha`. To update, close every Claude session, then:
`claude plugin marketplace update tokeneconomizer && claude plugin uninstall
tokeneconomizer@tokeneconomizer && rm -rf <config dir>/plugins/cache/tokeneconomizer
&& claude plugin install tokeneconomizer@tokeneconomizer`.

### Edit loop

- Skill, agent, rule, output style, mod, statusline: edit the file. Live at
  once (it is a link).
- `settings.json`, `settings.defaults.json`, `env.sh`, `external-skills.txt`:
  edit, then `./install.sh`.
- Another machine: `git pull && ./install.sh`.
- Shell tools outside Claude: `. ~/flint/env.sh` in your shell rc.

### What is yours

`<config dir>/.flint-state.json` records what flint wrote. The next run
removes what flint stopped shipping; your own files, keys, hooks (e.g. herdr's)
and links are never touched. A default you changed stays yours. A file of
yours where flint wants a link stays — the run warns.

- **Uninstall**: `./install.sh --uninstall` (or `python3 uninstall.py`) —
  removes exactly what flint added. Installed plugins stay.
- **Verify**: `sh test/test.sh` (CI on Linux/macOS/Windows).

### Style hook failures

Failures are loud by design, never a silent stale ruleset — but they have
two surfaces. `FLINT HOOK ERROR: …` in-session means the hook ran and could
not deliver: `flint.md` missing (or empty) at every known path, or
`python3`/`python` absent or unusable (a python2 `python` fails the encode
into the same marker). A moved or deleted clone shows up as Claude Code's
own hook error instead (the registered path no longer exists) — re-run
`./install.sh` from the clone's new location to re-point it.

## Claude Desktop (Chat / Cowork / Code)

The Code tab inherits the hooks automatically. Chat and Cowork have no hook
support — [`desktop/`](desktop/README.md) ships best-effort static artifacts
(custom Style, profile instructions, Project template, Cowork skill) with
paste-in instructions and honest fidelity notes.

## The one escape hatch

There is no off mode. Ask for "full prose" in plain language and the ruleset
itself honors it — that's the only switch, and it's behavioral, not
mechanical.

## Deeper docs

- [docs/flint.md](docs/flint.md) — complete reference: provenance table,
  hook invariants, recipes, test matrix.
- [docs/hook-engineering.md](docs/hook-engineering.md) — the generic trap
  catalog for Claude Code context-injection hooks (from the upstream audits).
- [docs/ruleset-design.md](docs/ruleset-design.md) — how to write injected
  rulesets LLMs actually follow.

## Credits & license

MIT. The ruleset preserves benchmark-validated wording from
[JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) and
[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (both
MIT) — see the provenance table in [docs/flint.md](docs/flint.md) for the
rule-by-rule origins.
