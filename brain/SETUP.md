# Setup Walkthrough — Leo-Style Second Brain

**This is the single document you follow.** Open it on your Mac in a terminal or in Obsidian. Do the steps top-to-bottom. Each step has a command to copy-paste and what you should see when it works.

Total time: ~3–4 hours, mostly waiting (you're not glued to it).

---

## What you're building

```
   Apple Notes ──┐
                 ├──► raw-sources/  ──►  Claude Code  ──►  wiki/
   Google Docs ──┤    (your stuff)      (the engine)      (organized brain)
                 │                                              │
   Web Clipper ──┘                                              ▼
                                                          Obsidian
                                                       (the window)
```

**Obsidian = the window.** **Claude Code = the engine.** **Vault = a folder of markdown.**

---

## What you need before starting

- Mac with admin access
- ~$8 for the Exporter app (Mac App Store)
- Your Google account signed in (for Google Docs export)
- Homebrew installed (`brew --version` to check)
- Claude Code installed (`claude --version` to check)
- Obsidian installed (`open -a Obsidian` to check)

If any of those three are missing:
```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Obsidian
brew install --cask obsidian

# Claude Code: see https://claude.com/product/claude-code
```

---

## Step 0 — Pull this branch on your Mac

You're reading this because you cloned the repo and checked out the branch. If you haven't yet:

```bash
cd ~/path/to/zelaznogrihay.com   # wherever you keep it
git fetch origin
git checkout claude/custom-note-system-IBX8r
git pull
ls brain/
```

You should see: `SETUP.md  CLAUDE.md  README.md  index.md  log.md  Memory.md  .claude/  raw-sources/  wiki/  attachments/  bin/`

---

## Step 1 — Bootstrap the vault to `~/brain/`

The `brain/` folder in this repo is the **blueprint**. Your **actual vault** lives at `~/brain/` (separate from this website repo). The bootstrap script copies the blueprint over.

```bash
cd ~/path/to/zelaznogrihay.com
bash brain/bin/bootstrap.sh
```

You should see: `Vault created at /Users/<you>/brain` and a fresh `git init` inside it.

**Why separate?** This repo deploys to Netlify as your public website. Your private notes don't belong in `dist/`. The blueprint stays here (versioned, re-pullable). The vault lives at `~/brain/` with its own git history.

---

## Step 2 — Open the vault in Obsidian

```bash
open -a Obsidian ~/brain
```

In Obsidian: "Open folder as vault" → select `~/brain` → done. You'll see the folder tree on the left.

Install these 3 community plugins (Settings → Community plugins → Browse):
- **Dataview** — lets Claude (and you) query frontmatter
- **Templater** — page skeletons
- **Omnisearch** — full-text search fallback

Set one preference: Settings → Files & Links → "Default location for new attachments" → `attachments/`.

---

## Step 3 — Point Claude Code at the vault

```bash
cd ~/brain
claude
```

Claude reads `CLAUDE.md` automatically. To verify, ask:

> What's the schema for this vault?

It should describe the 3-layer model (raw-sources / wiki / top-level files) and mention the batch-ingest rule. If it doesn't, something is wrong with `CLAUDE.md` — stop and check.

---

## Step 4 — Bootstrap conversation (20 min, optional but recommended)

Open Claude (the chat at claude.ai, NOT Claude Code) and talk for 20 minutes. Cover:

- Who you are, what you do.
- What you're working on right now.
- Your goals for the next 90 days.
- Tools/projects/people you reference often.
- How you like to be talked to (terse, blunt, no hedging — your call).
- What you want this brain to help with.

Copy the whole conversation. In `~/brain/Memory.md`, paste it under `## From Bootstrap Conversation`. Save.

This is what makes Claude feel like it "already knows you" on session 1. Skip if you'd rather let it learn from the bulk import — `Memory.md` will get richer either way.

---

## Step 5 — Bulk import Apple Notes

Read `bin/import-apple-notes.md` for the full walkthrough. Short version:

1. Buy [Exporter](https://apps.apple.com/app/exporter/id1099120373) — Mac App Store, ~$8.
2. Open it. Click "Export". Choose Markdown. Choose "All Notes". Pick destination `~/brain/raw-sources/apple-notes-archive/`.
3. Wait. (Could be a few minutes for hundreds of notes.)
4. Verify: `ls ~/brain/raw-sources/apple-notes-archive/ | wc -l` — you should see your note count.

---

## Step 6 — Bulk import Google Docs

```bash
cd ~/brain
bash bin/import-gdocs.sh
```

First run will:
1. Prompt you to install `rclone` and `pandoc` if missing (`brew install rclone pandoc`).
2. Walk you through `rclone config` to authorize Google Drive (one-time OAuth — opens a browser).
3. Ask which Drive folder to import (default: your whole Drive, but you almost certainly want a specific folder like `Notes/` — make one and move docs into it first).
4. Pull `.docx` exports of each Google Doc, run `pandoc` to convert to `.md`, drop them in `~/brain/raw-sources/google-docs-archive/`.

Verify: `ls ~/brain/raw-sources/google-docs-archive/ | wc -l`.

---

## Step 7 — Move imports into the inbox

Both archives are now sitting in their own subfolders. Tell Claude where to start:

```bash
cd ~/brain
# Stage the first batch into inbox/
ls raw-sources/apple-notes-archive/ | head -25 | while read f; do
  cp "raw-sources/apple-notes-archive/$f" "raw-sources/inbox/apple-$f"
done
ls raw-sources/google-docs-archive/ | head -25 | while read f; do
  cp "raw-sources/google-docs-archive/$f" "raw-sources/inbox/gdoc-$f"
done
```

(The `apple-` / `gdoc-` prefix tells `/ingest` where to route each file.)

---

## Step 8 — First batch ingest

```bash
cd ~/brain
claude
```

Inside Claude Code:
```
/ingest
```

It'll process the inbox in one batch (max 25 files per run, per `CLAUDE.md` rule), write summaries to `wiki/summaries/`, create entity/concept pages, update `index.md`, append to `log.md`. Takes ~5–15 minutes.

**Sanity check:** open Obsidian, look at `wiki/summaries/`. You should see fresh markdown files. Open the graph view (Cmd+G) — you should see clusters forming.

---

## Step 9 — Drain the rest of the archive

Repeat steps 7+8 until both archive folders are empty. To make this easier:

```bash
# From inside ~/brain, in a regular terminal:
bash bin/drain-archives.sh
```

This stages the next 25 files, runs `claude -p "/ingest"` headlessly, repeats until everything's processed. Run overnight if you have hundreds of notes.

---

## Step 10 — Run a real query

Inside Claude Code:
```
/query What are the recurring themes across my notes from the last year?
```

If the answer cites your own wiki pages (`[[some-concept]]`), the system works. If it makes things up or says "I don't know," check `Memory.md` and the wiki.

---

## Step 11 — Run a lint pass

```
/lint
```

Surfaces orphan pages, broken links, missing frontmatter, stale stubs. Don't auto-fix — just read the report in `wiki/lint-report.md` and fix anything that bothers you.

---

## Step 12 — Going forward (the daily loop)

You're done with setup. From here on:

**Daily** — keep writing in Apple Notes / Google Docs / wherever you write. Use Web Clipper for browser articles (drops into `raw-sources/clips/`). When the inbox accumulates, run `/ingest`.

**Weekly** — run `/lint`. Hand-curate `index.md` for 30 minutes (promote stub pages, archive dead ones).

**Monthly** — re-run `bin/import-apple-notes.md` and `bin/import-gdocs.sh` to pull anything new from Apple Notes / Google Docs. The scripts skip files that are already in the archive folder.

**Whenever you want** — ask Claude Code questions. The longer you use it, the more it knows.

---

## Optional upgrades (only when you feel the friction)

Don't do these on day 1. Add only if/when manual feels annoying:

- **iOS Shortcut for instant capture** — a Share Sheet button that drops Apple Notes into the vault in real-time instead of via monthly re-import.
- **Scheduled Google Docs sync** — `launchd` job that runs `bin/import-gdocs.sh` every hour.
- **Morning digest cron** — `claude -p "/digest"` at 7:30am, output to a file you read with coffee.
- **Voice memo pipeline** — `whisper.cpp` watching your Voice Memos folder.

These are documented in `bin/UPGRADES.md` if/when you want them. Skip until then.

---

## If you get stuck

- Claude Code isn't reading `CLAUDE.md` → make sure you're running `claude` from inside `~/brain/`, not from the website repo.
- `/ingest` is choking on too many files → `CLAUDE.md` says max 25 per run; if it's still struggling, lower to 10 in the slash command.
- Google Docs import fails OAuth → re-run `rclone config` and reauthorize.
- Apple Notes export missing attachments → use the "Include attachments" checkbox in the Exporter app.

For anything else: open Claude Code in `~/brain/` and ask. It has `CLAUDE.md` loaded — it knows how this is supposed to work.
