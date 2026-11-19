---
type: Component
title: Consumers
description: Systems that use flint (silicon-valley), how changes reach them, release rule.
tags: [config, consumers, release]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
---

# Consumers

Edits here propagate. Repo private: consumer needs read access. Decision: ADR [0001](../adr/0001-extraction-and-vendored-pin.md).

| Consumer | Takes | Update path |
|---|---|---|
| silicon-valley | whole config, `main`; clone on agent account | `git pull && ./install.sh` on `update` |

Former consumer: vmCODE dropped flint 2026-08-30 (vmCODE `4bbad85`, #165); it ships its own style hook. No pinned-tag consumer remains.

## Rules

- Hook or ruleset changed → tag release (for any pinned consumer).
- Keep 3-geometry ruleset resolution ([hook](../style-core/hook.md#ruleset-resolution)).
- Vendored copy edited in consumer = bug. Edit here only.
