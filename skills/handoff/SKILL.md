---
name: handoff
description: "Write, list or resume handoffs: one Markdown doc per work line so a new session continues it. Use on the handoff mod's 300k order, when the user wants to save state for a later session, or to see or pick up open work."
argument-hint: "[list [--all] | resume [words|nº]]"
---

A **handoff** = one doc per **work line** (one task, research or decision thread across sessions). New session reads it and continues with no access to old transcript. One work line, one file: update, never duplicate.

## Store

```sh
cd "<primary working directory of this session>" && D="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/handoffs/$(pwd | sed 's/[^A-Za-z0-9]/-/g')"
```

- File: `$D/<YYYY-MM-DD>-<subject-slug>.md`, name fixed at creation. Format: [TEMPLATE.md](TEMPLATE.md).
- **Linked** handoff = the one whose `sessions` holds this session id `${CLAUDE_SESSION_ID}`. Find it: `rg -l '^sessions:.*${CLAUDE_SESSION_ID}' "$D"`. Two or more files → ask user which one.
- Frontmatter of each doc, for list and match:
  ```sh
  for f in "$D"/*.md; do [ -f "$f" ] && awk -v f="${f##*/}" 'NR==1{if($0!="---")exit;next} /^---$/{exit} {print f"\t"$0}' "$f"; done
  ```
  No `$D` or no file → no handoffs.

Pick by argument: none → Write; `list` → List; `resume` → Resume.

## Write

1. **Target.** Linked handoff → update it. Else read open subjects (frontmatter command); one matches this work → ask user "update `<subject>` or new handoff?". Else new: propose a subject, max 8 words, specific ("Pricing tiers for B2B plan", not "Research"), user accepts or changes it.
   Done when: target file path and subject are fixed.
2. **Write.** Follow [TEMPLATE.md](TEMPLATE.md). Update = rewrite whole doc as current state, keep `created`, add this session id to `sessions` if absent; History holds one line per session: replace this session's line, else add one. In git: `branch` = `git branch --show-current`, `commit` = `git rev-parse --short HEAD`. Before the write, read the file again: `updated` differs from the value you read at resume or at step 1 → tell user another session changed it, merge both states, then write.
   Done when: every template section is filled or marked `none`, every source has a reason, no secret, key, password or personal data is in the file.
3. **Close?** Next steps is empty → ask user "work line done?". Yes → `status: done`. The user decides; a merged PR does not.
4. **Tell user**: file path, subject, and "new session: `/handoff resume <words of subject>`".

## List

Show handoffs with `status: open`, newest `updated` first; `--all` also shows `done`. One table: nº, `updated` date, age ("3 days"), subject, branch, status (with `--all`). Numbers count from 1 in this order; `resume` uses the same order. No open handoff → say so.

## Resume

1. **Pick.** Argument is a number → that row of List order. Words → match against open subjects, then done ones if no open match: one match → take it; several → show those rows, ask user; none → show List, ask. No argument → show List, ask "number or words?".
   Done when: one file is picked.
2. **Link.** Add `${CLAUDE_SESSION_ID}` to its `sessions`, set `updated` to now (UTC), set `status: open`. Remember the new `updated` for Write step 2.
3. **Load.** Read the whole doc. `branch`/`commit` set and checkout differs (`git branch --show-current`, `git rev-parse --short HEAD`) → tell user before any work.
4. **Report** in user's language: subject, current state, next step. Then continue from Next steps.
