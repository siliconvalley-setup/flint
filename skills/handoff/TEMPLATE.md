# Handoff doc format

Language: English, telegraphic + ASD-STE100 (drop articles, copulas, connectors when order stays clear). Chat with user stays in user's language.

Length: 1000-2000 words, by session need. Reader = fresh agent with no transcript: it must continue from this doc alone.

Link artifacts (ADR, PR, issue, spec, plan, commit) by path or URL; never copy their content.

```markdown
---
subject: <max 8 words, specific>
status: open
created: <ISO UTC, first write>
updated: <ISO UTC, this write>
sessions: [<oldest session id>, …, <this session id>]
branch: <git branch; omit outside git>
commit: <short sha of HEAD; omit outside git>
---
# <subject>

## Goal
What work line must reach, and why. Done criteria.

## Current state
Where work stands now: what works, what is half done, what is broken.

## Decisions and why
Each decision + reason + rejected option. Link ADR when one exists.

## Done
Finished results, with commit, PR or report link.

## Next steps
Ordered. First step concrete enough to start without questions.

## Open questions
Each question + who decides (user, other team, data).

## Sources
- `path/file.ts:42` — why it matters.
- <https://example.com/page> — what it proves.
- `reports/x.md` — what it holds.

## Failed attempts and traps
What was tried and failed, and why; gotchas that cost time.

## Verify commands
Commands that show current state (tests, checks, queries). `none` if no command applies.

## Suggested skills
Skills next agent loads first, with reason.

## History
- <YYYY-MM-DD> `<session id>` — <what this session changed, one line>.
```

Section with nothing to say: write `none`; keep the heading.
