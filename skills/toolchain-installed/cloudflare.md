# Cloudflare

| Task | Tool |
|---|---|
| Account: DNS, zones, R2, KV, D1, Queues, Zero Trust, WAF, Workers config | `cf`, skill **cloudflare-cf** |
| Run Worker locally, deploy | `wrangler-dev`, `wrangler` |

## Local dev
- `wrangler-dev` = `~/.claude/skills/toolchain-installed/scripts/wrangler-dev` (not on PATH).
- Never run raw `wrangler dev` or `pkill workerd`: port stays bound, `workerd` respawns, other projects die.
- Needs project `wrangler`: `pnpm add -D wrangler`. Missing: `start` exits `wrangler not found`.
- Run every command from project root: pidfile, log and scope come from cwd.

Commands:
- `wrangler-dev start <wrangler dev flags>`: example `--config dist/server/wrangler.json --persist-to .wrangler/state --port 8787 --ip 127.0.0.1`. Log: `.wrangler-dev.log`. Default port 8787.
- `wrangler-dev stop`: kills process group + orphan `workerd`/`miniflare` of this project only. Safe when nothing runs.
- `wrangler-dev status`: tracked pgid + this project's pids (`(orphan)` = `stop` reaps it).

Rebuild cycle:
1. `wrangler-dev stop`.
2. Build. Never build while server runs: build wipes `dist/`, every route 404s.
3. `wrangler-dev start …`.
4. Check: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/`. Not `000` = up. Redirect: follow `curl -sI` `Location` for real route.

Deploy: needs `CLOUDFLARE_API_TOKEN` (already set, same token as `cf`). Local dev needs no auth.
