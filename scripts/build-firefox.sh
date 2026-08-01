#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist/firefox"
ZIP="$ROOT/dist/pokemon-helper-firefox.zip"

rm -rf "$DIST"
mkdir -p "$DIST"

FILES=(
  app.js
  background.js
  battle.html
  battle.js
  content.js
  index.html
  interceptor.js
  myPokemons.html
  myPokemons.js
  pixel-theme.css
)

for f in "${FILES[@]}"; do
  cp "$ROOT/$f" "$DIST/$f"
done

cp "$ROOT/manifest.firefox.json" "$DIST/manifest.json"
cp -r "$ROOT/icons" "$DIST/icons"
cp -r "$ROOT/components" "$DIST/components"

rm -f "$ZIP"
(cd "$DIST" && zip -rq "$ZIP" .)

echo "Built: $ZIP"
