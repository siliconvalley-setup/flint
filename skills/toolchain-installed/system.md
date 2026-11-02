# System packages

All from Nix. No Homebrew, no sudo.

- CLI: git, gh, jq, rg, fd, tree, wget, sqlite3, socat, ssh, autossh, gcloud, vultr-cli, java + javac 21, node 26, python3, uv, herdr, age.
- Image and video: magick, gm, vips, ffmpeg + ffprobe (with libvmaf), cwebp, avifenc, heif-dec, exiftool, pdftoppm, optipng, pngquant, jpegoptim, gifsicle, advdef, potrace, rsvg-convert, icotool, gs.

## Recipes
- Lighthouse: `lighthouse <url> --chrome-flags="--headless=new" --only-categories=accessibility,best-practices,seo --output=html --output-path=/tmp/audit.html`
- Light + dark screenshots (Playwright): for each `scheme` in `['light','dark']`: `newContext({colorScheme:scheme, viewport:{width:1440,height:900}})`, `goto(url,{waitUntil:'domcontentloaded'})`, `screenshot({path, fullPage:true})`.
- CSS-animated element: scroll with `page.evaluate(() => el.scrollIntoView())`. `scrollIntoViewIfNeeded` times out ("not stable").
