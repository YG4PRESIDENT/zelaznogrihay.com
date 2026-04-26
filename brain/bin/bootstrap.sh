#!/usr/bin/env bash
# bootstrap.sh — copy the brain/ blueprint to ~/brain/ and init git there.
#
# Run from the website repo root:
#     bash brain/bin/bootstrap.sh
#
# This script is idempotent on rerun for missing folders, but will refuse to
# overwrite existing files in ~/brain/. If you want a clean slate, rm -rf
# ~/brain/ first (yes, manually — this script will not do that for you).

set -euo pipefail

BLUEPRINT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${BRAIN_DEST:-$HOME/brain}"

echo "Blueprint:   $BLUEPRINT_DIR"
echo "Destination: $DEST"
echo ""

if [[ -e "$DEST" && -n "$(ls -A "$DEST" 2>/dev/null)" ]]; then
  echo "WARNING: $DEST already exists and is not empty."
  read -r -p "Continue anyway and merge (will not overwrite existing files)? [y/N] " ans
  if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

mkdir -p "$DEST"

# Copy blueprint, but never overwrite existing files in destination.
# rsync --ignore-existing is the cleanest way to do this.
if command -v rsync >/dev/null 2>&1; then
  rsync -av --ignore-existing \
    --exclude=".git" \
    "$BLUEPRINT_DIR/" "$DEST/"
else
  # Fallback if rsync is missing.
  cp -Rn "$BLUEPRINT_DIR/." "$DEST/"
fi

# Make scripts executable.
chmod +x "$DEST"/bin/*.sh 2>/dev/null || true

# Init git in the vault if it isn't already a repo.
cd "$DEST"
if [[ ! -d ".git" ]]; then
  git init -q
  git add .
  git commit -q -m "Initial vault from blueprint" || true
  echo ""
  echo "Initialized fresh git repo in $DEST"
else
  echo ""
  echo "Existing git repo detected in $DEST — skipped git init."
fi

echo ""
echo "Done. Next:"
echo "  1.  open -a Obsidian \"$DEST\""
echo "  2.  cd \"$DEST\" && claude"
echo "  3.  Follow SETUP.md from step 2 onward."
