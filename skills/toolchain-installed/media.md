# Mockups, icons, color, video (headless)

Model vision loses exact text and color. Run tool, reason on its output.

- Fonts: macOS system fonts only. Check: `system_profiler SPFontsDataType | rg '<family>'`. Other font (Inter, Roboto): `@font-face` from CDN or project.
- Icons: reuse existing SVG (lucide, heroicons from CDN) or write one. Then `svgo in.svg -o out.svg`.
- Animated icon: static SVG + CSS keyframes or SMIL. Serve it, take frames with `playwright-cli screenshot`, join with `ffmpeg`.
- Raster to SVG: `magick in.png in.pbm`, then `potrace` (one color).
- Exact color: sample pixel with `vips` or `magick`.
- WCAG contrast: `node -e 'const {wcagContrast}=require("culori"); console.log(wcagContrast("#fff","#777"))'`.
- Design match: `magick compare a.png b.png diff.png`.
- PDF to PNG: `pdftoppm -png in.pdf p` (one PNG per page).
- Video quality: `ffmpeg -i distorted.mp4 -i reference.mp4 -lavfi libvmaf -f null -`.
