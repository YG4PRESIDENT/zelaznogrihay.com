# Goal: Restore public mind map

> Format: 2
> Goal ID: 2026-07-30-restore-public-mind-map
> Status: active
> Started: 2026-07-30T20:24:44.330Z
> Updated: 2026-07-30T20:31:44.642Z
> Branch: wip/2026-07-30-restore-public-mind-map
> Base: a52c8dc3c49ff2dbf03d3eff53b9f091636ec853
> Outcome: The interactive mind map is restored on zelaznogrihay.com without reverting unrelated portfolio or blog changes.
> Done when: The site builds successfully, the generated mind-map page and dataset exist, the restoration is safely committed and pushed, and the live mind-map route responds successfully.

## Work units

### U1 — Restore mind-map source and data

- Status: done
- Acceptance: Navigation, page, renderer, sync script, dependencies, graph, and note exports match the last known-good pre-removal version while unrelated portfolio changes remain intact.
- Proof: All 1,726 mind-map-specific files and manifests hash-match the last pre-removal commit; Work and blog paths have no diffs.
- Blocker: —
- Completed: 2026-07-30T20:27:12.235Z

### U2 — Validate the restored static site

- Status: done
- Acceptance: A clean production build succeeds and emits mind-map/index.html plus the graph and note assets referenced by the renderer.
- Proof: npm ci and Astro production build succeeded; dist contains /mind-map/index.html, a 1,718-node/10,286-edge graph, 1,718 note JSON files, and all 1,718 graph detail paths resolve to non-empty generated files.
- Blocker: —
- Completed: 2026-07-30T20:31:35.344Z

### U3 — Publish and verify the restoration

- Status: in_progress
- Acceptance: The restoration commit reaches the deployment branch and the live /mind-map/ and graph endpoints return HTTP 200.
- Proof: —
- Blocker: —
- Completed: —

## Rebaselines

- None yet.

## Checkpoints

- 2026-07-30T20:27:48.358Z | 33% | Restore interactive mind map
- 2026-07-30T20:31:44.642Z | 67% | Record mind map build proof

## Next

Push the fast-forward restoration to master, monitor GitHub Pages, and verify both live endpoints return HTTP 200.
