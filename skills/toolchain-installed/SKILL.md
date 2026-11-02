---
name: toolchain-installed
description: "Index of the installed macOS toolchain. Use to drive or screenshot a browser, check a render, make mockups or icons, run wrangler dev, or fix pnpm, node_modules, ESM/CJS."
---

# macOS toolchain

Everything here is installed and on PATH on the silicon-valley agent account (Nix packages plus npm CLIs in `~/.npm-global`). On another Mac, check with `command -v <tool>` first. Read the one slice the task needs:

- **Browser** (playwright-cli, agent-browser, firecrawl, CDP, dev servers) → [browser.md](browser.md) — drive a browser: verify interactive UI, HMR dev servers, render checks, cross-engine checks; the auth split.
- **Media** (images, icons, animated icons, color) → [media.md](media.md) — author mockups and SVG icons, extract color and diffs from a render instead of eyeballing.
- **Cloudflare** (wrangler-dev) → [cloudflare.md](cloudflare.md) — atomic-teardown local `wrangler dev`, rebuild cycle, deploy auth. The `cf` API CLI → **cloudflare-cf** skill.
- **Node** (npm CLIs, node_modules, pnpm, ESM/CJS) → [node.md](node.md) — the `~/.npm-global` bins, pnpm, ESM/CJS resolution.
- **System** (packages, recipes) → [system.md](system.md) — CLI/image packages + Lighthouse/screenshot recipes.
