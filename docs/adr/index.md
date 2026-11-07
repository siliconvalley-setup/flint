# Architecture decisions

- [0001 — flint extracted from vmCODE](./0001-extraction-and-vendored-pin.md) - This repo is canonical home; consumers vendor pinned copy, never edit in place.
- [0002 — Windows requires Git Bash](./0002-windows-git-bash-required.md) - One POSIX-sh hook; Windows needs Git for Windows; no PowerShell port.
- [0003 — Token budget](./0003-token-budget.md) - Placeholders for large tool results before storage; tb CLI in clone, not MCP; fail open, loudly.
