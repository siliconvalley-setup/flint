---
type: Component
title: Ruleset (flint.md)
description: Style ruleset — structure, provenance, edit rules, size cap, derivados.
tags: [style-core, ruleset]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
---

# Ruleset (`flint.md`)

Product. One `<important>` line: token economy. No heading. ASD-STE100 style rules: `output-styles/caveman.md`. Coding rules: `rules/coding.md`, always loaded, one `<important if>` block. Delivery: [hook](./hook.md).

## History

- 2026-11-02 `9f5a8f4`: replaced caveman + ponytail merge (8.8 KB). Old rules + old provenance table: `git show 9f5a8f4^:flint.md`, `git show 9f5a8f4^:docs/flint.md`.
- 2026-11-02 `9f5a8f4`: "full prose" escape hatch removed, by owner intent. No off path exists, not even behavioral. Do not re-add.
- 2026-11-03: context7-first + LSP clauses removed from per-turn anchor. Anchor = `flint-submit.md`.
- 2026-11-06 `62d90c3`, `b9a19bd`: owner cut 11 numbered rules to 8 bullets. Dropped: answer first, articles optional, one idea per sentence, bounded tool status, never perform caveman. Added: quality-over-speed.
- 2026-11-08 `bbae140`, 2026-11-11 `0a6a041`: owner cut 8 bullets to one `<important>` token-economy line. Chat derivados not re-derived.

## Provenance (do not paraphrase)

Exact wording = fix. Check table before edit. Add rule: cheap. Edit listed rule: needs reason stronger than style.

| Rule | Origin | Bug fixed |
|---|---|---|
| "Payload verbatim: code, paths, names, commands, errors, numbers, units. Never drop not/never/no/only/except." | caveman #670 + caveman never-touch list (both dropped in `9f5a8f4`); CAVEWOMAN (EMNLP 2026) L1 prompt keeps "nouns, main verbs, numbers, and standard symbols" | caveman #670: compression dropped negation, inverted instruction. 2026-11-06 A/B (5 flint tasks × 3 runs, Opus): bare "Payload verbatim." let one answer replace `.flint-state.json` with paraphrase |

## Hard rules

- `flint-submit.md` = exact copy of `flint.md`. Edit both. Test 12b fails on drift.
- Real size ceiling: 10,000 chars of hook output, not 64 KB. Over cap, Claude Code swaps text for preview + file path: ruleset arrives as pointer, no error, no loud marker. Test 13a guards JSON envelope at 9,300. `head -c 65536` in hook = memory guard only.
- `.gitattributes` pins `eol=lf`. Keep it: CRLF checkout doubles cost of each escaped `\r\n` on Windows only; no local LF run catches it.
- No state machinery: no flag files, config files, slash commands, badges, on/off switch. No sentence in `flint.md` that phrases off-switch as command (ponytail #161/#162: "add a normal mode toggle" silently turned ponytail off).

## Why no state

Ancestor plugins: ~1,141 lines JS, only job state. Each piece shipped bugs: natural-language triggers (`'turn caveman mode off' used to ACTIVATE caveman`; ponytail #161), mode flag files (symlink attacks, stale `.prev` chains), intensity filter swallowed rule bullets (twice, 4 weeks apart), slash-command arg parse clobbered state on typo. Fixed point deletes these classes. Do not add state back.

## Derivados

Lossy copies of ruleset for hook-less Desktop channels. Never second source of truth.

| File | Kind | Update |
|---|---|---|
| `desktop/cowork/SKILL.md` | verbatim | `python3 tools/resync.py` (header in `resync.py` + `unwrap(flint.md)`). Never hand-edit |
| `desktop/chat/project-instructions.md`, `chat/style.md`, `chat/profile.md` | derived (condensed) | re-derive by hand, then `python3 tools/unwrap.py <file>` |

Full checklist + paste steps: [desktop](./desktop.md).

## Recipe: edit ruleset

1. Check provenance table.
2. Edit `flint.md`, copy to `flint-submit.md`. Live next session on every device that pulled.
3. Run [derivado checklist](./desktop.md), then `sh test/test.sh`.
4. Tag release ([consumers](../config/consumers.md)).
