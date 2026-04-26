---
description: Answer a question grounded in the vault. Update wiki/ if needed before answering.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(rg:*), Bash(grep:*), Bash(ls:*), Bash(find:*)
---

Question: $ARGUMENTS

Run the Query Workflow defined in CLAUDE.md section 7.

Process:
1. Read Memory.md for context on Leo.
2. Search wiki/ first (titles, then aliases, then bodies).
3. If wiki/ has the answer, cite the wiki file(s) and answer.
4. If wiki/ is incomplete, search raw-sources/ for missing pieces, write/update the relevant wiki files BEFORE answering, then answer citing the now-updated wiki.
5. End with a `## Sources` block listing the wiki files used.
6. If you genuinely don't know, say so. Do NOT invent.

Append a one-line entry to log.md noting the query.
