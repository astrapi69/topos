#!/usr/bin/env bash
#
# Reproducibly generate the PWA icon set from the 512x512 master.
#
# Source:  frontend/public/icon-512.png  (the real Topos favicon/logo)
# Output:  frontend/public/icons/*.png + favicon.svg
#
# Requires ImageMagick (`magick`). Re-run after the master icon changes
# (e.g. when the placeholder is replaced by the final Midjourney favicon).
#
# Usage:  ./scripts/generate-pwa-icons.sh
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="public/icon-512.png"
OUT="public/icons"
THEME="#1e40af" # tailwind blue-800, matches the manifest theme_color

if ! command -v magick >/dev/null 2>&1; then
    echo "error: ImageMagick (magick) is required" >&2
    exit 1
fi
if [ ! -f "$SRC" ]; then
    echo "error: source icon $SRC not found" >&2
    exit 1
fi

mkdir -p "$OUT"

# Standard square icons.
for size in 16 32 72 96 128 144 152 192 384 512; do
    magick "$SRC" -resize "${size}x${size}" "$OUT/icon-${size}x${size}.png"
done

# Apple touch icon (180x180, no alpha so iOS does not add its own bg).
magick "$SRC" -resize 180x180 -background white -alpha remove -alpha off \
    "$OUT/apple-touch-icon.png"

# Maskable icon: the logo sits inside the ~80% safe area on a solid
# theme-coloured background so platform masks never clip it.
magick "$SRC" -resize 410x410 -background "$THEME" -gravity center \
    -extent 512x512 "$OUT/maskable-icon-512x512.png"

# Minimal vector favicon placeholder (white "T" on theme blue). Replaced
# later by the final vector favicon.
cat > "public/favicon.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1e40af"/>
  <path d="M136 152h240v52h-94v204h-52V204h-94z" fill="#ffffff"/>
</svg>
SVG

echo "Generated $(ls "$OUT" | wc -l) icons in $OUT + public/favicon.svg"
