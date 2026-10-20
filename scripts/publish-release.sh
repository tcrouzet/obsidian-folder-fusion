#!/bin/bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

TAG=$(node scripts/check-release.mjs)
REPO=$(node -p "require('./commit.json').repo")

gh release create "$TAG" main.js manifest.json styles.css \
  --repo "$REPO" \
  --verify-tag \
  --title "$TAG" \
  --generate-notes
