---
name: cloudflare-cf
description: "Call the Cloudflare API with the cf CLI: DNS, zones, Workers config, R2, KV, D1, Queues, Zero Trust, WAF. Use before the first cf call, or on a cf auth, account, zone or unknown-command error."
---

# Cloudflare — the `cf` CLI

`cf` (npm `cf`, global in `~/.npm-global`, invoke via Bash) is Cloudflare's official unified CLI: the whole Cloudflare API, read + write, JSON on stdout.

**Wrangler stays.** `cf` is the API surface; `wrangler` (+ the `wrangler-dev` wrapper, **toolchain-installed** skill, cloudflare.md) is still local dev, deploy and Workers-specific commands. Same token serves both.

## Auth — nothing to do

| Priority | Source | On the silicon-valley agent account |
|---|---|---|
| 1 | `CLOUDFLARE_API_TOKEN` env | **already exported** from the `cloudflare-api-token` secret |
| 2 | named OAuth profile (`cf auth login`) | not used — the env token wins anyway |

Account and zone the same way:

| Env | Secret | Override |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | `cloudflare-account-id` | — |
| `CLOUDFLARE_ZONE_ID` | not set | `--zone` / `-z` per call (**takes precedence**) |

- The human sets or rotates either secret in silicon-valley (`./silicon-valley.sh`, menu `k`). On another Mac, export both env vars yourself.
- `cf` keeps state and named profiles under `~/.config/cloudflare/`. You should never need it: the env path uses none of it.
- Sanity check: `cf auth whoami`. It is the fastest way to tell a bad token from a bad request.

## Discovery — all in-binary

The command tree is not documented here on purpose: `cf` generates its own docs from the same schema that generates its commands, so what the binary says is always the version you are running.

| Step | Command |
|---|---|
| find the command for a task | `cf cli search "<task>"` (five JSON matches) |
| flags of one command | `cf <command> --help` |
| request/response schema of one command | `cf schema dns records create` (`cf schema --list` for all) |
| Cloudflare docs and guides | `cf docs search "<question>"` |

Keep `cf cli search` and `cf docs search` queries anonymous: action and resource type only, no names, domains, account or resource IDs, tokens. The CLI asks for this.

## Calling convention

- Output is **JSON on stdout**; spinners, status and errors go to **stderr**. `cf zones list | jq '.[].name'` is safe with no filtering.
- `--dry-run` exists on create/update/delete. Use it before any mutation — this is a production account.
- `CF_NO_OSC_PROGRESS=1` is exported on silicon-valley (the CLI otherwise paints progress into the terminal title with OSC escapes, which is noise in captured output).

## Identifier gotchas (wrong = wrong account, silently)

| Thing | Comes from | Gets confused with |
|---|---|---|
| account | `CLOUDFLARE_ACCOUNT_ID` env | the zone ID — different object, both 32-hex |
| zone | `--zone`/`-z`, else `CLOUDFLARE_ZONE_ID` | the domain name; some commands take either, most want the ID |
| zone name → ID | `cf zones list \| jq '.[] \| {name, id}'` | guessing |

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `401` / authentication error | token missing, expired or revoked | `cf auth whoami`; then ask the human to rotate `cloudflare-api-token` |
| `403` on a specific call | token lacks that permission scope | edit the token's permissions in the Cloudflare dashboard |
| "account not found" / empty results | `CLOUDFLARE_ACCOUNT_ID` unset or the wrong account | `env \| grep CLOUDFLARE_ACCOUNT_ID`; ask the human to set `cloudflare-account-id` |
| unknown command / unknown flag | churn between minors | `cf schema --list`, `cf <group> --help` — the binary is the source of truth |
| non-zero exit, empty stdout | the detail is on **stderr** | re-run without `2>/dev/null` |

## Trust calibration

`cf` is a **beta** (`cf --version`), installed at `latest`. Expect flag and command-name churn across releases; discovery is always live from the installed binary, so you never read docs for a version you are not running. A silent semantic change to an existing command is not covered: if a command starts doing something unexpected, tell the human to pin the version in silicon-valley `npm-cli.txt`.
