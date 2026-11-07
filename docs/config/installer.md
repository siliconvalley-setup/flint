---
type: Component
title: Installer (install.py)
description: What install.sh writes to the Claude config dir, ownership rules, plugins, edit loop, uninstall.
tags: [config, installer]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
---

# Installer (`install.py` via `install.sh`)

Applies config + [style hook](../style-core/hook.md) to `$CLAUDE_CONFIG_DIR` (default `~/.claude`). Idempotent. Needs Python 3 + git on PATH; npm (`@reallroboto/qb` skill) and `claude` (plugins) optional: run warns, re-run completes. Clone must stay: everything points at it. `"${FLINT}"` in settings string = clone path.

## What lands where

| Repo | Config dir |
|---|---|
| `skills/<name>/`, `agents/*.md`, `rules/*.md`, `output-styles/*.md` | one symlink each, to clone |
| `external-skills.txt` | each source fetched into `.cache/` (git or `npm pack`), its `skills/*/` linked |
| `settings.json` | **forced** keys; dict merges per sub-key, other sub-keys stay |
| `settings.defaults.json` | set only where absent (user `/model`, statusline win); `enabledPlugins` per entry |
| `env.sh` | every `export` copied into `settings.json` `env` |
| `mods/<name>/` | appended to `env.CLAUDE_CODE_PLUGIN_DIRS` |
| `statusline/` | default `statusLine` command |
| `hooks/flint-style.sh` | 3 style hooks |

Plus:
- `claude plugin install` for each enabled plugin missing. Warning names missing machine binary (`typescript-language-server`, `pyright`, `ai-memory`).
- ai-memory plugin updated only while older than `ai-memory` binary: plugin must not run ahead of its server client. No blanket update.
- One cached version per flint plugin; dedupe touches flint plugins with install record only.
- Link `<ai-memory data dir>/auth-token` → `~/.config/ai-memory-auth-token` when secret file exists. Data dir: `AI_MEMORY_DATA_DIR`, else macOS `~/Library/Application Support/ai-memory`, Linux `${XDG_DATA_HOME:-~/.local/share}/ai-memory`.

## Ownership

- `<config dir>/.flint-state.json` = only source of ownership: forced keys/sub-keys, defaults flint set (with value), env, plugin dirs, links. Prune and `--uninstall` touch nothing outside it. Never prune by guess.
- Next run removes what flint stopped shipping. User files, keys, hooks (e.g. herdr) and links never touched.
- Default = flint's only while it holds flint's value. User edit → user's. Never overwrite.
- User file where flint wants link stays; run warns.
- Write order: settings before network/CLI steps, state right after them. Crash in fetch or `claude plugin` must not leave settings without state that names them.
- Windows = style core only (`FULL_CONFIG` gate): `ln -s` and Python symlinks need developer mode.

## Edit loop

| Changed | Action |
|---|---|
| skill, agent, rule, output style, mod, statusline | none, live at once (link) |
| `settings.json`, `settings.defaults.json`, `env.sh`, `external-skills.txt` | `./install.sh` |
| other machine | `git pull && ./install.sh` |
| shell tools outside Claude | `. ~/flint/env.sh` in shell rc |

## Uninstall

`./install.sh --uninstall` (or `python3 uninstall.py`): removes exactly what flint added. Installed plugins stay. `--uninstall` = only user switch.

## Test seams

`FLINT_OFFLINE`, `FLINT_CLAUDE_BIN` = test seams, not user switches. See [testing](../testing.md#installer-tests).
