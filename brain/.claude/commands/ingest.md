---
description: Process up to 25 new files in raw-sources/inbox/ — route them, write summaries, update wiki, log everything.
allowed-tools: Read, Write, Edit, Bash(git mv:*), Bash(ls:*), Bash(rg:*), Bash(grep:*), Bash(find:*)
---

Run the Ingest Workflow defined in CLAUDE.md section 6.

Hard rules for this run:
- Process AT MOST 25 files. If the inbox has more, process 25 and stop.
- Skip any file already referenced in any wiki/ `sources:` field.
- For each file: route it (git mv to the right raw-sources/<sub>/), write summary if >300 words, update or create entity/concept pages, append to log.md.
- Update index.md additions under the correct category headers.
- DO NOT rewrite existing wiki content. Only append.
- DO NOT git commit. Leo handles commits.

End with:
1. A one-paragraph plain-English summary of what changed.
2. The exact count: "Processed N files. Inbox has M files remaining."
3. If M > 0, prompt: "Run /ingest again."
