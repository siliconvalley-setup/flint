# CONTEXT — ubiquitous language

Glossary only. No implementation details.

- **ruleset** — the product: the plain-text style policy (`flint.md`). Its
  wording is load-bearing; provenance-tracked rules are never paraphrased.
- **hook** — the delivery: the single POSIX-sh script that injects the
  ruleset into a session.
- **surface** — a place Claude runs: `chat`, `cowork`, or `code` (CLI and the
  Desktop Code tab are the same surface).
- **channel** — an injection mechanism available on a surface: hook, skill,
  Style, profile instructions, Project instructions, CLAUDE.md.
- **core** — full-fidelity delivery (ruleset via hooks). Exists only on
  surfaces with hook support.
- **derivado** — a lossy artifact derived from the ruleset for a hook-less
  channel. Two kinds: *verbatim* (regenerated copies of the ruleset) and
  *derived* (hand-condensed paraphrases). Marked, budgeted, re-synced per
  release; never a second source of truth.
- **re-sync** — the manual, checklisted regeneration of every derivado after
  a ruleset change.
- **loud marker** — the in-session `FLINT HOOK ERROR` text emitted on any
  delivery failure; the opposite of a silent stale fallback.
- **anchor** — the block injected per turn (`flint-submit.md`, an exact copy of
  the ruleset); reinforcement.
- **canonical home** — this repo. Edits happen here only; a consumer never
  edits a vendored copy in place.
- **consumer** — a repo/system that uses flint: either vendors the ruleset +
  hook at a pinned ref (vmCODE, baked into a container), or clones flint and
  runs the installer (silicon-valley, on its agent account).
- **config** — everything besides the style core: skills, agents, rules,
  output styles, settings policy, plugins, mods, statusline, env.
- **installer** — `install.py` (via `install.sh`): applies the config and the
  style hooks to a Claude config dir.
- **forced key** — a `settings.json` key flint owns; rewritten every run.
- **default** — a `settings.defaults.json` key set only where absent; the
  user's value wins.
- **state file** — `.flint-state.json` in the config dir: what flint wrote,
  the only input to prune and uninstall.
- **env file** — `env.sh`: the one source for environment values, read by the
  installer and sourceable by a shell.
- **external skill** — a skill fetched from another repo or npm package
  (`external-skills.txt`) into `.cache/`.
- **handoff** — a document that lets a new session continue a work line with
  no access to the old session. One per work line; open until the owner
  closes it.
- **work line** — one task, research or decision thread that spans sessions.
  The unit a handoff tracks; never split over two handoffs.
- **subject** — the short, specific name of a work line, by which the owner
  finds and resumes its handoff.
- **meter** — the in-session notes on main-thread context size: a warning,
  then an order to hand off.
