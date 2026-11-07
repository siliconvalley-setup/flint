---
type: Procedure
title: Claude Desktop propagation
description: Paste and upload steps for Chat and Cowork derivados, plus re-sync checklist after each ruleset edit.
tags: [style-core, desktop, derivados]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
---

# Claude Desktop propagation

Full fidelity (compact re-injection, per-turn anchor, subagent coverage, loud marker) only where hooks run. Other surfaces get [derivados](./ruleset.md#derivados).

| Surface | Channel | Fidelity |
|---|---|---|
| Code (tab or CLI) | 3 hooks (`./install.sh`) | full; same `settings.json` as CLI, no extra step |
| Chat | Style + profile + Project instructions | static, drifts in long sessions |
| Cowork | uploaded skill only | model-invoked, partial |

## Chat

UI paths verified 2026-07-28 (Claude for Mac). Path gone → find equivalent field; artifact still applies.

1. **Instructions for Claude** (account-wide, only always-on channel): initials bottom-left → `Settings` → `General` → `Profile` → `Instructions for Claude` → paste [`desktop/chat/profile.md`](../../desktop/chat/profile.md). Budget 1,500 chars.
2. **Style** (per chat): `+` next to prompt → `Use style` → `Create & edit styles` → `Create custom style` → `Describe style instead` → paste [`desktop/chat/style.md`](../../desktop/chat/style.md) → `Create style`. Each new chat starts on `Normal`.
3. **Projects**: Project → `Set project instructions` → paste [`desktop/chat/project-instructions.md`](../../desktop/chat/project-instructions.md). Budget ~8,000 chars; every rule kept, only exposition and duplicate examples cut.

## Cowork

No local skills dir, no folder sync, no `CLAUDE.md` channel: Cowork runs in remote Ubuntu VM without host filesystem (confirmed 2026-07-28). Skill = only channel, uploaded as ZIP per account. ZIP top entry = dir `flint` with `SKILL.md`:

```sh
rm -rf /tmp/flintpkg && mkdir -p /tmp/flintpkg/flint
cp desktop/cowork/SKILL.md /tmp/flintpkg/flint/
(cd /tmp/flintpkg && zip -qr ~/Desktop/flint-skill.zip flint)
```

Cowork: `Customize` (left sidebar) → `Skills` → `+` → `Create skill` → `Upload a skill` → pick ZIP → toggle on.

## Re-sync checklist (after any `flint.md` edit)

Paste-in artifacts carry no hard wrap: GUI textarea keeps newlines, wrapped paragraph reaches model as ragged lines.

- [ ] `python3 tools/resync.py` — regenerates `desktop/cowork/SKILL.md`
- [ ] `desktop/chat/project-instructions.md` — re-derive (condensed); ≤ 8,000 chars
- [ ] `desktop/chat/style.md` — re-derive if prose rule changed
- [ ] `desktop/chat/profile.md` — re-derive if core rule changed; ≤ 1,500 chars
- [ ] `python3 tools/unwrap.py <file>` on each re-derived file
- [ ] `sh test/test.sh` — budget guards + parity pass
- [ ] Re-paste Chat artifacts, re-upload Cowork ZIP
