---
name: briefing
description: aviato weekly session: load each site's STATE.md, work its agenda item by item, record each answer through the aviato command.
disable-model-invocation: true
---

Owner session of aviato (repo `siliconvalley-setup/aviato`). Code picks the agenda; you work it in its order and record every answer. The records are the output: `METHOD.md` rules apply to every turn.

Run from the aviato checkout (the folder with `METHOD.md` and `sites/`), on branch `main`.

## Steps

1. **Load.** Read `METHOD.md`. For each site folder in `sites/`, read `sites/<site>/STATE.md`. STATE.md missing, or its "Construído em" time older than the newest `job.json` under `<data root>/runs/<today>/` (data root: `data_root` in `$AVIATO_CONFIG_DIR/config.yaml`, default `~/.local/share/aviato/`) → run `aviato rebuild` and read it again. Done when every site's STATE.md is from after the day's run.
2. **Work the agenda.** Site by site, item by item, in agenda order, Decidir before Conferir. Per item:
   - Look: open the sources the item names, plus the aviato database and raw pulls it rests on. Build the evidence table (`METHOD.md` Rule 3).
   - Ask: one question, with options, your recommendation and the evidence table.
   - Record the owner's answer at once:

     | Item | Exit command |
     |---|---|
     | alarm, note, return, suggestion | `aviato decision add <site> <draft>` on the item's subject |
     | routine | the routine section of `METHOD.md`, then `aviato routine add <site> <routine> <draft>` |
     | check (Conferir) | `aviato verdict <id> <deu-certo\|nao-deu\|inconclusivo>` (`--result "<text>"` when the decision has no machine test) |

   - Recusada or Adiada: write the return condition from the owner's reason and get the owner's confirmation in the same answer (`return.confirmed: owner: "<words>" <YYYY-MM-DD>`). Reason with a number → `test`; "agora não" → `date` 3 months out; reason without a number → `never: true`.
   - Owner skips the item → it stays for the next session; go to the next item.

   Done when `aviato agenda <site>` lists only items the owner skipped, for every site.
3. **Apply.** Account and site-repo writes only after the owner says "aplica" in this session (`METHOD.md` Rule 5).
4. **Push.** `git pull --rebase origin main && git push origin main`. A rebase conflict → stop and ask the owner; keep every record commit. Done when `git status -sb` shows `main` level with `origin/main`. End the session on the push output.
