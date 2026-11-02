---
name: astro-lan
disable-model-invocation: true
description: "Build the Astro site, serve dist/ on the LAN via wrangler-dev at http://<lan-ip>:4321/. Verifies bind, liveness, and images before it reports the URL. Type it to test the build on a phone or tablet."
---

# astro-lan — serve the site over the LAN

Legend: `⊥` = forbidden.

Build the site, serve `dist/` with `wrangler dev` bound to all addresses, hand back `http://<lan-ip>:4321/`. This stack is always astro + `@astrojs/cloudflare`. **Serve the build, not `astro dev`**: under `astro dev` the image pipeline breaks (broken `<img>` on the LAN device — observed, cause `[unverified]`); the production Worker over `dist/` is the real thing. Run every command from the **repo root** — `wrangler-dev` keeps its pidfile and log in the cwd. `wrangler-dev` is not on PATH: it means `~/.claude/skills/toolchain-installed/scripts/wrangler-dev`.

## Steps

1. **Clear the port.** `wrangler-dev stop`, then `pnpm exec astro dev stop` (an astro daemon from an earlier session holds 4321 too; `astro` isn't on PATH). Done when `lsof -nP -iTCP:4321 -sTCP:LISTEN` prints nothing and `wrangler-dev status` lists no pid for this repo. Other projects' `workerd` may run — leave them. If the port is still held, run the [orphan escalation](#orphan-escalation--wrangler-dev-stop-didnt-reap-it).
2. **LAN IP.** `ipconfig getifaddr en0` (Wi-Fi on most Macs; empty → `ipconfig getifaddr en1`).
3. **Build.** `pnpm exec astro build` — the bare build, seconds. (`pnpm build` is the full pre-PR gate with checks + the Guard; use it only when the user asks for that.) Build only while nothing serves `dist/` — Step 1 guarantees it.
4. **Serve.** Read the `preview` script in `package.json` and take its `wrangler dev` flags (the `--config …` it names); append the LAN bind: `wrangler-dev start <preview flags> --ip 0.0.0.0 --port 4321`. Logs land in `.wrangler-dev.log`. ⊥ a raw `wrangler dev` — only the helper tears the process group down atomically (→ [cloudflare.md](../toolchain-installed/cloudflare.md), "Local dev").
5. **Verify bind, liveness, images** — report the URL only after all three pass.
   - **Bind (load-bearing).** `lsof -nP -iTCP:4321 -sTCP:LISTEN` must show `*:4321` (or `0.0.0.0:4321`, `[::]:4321`). A `127.0.0.1:4321` = LAN-invisible → the `--ip` didn't apply or a stale process holds the port: back to Step 1.
   - **Liveness.** `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4321/` — any code = booted; `000` = still starting, wait. Root may render (`200`) or redirect (`3xx`); routes vary by project (flat or locale-prefixed). ⊥ hardcode a locale path; when root redirects, follow it (`curl -sI` → `Location`) to learn the real entry route.
   - **Images.** From the entry route's HTML, curl the first few `<img src>` paths against `http://127.0.0.1:4321` — each `200`. A `404` here is the failure this skill exists to catch.
6. **Report** `http://<lan-ip>:4321/`. Teardown for later: `wrangler-dev stop`.

## Edited a page while serving?

`wrangler dev` serves the build, so a source edit is invisible until rebuilt — and a build under its live asset watch wipes `dist/` → phantom 404s on every route. Cycle: `wrangler-dev stop` → Step 3 → Step 4 → Step 5. Then check each changed page at mobile 375 + desktop 1440 with `playwright-cli` (screenshot + clipped or overflowing elements) — point it at this server, at the **real route of the page you changed**, derived from the file's path under `src/pages/`. Fix what it flags, rerun.

## Orphan escalation — `wrangler-dev stop` didn't reap it

Port 4321 is still held after stop, or `wrangler-dev status` still lists a pid → a supervisor the helper isn't tracking (a raw `wrangler dev` from a prior session, or a pidfile whose pgid no longer matches the tree) is respawning it. Kill its whole process GROUP by number:

1. Read-only first: `ps axo pid,ppid,pgid,args | grep -E 'wrangler|workerd' | grep -v grep` — note the supervisor's PGID (the `node … wrangler.js dev` line). Confirm it is THIS repo: `lsof -a -p <pid> -d cwd -Fn` must print the repo root or a dir under it. Never kill a group from another project.
2. Then `kill -9 -<pgid>` (negative = the group; the group is what stops the respawn).

A bare `pkill workerd` kills the child only; the supervisor respawns it immediately.
