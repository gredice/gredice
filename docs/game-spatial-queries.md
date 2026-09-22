# Shared garden spatial queries

`packages/game/src/spatial` owns the runtime query primitives. The picking
broad phase uses four-unit X/Z chunks. Each target belongs to every chunk
intersecting its conservative hitbox bounds, including boundaries. Rays are
clipped to the garden envelope and traverse chunks with a supercover DDA;
vertical rays visit one chunk. Candidate deduplication and original garden
ordering preserve the existing exact AABB resolver, nearest hit, and equal-hit
tie behavior. Rotated/non-unit footprints and corner-stair aliases still use
the existing hitbox policy.

`BlockInteractionLayer` commits index changes in a layout effect before input
can read them. Immutable stack/catalog snapshots reuse derived targets, and
synchronization changes membership only when a target's bounds change or a
key is inserted/removed. Payload/order changes invalidate the query version
without rebuilding membership. Explicit stale query versions are rejected.
The envelope expands conservatively after removals and resets when empty;
this avoids scanning the whole index to shrink its bounds. Reconciliation
still visits target keys when the garden snapshot changes; pointer queries do
not visit the whole garden.

Placement uses the same `GardenCellMap` for exact footprint occupancy and
stack lookup. Placement retains its moving-block exclusions, water support,
height matching, and storage/recycler rules. Cow and rabbit path validation
build one spatial surface query per path operation, then retain the original
rotation, epsilon, slope, water/ground, and highest-surface narrow phase for
each sample. These policies are deliberately separate from visual hitboxes.

`getCameraFrame` returns one versioned frame per actual Three.js camera, with
view/projection/combined matrices, frustum, viewport pixels, target, and zoom.
Reads refresh world matrices (including ancestors) before checking for changes,
so events and avatar writes do not depend on subscriber order. Camera-rig
publications update the shared target before notifying listeners. Camera
replacement gets a separate frame; viewport, target, zoom, and matrix changes
advance its version. Callers use frames synchronously and can supply an expected
version to detect stale work.

Generated plant groups, individual plant LOD, decoration chunks, and night-light
selection reuse this frame. Existing plant hysteresis/focus overrides,
decoration conservative bounds, and light influence spheres/sticky selection
remain in their policy helpers. Plant and decoration frame checks also observe
avatar camera changes after its -100 update priority, including camera swaps.

Runtime diagnostics are available in `window.__grediceGameProfile.spatialPicking`
and `.spatialCamera`: candidate counts, visited chunks, query count/duration,
entry updates/rebuilds, shared frame reads/rebuilds, projection/frustum tests,
and stale-version rejections. Existing interaction-resolution timings include
both broad and narrow phases. Counters mutate in place rather than triggering
React state updates per query.

## Validation

- Game unit tests include linear/indexed parity across 1,347 rays through a
  stacked, overlapping, rotated garden; vertical candidate counts remain 25
  when the garden grows from 400 to 6,400 targets.
- WebGL component coverage in `spatial-interaction.spec.tsx` clicks the actual
  interaction layer before/after a rotated footprint patch and checks that
  only that target's memberships change. `cursor-anchored-zoom.spec.tsx` checks
  real wheel input and world-position anchoring.
- The production cross-tier matrix remains `pnpm --filter garden
  profile:game:cross-tier`. Before/after captures use identical scenario inputs
  and separate clean source commits. These are local headless production-build
  measurements, separate from deployed or physical-device acceptance.

Run the picking CPU diagnostic independently of WebGL:

```bash
pnpm --filter @gredice/game benchmark:spatial
```

On the local ARM64 Node 24.15.0 run on 2026-09-23, 1,000 vertical rays took
7.32 ms with the linear resolver versus 2.08 ms with the index for 400 targets,
and 97.36 ms versus 2.11 ms for 6,400 targets. Mean candidate counts were 23 and
24.505 respectively (edge chunks contain fewer targets). These short CPU
samples demonstrate query scaling; they are not renderer or device FPS claims.

The candidate production capture at runtime commit
`7ce2a11de3f89806487a2c49d63aeac837f39a55` passed all 30 cross-tier runs (three
repeats of steady and camera-motion workloads for Low, Medium, High,
Auto-standard, and Auto-constrained). Its Garden build, Game/Garden/WWW
typechecks, Game lint, and both targeted WebGL tests passed. The Game suite
contains 2,064 passing tests.

For paired comparison, run the same clean harness commit against both served
production builds. Start each already-built app separately, then run both
captures with `profile:game:existing` and `GAME_PROFILE_BASE_URL` pointing to
the appropriate external server, without the build/start-server flags. Both
reports must have identical harness, runtime, server-mode, and build-performed
provenance. The report's served-build
marker must identify the baseline source, while harness provenance stays equal
to the candidate capture. `compare-game-profile-reports.mjs --allow-partial`
compares this cross-tier subset diagnostically; the full canonical release gate
also requires fauna, garden-switch, lifecycle, and independent confirmation
captures. Never relabel diagnostic cross-tier evidence as that full gate or as
physical-device validation.
