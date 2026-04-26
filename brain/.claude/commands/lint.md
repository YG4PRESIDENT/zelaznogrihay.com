---
description: Health-check the vault. Validate frontmatter, sources, links, slugs. Report only — no auto-fix.
allowed-tools: Read, Edit, Glob, Grep, Bash(rg:*), Bash(grep:*), Bash(ls:*), Bash(find:*)
---

Run the Lint Workflow defined in CLAUDE.md section 8.

Checks:
1. Every wiki file has all required frontmatter fields (title, type, created, updated, sources, status).
2. Every `sources:` path resolves to a real raw-sources/ file.
3. Every `[[wikilink]]` resolves. Stub creation is OK; missing-with-no-stub is not.
4. No duplicate slugs across entities/ and concepts/.
5. `status: stub` files older than 30 days are flagged as stale.
6. Orphan pages (no inbound links and not stubs) are flagged.
7. Concepts mentioned >3 times in wiki bodies but lacking a dedicated page → suggest creating one.

Output: write the full report to `wiki/lint-report.md` (overwrite). Append a summary line to log.md.

DO NOT auto-fix anything. DO NOT delete or merge files. Just report.
