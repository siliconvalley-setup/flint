# Cloudflare — `cf` (the API) · `wrangler-dev` (local dev)

Two paths, pick by what the task touches:

| Task | Tool |
|---|---|
| read or change the account — DNS, zones, R2, KV, D1, Queues, Zero Trust, WAF, rulesets, Workers config | **`cf`** |
| run a Worker locally, iterate, deploy it | **`wrangler-dev`** / `wrangler` (below) |

## `cf` — the whole Cloudflare API from Bash

Load the **cloudflare-cf** skill.

## Local dev — `wrangler-dev`

`wrangler-dev` is not on PATH: it ships with this skill. Run it as `~/.claude/skills/toolchain-installed/scripts/wrangler-dev`; `wrangler-dev` below means that path.

Wrangler comes from the project — `wrangler-dev` uses `node_modules/.bin/wrangler`, else one on PATH; in a project without it, `start` exits `wrangler not found`. Install it as a project dep (`pnpm add -D wrangler`).

`wrangler dev` forks a `workerd` child that binds the port — killing either one by hand leaves the port bound or lets workerd respawn. `wrangler-dev` runs the tree in its own process group, so teardown is atomic. Three subcommands, nothing else:

- `wrangler-dev start <wrangler dev flags>` — args go straight to `wrangler dev`, e.g. `--config dist/server/wrangler.json --persist-to .wrangler/state --port 8787 --ip 127.0.0.1`; logs to `.wrangler-dev.log` (default port is 8787)
- `wrangler-dev stop` — group kill + reaps orphan `workerd`/`miniflare` of **this project only** (parent PID 1, cwd inside the current dir). Other projects' servers stay up. Safe when nothing runs. This is the teardown; a bare `pkill workerd` lets the supervisor respawn it, and kills every other project's server too.
- `wrangler-dev status` — pgid if tracked, plus the `workerd`/`miniflare` pids of this project (`(orphan)` marks the ones `stop` reaps).

Run all three from the same dir (the project root): the pidfile, the log and the project scope come from the cwd.

Rebuild cycle: `wrangler-dev stop` → build → `wrangler-dev start` → confirm it answers before trusting any audit: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/`. Anything but `000` means it booted; root may redirect, so follow `curl -sI` → `Location` to learn the real entry route instead of guessing a path. Build only while the preview is down — a build under the live asset watch wipes `dist/`, and every route 404s into a phantom audit failure.

Deploy needs `CLOUDFLARE_API_TOKEN` (an env var on the silicon-valley agent account) — the same token `cf` uses; local dev needs no auth. DevTools is Cloudflare-hosted (automatic via InspectorProxy).
