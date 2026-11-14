---
paths:
  # code globs: keep equal in coding.md and writing_preference.md
  - "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
  - "**/*.{astro,html,css}"
  - "**/*.{py,pyi}"
  - "**/*.{sh,bash,zsh,ps1,cmd,bat}"
  - "**/*.{sql,nix,jq,c,h}"
  - "**/*.{json,jsonc,yaml,yml,toml,xml}"
  - "**/{Dockerfile,Containerfile,Makefile,_headers,_redirects}"
---
<coding>

# Coding

Read the task and explore the code it touches. List every place your change must reach: callers, tests, fixtures, config, exports. Check what your change could break for users: data it would destroy or expose, callers that stop working. That is scope. Extra features are not.

Optimize total system complexity, clarity, and ownership—not lines or files changed. Coherent wider change beats cramped patch, duplicated guard, or misplaced logic. Reuse fitting abstractions; do not contort code to avoid abstraction. Prefer consolidation. Fix root cause.

**Plan efficiently for tight token budgets. Concise output, complete tasks in as few turns as possible, batch related operations when feasible, and minimize context-cache reads and writes.**

## The smallest complete change

Take the first option that fully works:

1. Does it need to exist? The approved spec decides (`<rules>` Phase 1). Skip features, options and flexibility outside it, and name them in one line. No approved spec: do Phase 1 first.
2. Already in this codebase (a helper, component, service, pattern)? Use it the way the surrounding code does.
3. Standard library or a platform feature? Use it, unless the project has its own. A house component beats a native widget.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise, YAGNI: the minimum code that works.

- Existing structure obstructs clear ownership: make coherent refactor task needs.
- No abstraction, wrapper, type conversion, option, config, boilerplate or "for later" code nobody asked for. Keep values in the form the platform already gives you. Deletion beats addition. Keep the structure the codebase already has: its layers, interfaces and conventions.
- The shortest working diff wins, once you know everything it must touch. A one-liner that needs decoding is not short.
- Comment only the why the code cannot show, in one line.
- Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause once in the shared code.
- Code you move or merge keeps its error handling and validation.
- Between options of equal size, take the one that is correct on edge cases.
- Code without its check is unfinished: new non-trivial logic (a branch, a loop, a parser, money or security, or a whole new script or app) leaves one small test or an assert-based self-check. Trivial changes need none.
- Fix the underlying code if the linter fails. Never add Biome suppressions or config exceptions.
- Never use git add . or git add -A.
- A shortcut with a known limit gets a code comment in this form: `shortcut: <the limit>, <when to upgrade>`.

Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs, anything the user asked for.

</coding>
