# shellcheck shell=sh
# flint env — one file for every environment value.
# install.sh copies each export into the `env` of ~/.claude/settings.json (Claude
# sees it in CLI and Desktop); a shell may also source this file so tools run
# outside Claude see the same values. Plain `export KEY=value` lines only.
# Edit, then re-run ./install.sh.

# Claude Code runtime flags (from vmCODE claude-flags.env; DISABLE_UPDATES
# dropped: settings.json autoUpdatesChannel=latest keeps every machine on latest).
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export CLAUDE_AUTO_BACKGROUND_TASKS=1
export BASH_MAX_TIMEOUT_MS=240000
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
export ENABLE_TOOL_SEARCH=true
export CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3
export CLAUDE_CODE_DISABLE_FAST_MODE=1
export CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false
export DISABLE_AUTO_COMPACT=1
export CLAUDE_CODE_ENABLE_AWAY_SUMMARY=0
export CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1
export CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=200
export CLAUDE_CODE_DISABLE_CRON=1
export USE_BUILTIN_RIPGREP=0
# Subagents start fresh (no fork of the parent context) (issue #47).
export CLAUDE_CODE_FORK_SUBAGENT=0
# Bash output over 16384 chars goes to a file: below it a saved output cost more refetch turns than it saved (ADR 0003).
export BASH_MAX_OUTPUT_LENGTH=16384
# Built-in Explore and Plan subagents off; custom agents named Explore or Plan stay on.
export CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1
# Effort for subagents with no `effort` of their own (Claude Code v2.1.316+; older versions ignore it).
export CLAUDE_CODE_SUBAGENT_EFFORT=medium
# Fixed thinking budget: adaptive reasoning models (Opus 4.7+, Sonnet 5+, Haiku 5.5, Fable) ignore the number.
export MAX_THINKING_TOKENS=32000
# Process env only: Claude drops this key from settings env. Bypass mode also skips dangerous rm checks.
export CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS=1

# FIRECRAWL_API_URL: silicon-valley agent ~/.bashrc (Local web stack, ADR 0005), not here.
# Private servers on r1 (LAN).
export AI_MEMORY_SERVER_URL=http://192.168.1.2:49374

# TokenEconomizer plugin (env wins over its config files): never prune ai-memory
# tools or LSP (lsp mod diagnostics); facts only from repeated failures (no model
# calls); learn from earlier sessions.
export TE_TOOLPRUNE_PROTECT='mcp__plugin_ai-memory_ai-memory__*,LSP'
export TE_MICROSKILLS=envfacts
export TE_HISTORY_IMPORT=true
