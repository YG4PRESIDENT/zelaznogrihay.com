#!/usr/bin/env bash
# drain-archives.sh — stage 25 files at a time from the archives into inbox/,
# then run claude -p "/ingest" headlessly. Repeats until both archives are empty.
#
# Run from vault root:
#     bash bin/drain-archives.sh
#
# This is a long-running job. Run it overnight if you have hundreds of files.
# Ctrl-C is safe — already-ingested files are tracked by Claude in log.md.

set -euo pipefail

VAULT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$VAULT_ROOT"

INBOX="raw-sources/inbox"
APPLE="raw-sources/apple-notes-archive"
GDOCS="raw-sources/google-docs-archive"
BATCH=25

if ! command -v claude >/dev/null 2>&1; then
  echo "claude (Claude Code) is not installed or not on PATH."
  echo "Install: https://claude.com/product/claude-code"
  exit 1
fi

mkdir -p "$INBOX"

stage_batch() {
  local count=0

  # Apple Notes first
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    base="$(basename "$f")"
    cp "$f" "$INBOX/apple-${base}"
    rm "$f"
    count=$((count + 1))
    [[ $count -ge $BATCH ]] && break
  done < <(find "$APPLE" -maxdepth 5 -name "*.md" 2>/dev/null | head -n $((BATCH - count)))

  if [[ $count -lt $BATCH ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      base="$(basename "$f")"
      # Already prefixed with "gdoc-" by import-gdocs.sh; don't double-prefix.
      cp "$f" "$INBOX/${base}"
      rm "$f"
      count=$((count + 1))
      [[ $count -ge $BATCH ]] && break
    done < <(find "$GDOCS" -maxdepth 5 -name "*.md" 2>/dev/null | head -n $((BATCH - count)))
  fi

  echo "$count"
}

iteration=1
while true; do
  remaining_apple=$(find "$APPLE" -maxdepth 5 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  remaining_gdocs=$(find "$GDOCS" -maxdepth 5 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')

  if [[ "$remaining_apple" == "0" && "$remaining_gdocs" == "0" ]]; then
    echo ""
    echo "All archives drained. Done."
    break
  fi

  echo ""
  echo "=== Iteration $iteration ==="
  echo "Remaining: apple=$remaining_apple, gdocs=$remaining_gdocs"

  staged=$(stage_batch)
  if [[ "$staged" == "0" ]]; then
    echo "Nothing to stage. Stopping."
    break
  fi
  echo "Staged $staged files into $INBOX/."

  echo "Running claude -p /ingest..."
  claude -p "/ingest" --output-format text || {
    echo "Claude run failed. Stopping. Check ~/brain/log.md and re-run when ready."
    exit 1
  }

  iteration=$((iteration + 1))
done
