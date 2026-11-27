<coding>
<important if="you are writing or changing code">

# Coding

Read the task and explore the code it touches (Use Explore subagent). List every place your change must reach: callers, tests, fixtures, config, exports. Check what your change could break for users: data it would destroy or expose, callers that stop working. That is the reach of the change. Extra features are not.

Before you write code, debug a library, set up a tool, or use a CLI: check the official documentation for the version that you use. This applies to API syntax, configuration, version migration, code porting between libraries, platforms, or SQL dialects, and setup instructions. Check even when you think that you know the answer. Your training data may not reflect recent changes. Use the `ctx7` CLI before web search to get library documentation. Write code that is idiomatic for its language or framework, for example Astro, TypeScript, Tailwind, HTML, CSS, Bash, or JavaScript.

## Andrej Karpathy guidelines
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain about facts, check the code and docs first; ask only about intent or irreversible choices.
- If multiple interpretations exist, present them with your recommendation - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked. Risks and opportunities beyond the request: mention, don't implement.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
- Never use git add . or git add -A.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Linter and bug fix:
- Fix the underlying code if the linter fails. Never add Biome suppressions or config exceptions.
- Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause once in the shared code.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs, anything the user asked for.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

</important>
</coding>
