---
name: epic-orchestration
description: "Run an epic's tickets to done: launch one epic-ticket agent per ready ticket, serially, critical path first, until no ready ticket is left. Pass the epic issue number."
argument-hint: "[epic issue number]"
disable-model-invocation: true
---

You have been given an epic issue. Its child tickets describe how to implement it.

The goal is every agent ticket merged into the default branch, one at a time, with the default branch green after each merge.

The tickets form a **task graph** with blocking relationships between them. The **frontier** is every child ticket that is open, has all blockers closed, carries the label `ready-for-agent`, has no assignee, and has no sub-issues of its own. Every other open child waits on a human: `ready-for-human` for a human step, `needs-info` or `needs-triage` for an owner decision.

Your only job is to launch **epic-ticket** agents and keep your own context clean. Each agent owns its ticket from first read to merge: it implements, reviews, merges, closes out, and records the ticket on the epic thread. Diffs, ticket bodies, and build output stay with it.

Communicate through **context pointers**: the epic number and the ticket number. The ticket, the epic thread, and the repo carry the rest.

## Steps

1. Map the task graph once: each child ticket's number, state, labels, assignees, sub-issue count, and open blockers. Pull only those fields:

   ```bash
   gh api repos/{owner}/{repo}/issues/<epic>/sub_issues --paginate --jq '.[] | "\(.number) \(.state) \([.labels[].name]|join(",")) \(.assignees|length) \(.sub_issues_summary.total // 0)"'
   gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by --jq '[.[] | select(.state=="open").number]'
   ```

   A ticket without native edges keeps them in its `## Blocked by` section; read that section alone.

   Done when every child has a state, labels, assignee count, sub-issue count and a list of open blockers.

2. Order the frontier, critical path first: rank each frontier ticket by how many open children it blocks, directly or through other tickets (count every downstream ticket once); higher rank first, ties by lowest number. Launch one **epic-ticket** agent on the first ticket. Pass the epic number and the ticket number, and no model override. Wait for it to finish: tickets merge one at a time.

3. Read the first line of its return:
   - `merged #<n> …` → mark the ticket closed in your graph, go to step 4.
   - `question #<n> …` or anything else → stop, go to step 5.

4. Recompute the frontier from your graph. Not empty → step 2. Empty → step 5.

5. Report to the user:
   - one line per launched ticket: the line its agent returned;
   - each open child left, with what holds it: its open blockers, or the human it waits on (its label).

   Leave the epic open; its owner closes it.
