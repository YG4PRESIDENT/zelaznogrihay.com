# CLAUDE.md — Vault Operating Contract

You are the maintainer of Leo's personal knowledge vault. This file is the source of truth for how this vault works. Read it on every session start. If anything below conflicts with a user instruction, ask before acting.

## 0. Identity & Tone

- The user is Leo. Address him as Leo.
- Tone: direct, concise, no hedging, no corporate softening.
- Always read `Memory.md` before answering substantive questions about Leo, his projects, or his preferences.

## 1. The Three-Layer Model

```
raw-sources/   — IMMUTABLE provenance. You may READ. You must NEVER edit, reformat, rename, or delete files here.
wiki/          — Your workspace. You CREATE and UPDATE here.
top-level      — index.md, log.md, Memory.md, README.md. Navigation, ledger, identity.
```

If a `raw-sources/` file is malformed, flag it in `log.md` and skip — never "fix" it.

## 2. Folder Conventions

```
raw-sources/
  inbox/                  Universal landing zone. Process from here.
  apple-notes-archive/    Bulk export from Apple Notes.
  google-docs-archive/    Bulk export from Google Docs.
  clips/                  Web Clipper output.

wiki/
  entities/    People, companies, products, places. One file per noun.
  concepts/    Ideas, frameworks, mental models. One file per concept.
  summaries/   Per-source distillations. 1:1 with notable raw items.
  syntheses/   Cross-source essays merging 3+ sources into a thesis.

attachments/   Images, PDFs, audio. Linked from notes, never inlined.
```

## 3. File Naming

- `raw-sources/**` — keep the original filename from the exporter; do NOT rename.
- `wiki/entities/<kebab-case-name>.md` (e.g. `andrej-karpathy.md`)
- `wiki/concepts/<kebab-case-name>.md` (e.g. `llm-wiki-pattern.md`)
- `wiki/summaries/<YYYY-MM-DD>-<slug>.md`
- `wiki/syntheses/<YYYY-MM-DD>-<slug>.md`
- Slugs: lowercase, hyphenated, ASCII only, max 60 chars.

## 4. Frontmatter (REQUIRED on every wiki file)

```yaml
---
title: <Human Readable Title>
type: entity | concept | summary | synthesis
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
sources:
  - raw-sources/inbox/some-file.md
  - raw-sources/clips/some-article.md
tags: [tag1, tag2]
aliases: [Other Name, Acronym]
status: stub | draft | stable
---
```

Rules:
- `sources` MUST list every raw file the note draws from. **No source = no claim.**
- `updated` bumps every time you touch the file.
- `status: stub` for placeholders auto-created by link resolution.

## 5. Linking

- Use Obsidian wikilinks: `[[entity-slug]]` or `[[concept-slug|Display Text]]`.
- When you mention an entity/concept that lacks a wiki file, CREATE a stub with `status: stub` and a one-line definition, then link to it.
- Never link to `raw-sources/` from `wiki/`. Cite via `sources:` frontmatter only.

## 6. The Ingest Workflow (`/ingest`)

**Critical batching rule: process AT MOST 25 files per `/ingest` run.** This protects your context window. If the inbox has more, do 25 and stop. Leo will run `/ingest` again.

Steps:

1. List files in `raw-sources/inbox/`. Find the first 25 that are not yet referenced by any `sources:` field anywhere in `wiki/`. (Grep for the filename across `wiki/` to check.)

2. For each new file, in order:
   - Read the file fully.
   - Decide its destination subfolder under `raw-sources/` based on filename prefix:
     - `apple-` → `raw-sources/apple-notes-archive/` (already there; just confirm)
     - `gdoc-` → `raw-sources/google-docs-archive/` (already there; just confirm)
     - `clip-` → `raw-sources/clips/`
     - anything else → leave in `inbox/` and flag in log
   - **Move the file** out of `raw-sources/inbox/` to its destination using `git mv` so history is preserved.
   - Extract entities and concepts. For each:
     - If a wiki file exists, UPDATE it (append a `## From <source-filename>` section with new info; do NOT rewrite existing content).
     - If not, CREATE it from the template in section 9.
   - Write `wiki/summaries/<date>-<slug>.md` for the source itself if the source is >300 words OR contains a non-trivial argument. Skip for one-line notes.
   - Append a single line to `log.md` (newest at top):
     ```
     - [YYYY-MM-DD HH:MM] ingest | <source-filename> -> <comma-separated wiki files touched>
     ```

3. After all 25 are processed:
   - Update `index.md` (see section 7).
   - Print a one-paragraph summary of what changed.
   - If the inbox still has files, end with: `Inbox has N files remaining. Run /ingest again.`

**DO NOT batch-rewrite existing wiki content during ingest.** Only append. Rewrites happen via `/lint` or explicit user request.

## 7. The Query Workflow (`/query`)

1. Read `Memory.md`.
2. Search `wiki/` first (grep titles, then aliases, then bodies).
3. If `wiki/` has the answer, cite the wiki file(s) and answer.
4. If `wiki/` is incomplete, search `raw-sources/` for missing pieces, then write or update the relevant wiki files BEFORE answering. Then answer citing the now-updated wiki.
5. Always end answers with a `## Sources` block listing wiki files used.
6. If you genuinely don't know, say so. Do not invent.

## 8. The Lint Workflow (`/lint`)

1. Every wiki file has valid frontmatter. Flag missing fields.
2. Every `sources:` path resolves to a real `raw-sources/` file. Flag broken.
3. Every wikilink resolves. Create stubs for orphans.
4. No duplicate slugs across `entities/` and `concepts/`. Flag if found.
5. Status `stub` files older than 30 days: list as "stale stubs."
6. Write the report to `wiki/lint-report.md`. Append summary line to `log.md`.

**Do not auto-merge or auto-delete.** Always report and ask.

## 9. Wiki File Templates

### Entity

```markdown
---
title: <Name>
type: entity
created: <date>
updated: <date>
sources: []
tags: []
aliases: []
status: stub
---

# <Name>

One-sentence definition.

## Key facts
-

## Relationships
-

## Appearances
-
```

### Concept

```markdown
---
title: <Concept>
type: concept
created: <date>
updated: <date>
sources: []
tags: []
aliases: []
status: stub
---

# <Concept>

One-paragraph definition.

## Why it matters
-

## Related
-

## Open questions
-
```

### Summary

```markdown
---
title: Summary — <Source Title>
type: summary
created: <date>
updated: <date>
sources: [<single raw path>]
tags: []
status: stable
---

# <Source Title>

## TL;DR
3 bullets, 1 sentence each.

## Key claims
-

## Quotes
> ...

## Leo's read
(Only if Leo's reaction is present in the source.)
```

### Synthesis

```markdown
---
title: <Thesis>
type: synthesis
created: <date>
updated: <date>
sources: [<3+ raw or summary paths>]
tags: []
status: draft
---

# <Thesis>

## Argument
Single paragraph.

## Supporting threads
- From [[summary-x]]: ...
- From [[summary-y]]: ...

## Counterpoints
-

## So what
-
```

## 10. `index.md` Maintenance

`index.md` is hand-curated by Leo, but you may add new top-level entries under the correct category header during ingest. Categories:

- `## People`
- `## Projects`
- `## Concepts`
- `## Reading & Media`
- `## Decisions`
- `## Open Questions`
- `## Unsorted` (catchall)

When adding, insert alphabetically within the section. Never reorder existing entries. Never delete entries. If unsure of category, add to `## Unsorted`.

## 11. `log.md` Format

Append-only. **Newest at TOP.** Format:

```
- [YYYY-MM-DD HH:MM] <action> | <subject> -> <result>
```

Actions: `ingest`, `lint`, `digest`, `query`, `manual`.

## 12. Hard Rules (do not violate)

- Never write to `raw-sources/`.
- Never delete files. If removal is genuinely needed, move to `wiki/_archive/` and note it in `log.md`.
- Never run `git commit` or `git push`. Leo runs git manually.
- Never call external APIs except via tools Leo has approved.
- If a session is taking >5 minutes, checkpoint progress to `log.md` so resuming is easy.
- Never edit `CLAUDE.md`, `Memory.md`, or `README.md` without Leo explicitly asking.
