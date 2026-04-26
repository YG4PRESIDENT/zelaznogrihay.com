# Kickoff Prompt

Paste this as your first message into a fresh `claude` session on your Mac, after pulling the branch and `cd`-ing into the repo root.

---

```
Hey Claude — I'm Leo. I'm on my Mac, in the repo root of my website
(zelaznogrihay.com), on branch claude/custom-note-system-IBX8r.
Run `pwd` and `git branch --show-current` to confirm before doing anything.

What this is:
- The folder `brain/` in this repo is a BLUEPRINT, not the live vault.
- The live vault will live at `~/brain/` (its own repo, its own git history).
  It does not exist yet — bin/bootstrap.sh creates it.
- `brain/CLAUDE.md` is the schema for that future vault. Read it for
  context, but its rules only fully apply once you're launched from
  INSIDE ~/brain/ after bootstrap.
- The walkthrough is `brain/SETUP.md`. Read it end-to-end before we
  start so you know where the manual gates are.
- Goal: stand up a Claude Code + Obsidian "second brain" with a one-time
  bulk import of my existing Apple Notes and Google Docs, so you have
  a real foundation to know me from.

How I want you to work:
- Treat SETUP.md as a guided walkthrough, not a TODO list to auto-execute.
  Propose one step at a time, show me the exact command, wait for my
  "go" before running anything that mutates the filesystem, hits the
  network, or installs software.
- Before any `brew install`, check with `--version` / `which` first,
  report what's present, and ask before installing.
- Some steps are mine to do, not yours: buying the Exporter app and
  clicking through its GUI (Step 5), the rclone OAuth browser flow
  (Step 6), installing Obsidian community plugins (Step 2), and the
  optional bootstrap conversation at claude.ai (Step 4). When we hit
  those, announce the handoff and pause. Don't fake progress.
- Never run `git commit` or `git push` in either repo. I handle git.
  The bootstrap script's `git init` on ~/brain/ is fine.
- Never write to `raw-sources/`. Never edit CLAUDE.md, Memory.md, or
  README.md unless I explicitly ask.
- Don't run `/ingest` until I've confirmed the archive folders actually
  have files in them. The 25-file-per-run batch cap is real — flag it
  the first time we ingest.
- If you're unsure about state (did I already bootstrap? is rclone
  installed?), check, then ask. Don't assume.

Tone: direct, terse, no hedging.

Start by:
  1. Confirm pwd and current branch.
  2. Read brain/SETUP.md, brain/CLAUDE.md, brain/README.md.
  3. Tell me which step you think we're on and what the next concrete
     action is.
  4. Wait for my go.
```

---

## After this kickoff lands

Once Claude reports the current step and proposed next action, you respond with `go` (or redirect). From there it walks you through SETUP.md, pausing at every gate.

If something derails mid-setup and you want to resume in a new session, just paste this same prompt again — the only state Claude needs is what's in the files, and `log.md` will tell it where you left off.
