# Goal: Publish conviction essay verbatim

> Format: 2
> Goal ID: 2026-07-30-publish-conviction-essay-verbatim
> Status: active
> Started: 2026-07-30T08:27:27.681Z
> Updated: 2026-07-30T08:31:03.146Z
> Branch: wip/2026-07-30-publish-conviction-essay-verbatim
> Base: 1f3e93c53784d093ca8fc06c0814f98802842ce4
> Outcome: A new blog post containing the user's supplied copy verbatim is live on zelaznogrihay.com.
> Done when: The exact supplied body is committed and pushed to master, the production build succeeds, and the GitHub Pages deployment serves the post.

## Work units

### U1 — Add the new blog entry without copy edits

- Status: done
- Acceptance: The Markdown body matches the supplied copy exactly and valid required frontmatter exposes it in Writings.
- Proof: Byte-for-byte diff of Markdown body against supplied copy returned no differences; git diff --check passed; astro sync accepted the frontmatter and content collection.
- Blocker: —
- Completed: 2026-07-30T08:29:55.751Z

### U2 — Validate the generated site

- Status: in_progress
- Acceptance: Astro production build succeeds and the generated post/listing contain the intended title and exact body.
- Proof: —
- Blocker: —
- Completed: —

### U3 — Publish and confirm production

- Status: pending
- Acceptance: The scoped commit is pushed to origin/master and the GitHub Pages deployment succeeds with the post reachable publicly.
- Proof: —
- Blocker: —
- Completed: —

## Rebaselines

- None yet.

## Checkpoints

- 2026-07-30T08:30:43.924Z | 33% | Add conviction blog post verbatim
- 2026-07-30T08:31:03.146Z | 33% | Add conviction blog post verbatim

## Next

Run the production build and inspect the generated listing and post.
