<ai-memory-mcp>
# ai-memory

Plugin ai-memory owns usage: server instructions, tool schemas, skills `ai-memory:*`. This file adds flint policy only.

- Tools are deferred. Load: `ToolSearch select:mcp__plugin_ai-memory_ai-memory__<name>,...` (full name required).
- Recall (`memory_query` → `memory_read_page`) also on: session's first request; before design, debug, deploy, release, auth change, migration, PR review; error not explained in one step. Skip: typo, one-line edit, general question.
- Cite used page: "memory: <path>". No hit → "memory: no hit", continue.
- Precedence: user request > `CLAUDE.md` > checkout > memory. Hard rule → `CLAUDE.md`. Decision → repo ADR when repo keeps ADRs.
- Plugin owns hooks, MCP, skills: never run `ai-memory setup|install-hooks|install-mcp`.
</ai-memory-mcp>
