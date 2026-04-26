# Brain — Leo's Second Brain (Blueprint)

This folder is the **blueprint** for a Claude Code + Obsidian "second brain" in the style of Andrej Karpathy's LLM Wiki pattern (and Leo's writeup that started this).

**This is not the live vault.** The live vault lives at `~/brain/` on your Mac. This folder is the version-controlled template that gets copied there.

## Start here

Open `SETUP.md`. Follow the steps top-to-bottom.

## What's in this folder

```
SETUP.md         — The walkthrough. Open this first.
CLAUDE.md        — The schema. Tells Claude how the vault is structured.
Memory.md        — Skeleton for "who Leo is." Fill in during setup.
index.md         — Hand-curated table of contents. Claude appends; Leo reorders.
log.md           — Append-only ledger of every ingest/query/lint.

.claude/         — Claude Code project config + slash commands
  settings.json    Permissions, model pin
  commands/        /ingest, /query, /lint, /digest

raw-sources/     — Where your stuff lands (immutable)
wiki/            — Where Claude writes (the organized brain)
attachments/     — Images, PDFs, audio

bin/             — Setup scripts
  bootstrap.sh           Copies this folder to ~/brain/ and inits git
  import-apple-notes.md  How to bulk-import Apple Notes (uses Exporter app)
  import-gdocs.sh        Bulk-import Google Docs via rclone + pandoc
  drain-archives.sh      Stages files into inbox/ in batches of 25 for /ingest
```

## The core idea (one paragraph)

You keep writing notes wherever you write them now (Apple Notes, Google Docs, browser, voice). They land as markdown in `raw-sources/`. Claude Code reads them, writes summaries and entity/concept pages into `wiki/`, links everything together, maintains an index. You browse the result in Obsidian. The wiki is a persistent, compounding artifact — not a chatbot that re-derives answers from scratch on every question.
