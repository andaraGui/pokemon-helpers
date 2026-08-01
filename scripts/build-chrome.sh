#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist/chrome"
ZIP="$ROOT/dist/pokemon-helper-chrome.zip"

rm -rf "$DIST"
mkdir -p "$DIST"

FILES=(
  app.js
  background.js
  battle.html
  battle.js
  chart.html
  chart.js
  content.js
  index.html
  interceptor.js
  manifest.json
  myPokemons.html
  myPokemons.js
  pixel-theme.css
)

for f in "${FILES[@]}"; do
  cp "$ROOT/$f" "$DIST/$f"
done

cp -r "$ROOT/icons" "$DIST/icons"
cp -r "$ROOT/components" "$DIST/components"

rm -f "$ZIP"
(cd "$DIST" && zip -rq "$ZIP" .)

echo "Built: $ZIP"
