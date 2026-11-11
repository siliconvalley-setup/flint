# Node

Node 26. Global npm CLIs in `~/.npm-global/bin`:

| Command | Use |
|---|---|
| `tailwindcss` | Tailwind v4 standalone, `--watch` |
| `svgo` | SVG optimizer |
| `culori` | library: OKLCH, ΔE, `wcagContrast`, `wcagLuminance` |
| `tsc` | TypeScript compiler. LSP servers: rule `available_tools.md` |
| `sg` (ast-grep) | structural code search |
| `lighthouse` | audits |

## pnpm
- Use `pnpm` (12, global). No corepack.
- `wrangler` and `playwright` are not global: `pnpm add -D <name>` in project.

## ESM vs CJS
- Global libraries load only with `require` (`NODE_PATH`). ESM `import` fails: use `createRequire(import.meta.url)` or add package to project.
- Project `node_modules` wins over global.
- `SyntaxError: Named export not found` (CJS package): `import pkg from 'name'; const {x} = pkg;`.
- Playwright library: add `playwright` to project, then `import {chromium} from 'playwright'`. Browser install: [browser.md](browser.md).
