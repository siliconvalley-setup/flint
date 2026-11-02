# System packages

CLI: git, gh, jq, rg, fd, tree, wget, sqlite3, socat, ssh, autossh, gcloud, vultr-cli, java + javac 21 (openjdk21), node 26, python3, uv, herdr, age · Image: imagemagick, graphicsmagick, vips, ffmpeg + ffprobe (libvmaf: `-lavfi libvmaf`), cwebp, avifenc, heif-dec, exiftool, pdftoppm, optipng, pngquant, jpegoptim, gifsicle, advancecomp, potrace, rsvg-convert, icoutils, ghostscript. All from Nix on the silicon-valley agent account; no Homebrew, no sudo.

# Recipes

- Lighthouse: `lighthouse URL --chrome-flags="--headless=new" --only-categories=accessibility,best-practices,seo --output=html --output-path=/tmp/audit.html`
- Light + dark shots: loop `['light','dark']` → `newContext({colorScheme:scheme, viewport:{width:1440,height:900}})` → `goto(url,{waitUntil:'domcontentloaded'})` → `screenshot({path, fullPage:true})`
- CSS-animated element: scroll with `page.evaluate(() => el.scrollIntoView())` — `scrollIntoViewIfNeeded` times out ("not stable").
