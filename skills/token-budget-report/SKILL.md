---
name: token-budget-report
description: "End-of-session check of the token-budget mod: find friction in this session's transcript and open a flint issue only for a real, untracked problem."
disable-model-invocation: true
---

You audit how the `token-budget` mod behaved in **this** session, and file **friction** as a flint issue. You ran the session, so your own memory of each event is evidence too. Friction is the target; an event that worked **by design** is no finding.

## Steps

1. **Locate.** Run:
   ```sh
   FLINT=$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}")")")
   T=$(ls ~/.claude/projects/*/"${CLAUDE_SESSION_ID}".jsonl)
   git -C "$FLINT" log --oneline -1; ls "${T%.jsonl}"/subagents/*.jsonl 2>/dev/null
   ```
   Done when: `$T` is one file, and you have the clone commit that served the session.

2. **Timeline.** For `$T` and each subagent transcript, run:
   ```sh
   jq -r -f "${CLAUDE_SKILL_DIR}/timeline.jq" "$f" | rg -B2 -A4 '\[tb\] [0-9]+ B|TOKEN-BUDGET|Not spawned|^  -> tb: |more: node' | head -n 300
   ```
   Each hit is a mod **event**: a placeholder, an error note, a fork denial, a `tb` error, a `more:` page. Lines after a hit show what the agent did next.
   Done when: you hold the event list of every transcript, subagents included.

3. **Classify** each event as friction or by design, with the reference below.
   Done when: every event has a class and, for friction, its one-line cost (extra calls, lost content, blocked work).

4. **Still current?** For each friction, find the rule that caused it in `$FLINT/mods/token-budget/hooks/register.ts` or `$FLINT/tools/tb.mjs`. Then run `git -C "$FLINT" fetch -q && git -C "$FLINT" log --oneline HEAD..origin/main -- mods/token-budget tools/tb.mjs` and read each listed commit. A rule `origin/main` already changed is fixed: drop that friction.
   Done when: each friction names its rule (`file:line`) on `origin/main`, or is dropped as fixed.

5. **Tracked?** Run `gh issue list -R siliconvalley-setup/flint --state all --search "token-budget" --limit 30`, then read the body of each title that could share a root cause.
   - Same root cause, issue open → add a comment with your new evidence.
   - Same root cause, issue closed → step 4 decides: still current → new issue that links it.
   Done when: each friction is new, commented on an open issue, or dropped.

6. **File** one issue for all new friction of this session; no new friction → open nothing.
   Done when: an issue URL or comment URL exists, or you can state "no issue" with the reason.

7. **Report** to the user: the URL (or "no issue"), then one line per event class: count, friction or by design.

## Classify

Friction (the mod cost more than it saved):

- **Refetch**: after a placeholder, the agent fetched the same bytes again in more than one call: `tb get` of all of it by pages, a range walk with `sed` or Read offset/limit, the same command again.
- **Dead end**: the agent could not resolve the placeholder: no follow-up call, "not retrievable" in its report, or the main thread read the same source again.
- **Stacked placeholder**: a placeholder on output that came from `tb` or from an earlier placeholder.
- **Lost content**: the placeholder hid what the agent needed (a failing line, a body to copy), and its answer missed it.
- **Error**: a `tb:` error, a non-zero `tb` exit, a `TOKEN-BUDGET ERROR` line.
- **Blocked**: a fork denial where no fresh agent could do the work.

By design:

- A placeholder followed by one targeted read (`tb get '<ref>#<id>'`, a `:a-b` range, Read with offset/limit), by the one whole read its hint names (`whole: Read …`), or by no read because the outline was enough.
- A fork denial followed by a fresh agent with a self-contained brief.

## Issue form

Copy the form of siliconvalley-setup/flint#52. Write in English, telegraphic Simplified Technical English.

- **Title**: `token-budget: <friction>, <friction>`, lowercase.
- **Problem Statement**: session id, date, surface (CLI, Desktop, SSH), clone commit; one sentence on what cost extra turns.
- **Evidence**: one numbered item per friction: the class in bold, the exact command and the output line verbatim, the cost, and the rule (`file:line`).
- **Session totals**: this session's row of `python3 -I "$FLINT/tools/tokscan.py" <YYYY-MM-DD>`.
- **Options (not decided)**: one or two fix shapes per friction.
- **Out of Scope**: friction you dropped as fixed or tracked, with its issue number.

Quote only mod lines and tool commands. Write `<REDACTED>` in place of each secret, token, cookie, or private file content, and leave out the user's prompts.
