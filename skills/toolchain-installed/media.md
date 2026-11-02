# Mockups, icons, color (all headless)

Model vision drops resolution and loses exact text and color. Run a tool, then reason on its output.

- **Fonts** — macOS system fonts only; confirm with `system_profiler SPFontsDataType | rg '<family>'`. A mockup needing Inter/Roboto loads it via `@font-face` from a CDN or the project.
- **Icons** — inline an existing SVG instead of redrawing: fetch one (lucide, heroicons) from a CDN, or author it. Then `svgo in.svg -o out.svg`.
- **Animated icon** — author a static SVG + CSS keyframes/SMIL, serve it, then capture frames with `playwright-cli` screenshots and assemble them with `ffmpeg`.
- **Raster → SVG** — `potrace` (bitmap → SVG, one color: convert to PBM with `magick in.png in.pbm` first).
- **Exact color** — sample the pixel with `vips` / `magick`; WCAG contrast via `culori`: `node -e 'const {wcagContrast}=require("culori"); console.log(wcagContrast("#fff","#777"))'` (global libs resolve with `require`, not `import`).
- **Match the design** — `magick compare a.png b.png diff.png` (pixel diff).
- **PDF** — `pdftoppm -png in.pdf p` → one PNG per page.
