# Node tools — `~/.npm-global/bin`

Node 26 from Nix. The silicon-valley `npm-cli.txt` list installs these globally:

| Command | What |
|---|---|
| playwright-cli | browser automation CLI (skill) |
| agent-browser | interactive / HMR browser CLI (→ browser.md) |
| lighthouse | audits |
| tailwindcss | Tailwind v4 standalone — compile, `--watch` |
| svgo | SVG optimizer (the SVG counterpart to optipng/pngquant) |
| culori | lib — color science (OKLCH, ΔE, WCAG contrast: `wcagContrast` / `wcagLuminance`) |
| typescript-language-server · pyright · tsc | LSP (via the plugins) + the TypeScript compiler |
| ast-grep (`sg`) | structural code search |

The **query CLIs** live here too — `ctx7` · `firecrawl` · `bwt` · `gapi` · `cf` · `fbg` · `qb`. Run them from the shell; each discovers its own command surface (`--help`, `bwt schema`, `cf cli search`).

`pnpm` (12) is a global npm package; there is no corepack. Use **pnpm**. `wrangler` is not global: add it to the project (`pnpm add -D wrangler`).

## ESM vs CJS

Global libraries resolve by bare name through `NODE_PATH` (`~/.npm-global/lib/node_modules`), which only `require` reads: in ESM, `import` of a global library fails; use `createRequire(import.meta.url)` or add the package to the project. A project-local `node_modules` always wins.

Gotcha: a named ESM import from a CJS-only package can fail (`SyntaxError: Named export not found`). Use a default import, then destructure: `import pkg from 'name'; const {x} = pkg;`.

Playwright as a library is not global: add `playwright` to the project, then `import {chromium} from 'playwright'` and `chromium.launch()`.
