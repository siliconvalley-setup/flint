---
type: Component
title: Consumers
description: Systems that use flint (vmCODE, silicon-valley), how changes reach them, release rule.
tags: [config, consumers, release]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
---

# Consumers

Edits here propagate. Repo private: consumer needs read access. Decision: ADR [0001](../adr/0001-extraction-and-vendored-pin.md).

| Consumer | Takes | Update path |
|---|---|---|
| [vmCODE](https://github.com/realroboto/vmCODE) | `hooks/flint-style.sh` + `flint.md` only, byte-for-byte at pinned tag (`scripts/flint-style.sh` + `container-docs/flint.md`, pin in its `versions.yml`); baked to `/usr/local/bin/flint-style.sh` + `/etc/claude-docs/flint.md`; parity check on its side | ref-bump + rebuild |
| silicon-valley | whole config, `main`; clone on agent account | `git pull && ./install.sh` on `update` |

## Rules

- Hook or ruleset changed → tag release. vmCODE never pulls `main`.
- Keep 3-geometry ruleset resolution ([hook](../style-core/hook.md#ruleset-resolution)).
- Vendored copy edited in consumer = bug. Edit here only.
