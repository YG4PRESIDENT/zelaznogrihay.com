# Bulk Import Apple Notes → Vault

**One-time bulk import.** Run this once to seed `raw-sources/apple-notes-archive/` with everything currently in Apple Notes. Re-run later (every month or so) to pull anything new — the Exporter app skips notes that are already exported (or you can target a specific folder to keep it incremental).

## Why no shell script

Apple Notes lives in a sandboxed SQLite store that's hostile to scripting. The cleanest tool is the [Exporter](https://apps.apple.com/app/exporter/id1099120373) Mac App Store app (~$8). It's a one-time purchase that handles attachments, folders, locked notes, and edge cases that a homegrown AppleScript will miss. Worth the $8.

## Steps

1. **Buy and install Exporter** from the Mac App Store.
   <https://apps.apple.com/app/exporter/id1099120373>

2. **Open Exporter.** First-run will ask for permission to read Apple Notes — grant it. (System Settings → Privacy → Automation → Exporter → Notes if it doesn't prompt.)

3. **Configure the export:**
   - Format: **Markdown**
   - Folder structure: **Preserve folders** (so your Apple Notes folders become subfolders in the export)
   - Attachments: **Include** (images and PDFs get extracted alongside notes)
   - Locked notes: skip (they require your password each time — handle them separately if you care)

4. **Choose destination:**
   `~/brain/raw-sources/apple-notes-archive/`

5. **Click Export.** Wait. A couple hundred notes takes a few minutes; thousands take 10–20 minutes.

6. **Verify in your terminal:**
   ```bash
   cd ~/brain
   find raw-sources/apple-notes-archive -name "*.md" | wc -l
   ```
   The count should match (roughly) your Apple Notes count.

## Free fallback (if you really don't want to spend $8)

[apple_cloud_notes_parser](https://github.com/threeplanetssoftware/apple_cloud_notes_parser) is a Ruby tool that reads Apple's local NoteStore SQLite database directly. Higher fidelity than Exporter for old/weird notes. Setup is more involved — Ruby + dependencies + tweaking output paths. Use this only if you're comfortable on the command line.

```bash
git clone https://github.com/threeplanetssoftware/apple_cloud_notes_parser.git
cd apple_cloud_notes_parser
bundle install
ruby notes_cloud_ripper.rb -m -o ~/brain/raw-sources/apple-notes-archive/
```

## What's next

Return to `SETUP.md` Step 6 (Google Docs import).
