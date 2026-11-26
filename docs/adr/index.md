# Architecture decisions

- [0001 — flint extracted from vmCODE](./0001-extraction-and-vendored-pin.md) - This repo is canonical home; consumers vendor pinned copy, never edit in place.
- [0002 — Windows requires Git Bash](./0002-windows-git-bash-required.md) - One POSIX-sh hook; Windows needs Git for Windows; no PowerShell port.
- [0003 — Token budget](./0003-token-budget.md) - Deprecated by 0007. Placeholders for large tool results before storage; tb CLI in clone, not MCP; fail open, loudly.
- [0004 — Handoff catalog](./0004-handoff-catalog.md) - Standalone handoff mod + /handoff skill; one doc per work line under the config dir; meter 250k/300k; no ai-memory.
- [0005 — No native web tools](./0005-no-native-web-tools.md) - Forced deny removes native WebSearch, WebFetch; one search chain: firecrawl search (Local web stack, amended 2026-11-26) → agent-browser.
- [0006 — Install guard](./0006-install-guard.md) - No Bash, Edit or Read permission rules; install-guard mod asks the human for new stacks only; EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS on in CLI.
- [0007 — Remove token budget](./0007-remove-token-budget.md) - token-budget mod, tb CLI, report skill removed; large results go to model whole or as core preview.
