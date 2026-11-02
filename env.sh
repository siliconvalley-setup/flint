# flint env — one file for every environment value.
# install.sh copies each export into the `env` of ~/.claude/settings.json (Claude
# sees it in CLI and Desktop); a shell may also source this file so tools run
# outside Claude see the same values. Plain `export KEY=value` lines only.
# Edit, then re-run ./install.sh.

# Claude Code runtime flags (from vmCODE claude-flags.env; DISABLE_UPDATES
# dropped: settings.json autoUpdatesChannel=stable keeps every machine on stable).
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

# Private servers on r1 (LAN).
export FIRECRAWL_API_URL=http://192.168.1.2:3002
export AI_MEMORY_SERVER_URL=http://192.168.1.2:49374
