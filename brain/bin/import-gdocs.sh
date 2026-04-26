#!/usr/bin/env bash
# import-gdocs.sh — bulk import Google Docs into raw-sources/google-docs-archive/.
#
# What it does:
#   1. Verifies rclone + pandoc are installed (prompts to brew install if not).
#   2. Verifies an rclone remote named "gdrive" exists (prompts to run rclone config if not).
#   3. Pulls every Google Doc inside a chosen Drive folder as .docx (server-side export).
#   4. Runs pandoc to convert each .docx to .md with images extracted.
#   5. Drops the .md files into raw-sources/google-docs-archive/ with a "gdoc-" prefix.
#
# Re-runnable. Already-converted files are skipped (filename match).
#
# Run from the vault root:
#     bash bin/import-gdocs.sh
#
# Customize via env vars:
#     GDRIVE_FOLDER="Notes"   # which Drive folder to import (default: Notes)
#     GDRIVE_REMOTE="gdrive"  # name of your rclone remote (default: gdrive)

set -euo pipefail

VAULT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$VAULT_ROOT/raw-sources/google-docs-archive"
TMP="$(mktemp -d)"
GDRIVE_FOLDER="${GDRIVE_FOLDER:-Notes}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# --- 1. Dependencies ---
need() { command -v "$1" >/dev/null 2>&1; }

if ! need rclone || ! need pandoc; then
  echo "Missing dependencies. Install with:"
  echo "  brew install rclone pandoc"
  exit 1
fi

# --- 2. rclone remote ---
if ! rclone listremotes | grep -q "^${GDRIVE_REMOTE}:$"; then
  echo "rclone remote '${GDRIVE_REMOTE}' not configured."
  echo ""
  echo "Run this in another terminal, then re-run this script:"
  echo "  rclone config"
  echo ""
  echo "When prompted, choose:"
  echo "  - n)ew remote"
  echo "  - name: ${GDRIVE_REMOTE}"
  echo "  - storage: drive (Google Drive)"
  echo "  - scope: 1 (full access) or 2 (read-only) — read-only is fine"
  echo "  - leave client_id / client_secret blank (uses rclone's default)"
  echo "  - auto config: y (opens browser)"
  echo ""
  exit 1
fi

# --- 3. Confirm folder ---
echo "Will import Google Docs from: ${GDRIVE_REMOTE}:${GDRIVE_FOLDER}"
echo "Destination:                  $ARCHIVE"
echo ""
read -r -p "Continue? [y/N] " ans
if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

mkdir -p "$ARCHIVE"

# --- 4. Pull docx ---
echo "Pulling Google Docs as .docx..."
rclone copy \
  "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}" \
  "$TMP" \
  --drive-export-formats docx \
  --include "*.docx" \
  --progress

# --- 5. Convert each docx to md ---
echo ""
echo "Converting .docx to .md with pandoc..."
converted=0
skipped=0

while IFS= read -r -d '' docx; do
  base="$(basename "$docx" .docx)"
  # Slugify: lowercase, replace non-alnum with -, collapse multiples, trim.
  slug="$(echo "$base" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' \
    | sed 's/--*/-/g' \
    | sed 's/^-//;s/-$//' \
    | cut -c1-60)"
  out="$ARCHIVE/gdoc-${slug}.md"

  if [[ -f "$out" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  # Extract images alongside the markdown.
  media_dir="$VAULT_ROOT/attachments/gdoc-${slug}"
  pandoc \
    -f docx -t gfm \
    --wrap=none \
    --extract-media="$media_dir" \
    -o "$out" \
    "$docx"

  # Add minimal frontmatter.
  tmp_with_frontmatter="$(mktemp)"
  {
    echo "---"
    echo "source: google-docs"
    echo "original_title: \"$base\""
    echo "imported: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "status: inbox"
    echo "---"
    echo ""
    cat "$out"
  } > "$tmp_with_frontmatter"
  mv "$tmp_with_frontmatter" "$out"

  converted=$((converted + 1))
done < <(find "$TMP" -name "*.docx" -print0)

echo ""
echo "Done. Converted: $converted. Skipped (already in archive): $skipped."
echo "Files are in: $ARCHIVE"
echo ""
echo "Next: return to SETUP.md Step 7."
