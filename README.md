# flint

Operator's Claude Code config in one repo — skills, agents, rules, output styles, settings policy, plugins, mods, statusline, env — laid out like `~/.claude`, applied by one idempotent `./install.sh`, plus always-on style core (ruleset [`flint.md`](flint.md) + POSIX-sh hook [`hooks/flint-style.sh`](hooks/flint-style.sh)).

macOS/Linux: full config. Windows: style core only, Git Bash required.

## Install

Needs Python 3 + git on PATH.

```sh
git clone https://github.com/siliconvalley-setup/flint.git ~/flint
cd ~/flint
./install.sh          # Windows (PowerShell): .\install.ps1
sh test/test.sh       # verify: must end ALL PASS
```

Keep clone: config dir links point at it. Uninstall: `./install.sh --uninstall`.

## Docs

[docs/index.md](docs/index.md) — OKF bundle: [style core](docs/style-core/index.md), [config](docs/config/index.md), [testing](docs/testing.md), [guides](docs/guides/index.md), [ADRs](docs/adr/index.md). Agents: [AGENTS.md](AGENTS.md).

## Credits & license

MIT. Rule "Payload verbatim" and hook invariants derive from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) and [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (both MIT); see [provenance](docs/style-core/ruleset.md#provenance-do-not-paraphrase).
