---
name: local-delegate
description: "Hand bulk reading to the local model and read only its summary. Use before pulling whole web pages, a long log (CI, build, test), a diff for first-pass review, or a plan for first-pass audit into your context."
---

# local-delegate

Local model = `claude-omlx` (oMLX server on 127.0.0.1; silicon-valley pins the model). It reads big inputs; you read its short answer. No Claude quota; works offline once inputs sit on disk. **First pass only**: quality far below yours. Never hand it main coding work, edits or decisions.

| Task | Input in scratch dir | Prompt file | Task prompt (stdin) |
|---|---|---|---|
| T1 web research | `page-1.md`, `page-2.md`, … | `web-summary.md` | `Read page-*.md; answer: <question>. Summarize findings with source URL per claim.` |
| T2 log / CI triage | `log.txt` | `log-triage.md` | `Read log.txt; list errors, first cause, next check.` |
| T3 diff review | `diff.patch` (+ touched files) | `diff-review.md` | `Read diff.patch; list bugs worst first with file:line.` |
| T4 plan audit | `plan.md` (+ cited files) | `plan-audit.md` | `Read plan.md; list blockers with evidence.` |

Prompt files sit in `~/.claude/skills/local-delegate/prompts/`.

## Steps

1. **Scratch dir.** Run `mktemp -d`, fresh per run. Write the printed path as a literal `<dir>` into every later command: shell variables do not survive between Bash calls, and an empty `$var` turns `"$var/"` into `/`.

   *Done when:* you hold the literal path of a new, empty dir.
2. **Fetch inputs blind.** Your own Bash writes every input into `<dir>`; output goes to files only. Never `cat`, `head` or Read an input: that spends the tokens this skill saves.
   - T1, one file per URL, `Source:` line first:
     `{ printf 'Source: %s\n\n' '<url>'; firecrawl scrape '<url>' --only-main-content; } > "<dir>/page-1.md" 2>/dev/null`
   - T2: `cp <log> "<dir>/log.txt"`, or `gh run view <id> --log > "<dir>/log.txt"`.
   - T3: `git diff <range> > "<dir>/diff.patch"`; touched files the review needs: `rsync -R <paths> "<dir>/"` from the repo root.
   - T4: `cp <plan> "<dir>/plan.md"`; cited files: `rsync -R <paths> "<dir>/"`.

   Size check, numbers only: `wc -c <dir>/*`. A page of a few hundred bytes = failed scrape: refetch it, or drop it. Keep one run under ~80 KB of input; split bigger inputs over several runs. The window is 100K tokens, but Claude Code compacts near 66K (measured: 258 s, read text summarized away). Read text costs ~2.2 bytes per token (31 KB of pages = 14K tokens), plus ~3K of fixed prompt and ~1–3K per turn.

   Every `<…>` value goes inside single quotes; write a `'` in it as `'\''`.

   *Done when:* every input sits in `<dir>` and none of its text entered your context.
3. **Run.** Bash with `run_in_background: true` (a run takes 1–5 min; the foreground limit kills it). Wait for the completion notice; never poll.

   ```bash
   (cd <dir> && printf '%s\n' '<task prompt>' | CLAUDE_CODE_EXTRA_BODY='{"thinking":{"type":"enabled","budget_tokens":2048}}' claude-omlx -p --restricted --strict-mcp-config --tools=Read,Grep,Glob --permission-mode dontAsk --append-system-prompt-file ~/.claude/skills/local-delegate/prompts/<prompt file>)
   ```

   Every flag is a guard: keep each one (see *Why the flags*).

   *Done when:* the background run exited and you read its output once: the summary.
4. **Check blind.** The summary is a hypothesis, not a finding. Before you act on a claim or pass it on, confirm it first-hand, and see input text only one cited line at a time. Known local faults: invented `file:line` evidence, false extra findings, a missed second bug (swapped arguments, mostly).
   - `file:line` claim (T3, T4): open that line in the repo.
   - Log claim (T2): `sed -n '<n>p' <dir>/log.txt`.
   - Web quote (T1): count only, `rg -c -F '<quote>' <dir>/page-*.md`; 0 = invented.
   - "Not in the pages", a gap, or any doubt left: count the key terms (`rg -c -i '<term>'`). Count > 0 → run step 3 again with a narrower task prompt that names those terms.

   You see counts and single cited lines; the delegate sees text. A search that prints input lines (`rg -n`, `rg -o`, `grep`) is a leak, even cut short.

   *Done when:* every claim you use is confirmed or dropped.
5. **Clean.** `rm -rf <dir>`.

   *Done when:* `<dir>` is gone.

## Failures

- Run much slower than 1–5 min: another session shares the server (max 2 requests at once); decode drops 2–4×. Wait; no restart.
- Output is a 507, a timeout, or empty: oMLX refused (memory guard) or is down. Do the reading yourself, in ranges (`rg`, `sed -n`), and say the delegate failed. No retry loop.
- `claude-omlx: command not found`: the account has no local model. Skip this skill.
- Headless caller (`claude -p`): the process can exit when your turn ends and kill a pending run (seen once in 5 test sessions, on a rerun). Run one delegate at a time, and give your answer from the runs that finished.

## Why the flags

flint defaults to `bypassPermissions`, and T1 feeds untrusted web text to a weak model.

- `--tools=Read,Grep,Glob`: no Bash, Write, Edit or web. Any Bash pattern admits write flags (`git diff --output=`, `firecrawl scrape -o`).
- `--restricted`: ignores settings files, confines file tools to cwd `<dir>`.
- `--strict-mcp-config`: no MCP servers. `--permission-mode dontAsk`: unlisted tools are denied, never prompted.
- Prompt on stdin: `--tools` takes several values and swallows a trailing prompt argument.
- `CLAUDE_CODE_EXTRA_BODY`: caps thinking at 2048 tokens per turn; oMLX reads `thinking.budget_tokens` from the request. Without it a T3 run thinks 8–29k tokens (up to ~12 min). `MAX_THINKING_TOKENS` and effort do not reach oMLX: for a custom model Claude Code always sends adaptive thinking.
