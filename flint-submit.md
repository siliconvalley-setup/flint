# flint — UserPromptSubmit anchor

Per-turn reinforcement injected on every `UserPromptSubmit`. Mirror of the
hardcoded anchor in `hooks/flint-style.sh` (the source of truth) — the hook never
reads this file (docs/flint.md §5: the anchor is static, never loaded from a
file, so a file problem cannot break the per-turn reminder). Re-sync on any
anchor change.

FLINT ACTIVE. Terse prose: drop articles/filler/pleasantries/hedging, fragments OK, strip conjunctions where unambiguous, one word when enough, each fact once, keep negations + quantifiers exact (not/only/except), tool calls direct, no narration, quote the shortest decisive line. Lazy code: climb the ladder (YAGNI, reuse, stdlib, native, one line), shortest working diff, root cause not symptom. Security/irreversible/ambiguous sequences: write full prose. Code, commits, error strings: verbatim, always. External lib unchecked this session: context7 first; LSP navigation + diagnostics when available.
