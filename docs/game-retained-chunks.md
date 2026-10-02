# Retained garden chunks

The main and public garden scenes reconcile incoming stacks into immutable
`RetainedGardenScene` snapshots. Cells are keyed by XYZ, blocks by ID, and render
packets by the existing 8-unit XZ chunk grid. Equal server objects reuse their
previous blocks and stacks. Each packet retains its cells, bounds, exact
interaction entries, raised-bed IDs, archetype usage, and cardinal connectivity.
Only changed chunks and chunks with changed adjacency dependencies advance their
versions. Interaction ordering remains the original stack order for picking ties.

`RetainedEntityChunks` mounts memoized chunk containers. Stationary entity slots
remain inside those containers so their established controls, weather, articulated
parts, and placement-drop identity continue to work. Cow, goat, horse, rabbit,
sheep, and beach-ball actors separately subscribe to the full terrain because movement
can leave their anchor chunk. The Canvas and garden-transition owner are unchanged.

Instanced archetype indexes retain unchanged name groups. Instance reconciliation
and placement addressing retain unaffected mesh chunks across source changes,
including optimistic placement and server acknowledgement. Active placement
projections stay local to their owning chunks. Generated plants and raised-bed
field state continue to use their existing owners.

## Buffer compilation and lifetime

`meshBuffers.ts` writes transforms directly into one output allocation per vertex
attribute, instead of cloning one Three geometry per instance before merging.
It preserves indexed/non-indexed geometry, normalized/interleaved attributes,
normals, tangent handedness, custom weather attributes, and bounds. Source GLTF
buffers are never transferred or disposed. Index storage promotes to 32-bit when
needed.

The small path accepts up to 8,192 output attribute, morph, and index components
with a cumulative 2 ms synchronous budget per task. Larger work goes through one module worker,
one transferable job at a time. Queued jobs pack source data only when dispatched.
Cancellation removes queued jobs and rejects in-flight stale results. Worker
failure or unavailability keeps the existing instanced geometry visible; it does
not force a large synchronous merge. Current transforms and hitboxes are visible
while a replacement packet is compiling.

Stable terrain chunks that share a material and vertex layout are joined
across components into chunk render packets; see
[static render packets](game-static-render-packets.md).

Each committed geometry has one effect owner. Replacement/unmount cancels its
job, disposes its GPU geometry, and releases references. The last compiler lease
terminates the worker and clears its queue and compiler-owned source cache.
Shared GLTF geometry/material ownership is unchanged.

Source reuse is an explicit `MeshCompiler.request(sources, deliver, 'versioned')`
contract. Every in-place attribute, index, weather or morph edit must set
`needsUpdate`; interleaved edits set `attribute.data.needsUpdate`. Callers that
cannot guarantee that contract use the default uncached policy. Replacing an
attribute, array, index or morph source, changing layout/normalization/GPU type,
or changing relative morph semantics invalidates the entry independently of
Three's version counter. Geometry disposal releases its entry.

An unchanged worker source is packed and registered once, then subsequent jobs
send its compiler-owned ID and transforms. The synchronous path keeps a separate
read-only packet, and its first worker registration copies that packet into
independently owned transfer storage. Neither GLTF nor synchronous cache buffers
are transferred. Output arrays always have their own ownership.

The LRU bounds combined synchronous and worker source residency to **4 MiB and
256 source identities per compiler**. Active worker source IDs remain pinned;
a disposed or invalidated active source is retired until its response arrives. Oversized sources and cache
misses that cannot fit beside pinned work compile without residency. Eviction
sends a worker release, and the worker independently enforces the same byte cap.
Worker failure clears its registrations and releases their accounted bytes;
the next request may create a new worker and register fresh copies. The existing
visible fallback handles failed jobs while queued cancellation remains lazy.

The production caller audit has two entry points: `ChunkedMergedMesh` in
`EntityInstancesBlock.tsx`, and `StaticRenderPacketMesh` in
`StaticRenderPacketBatch.tsx`. Their sources are shared decoded GLTF geometry
or weather-prepared clones. `createWeatherSurfaceGeometry` builds fresh arrays
before caching the result; subsequent weather animation changes uniforms, not
those arrays. `planStaticRenderPackets` retains geometry identity without
editing its attributes. Instance placement writes only `instanceMatrix`, whose
version already advances with `needsUpdate`. Articulated fauna and live plant,
decoration, water and meteor buffer writers remain on their existing render
paths and do not supply retained compiler source packets. These static callers
opt into the versioned contract; the raw compiler's default remains uncached.

The shared garden palette integration follows the same contract. It clones
prepared geometry and fills constant per-vertex color, roughness, metalness
and emissive attributes before handing the clone to retained compilation. These
arrays remain immutable for that clone's lifetime; changing the source material
or weather preparation creates a new owned clone. The compiler preserves those
custom attributes and keys residency by that clone's geometry/attribute
identities and versions. Generated clone disposal retires an in-flight worker
source without disposing or detaching the live GLTF arrays. Any future writer
that edits an existing palette array must advance `needsUpdate` or use the
uncached policy.

`chunkCompilerMetrics` reports source packs, packed bytes and pack duration;
registrations, cache hits/misses/evictions; current and peak retained source
bytes; and source/matrix transfer bytes. A repeat compile can therefore prove
that only matrices were transferred. These counters describe ownership and
avoided packing; a GPU or frame-time benefit requires the separate production
profile comparison.

Hidden faces are removed only by the existing tested water-side algorithm. Its
dependencies are the same column and four cardinal neighbors, including across
chunk boundaries and vertical overlaps. Water top/side chunks retain buffers
when their resolved foam/depth/shore data and occlusion neighbors are unchanged.
Shore distance still resolves over the connected water surface; changing a shore
can legitimately affect multiple chunks. No adjacency assumptions are introduced
for imported terrain corners, stairs, props, or articulated parts.

## Measurements and checks

`window.__grediceGameProfile.chunkCompiler` exposes reconciliations, dirty chunks,
synchronous/worker compile counts and maxima, main-thread transfer preparation
time, transferred bytes, pending/cancelled/stale work, worker failures, and live,
peak, and disposed compiled geometry buffers. Byte counters cover owned geometry
arrays, not total browser heap or GPU VRAM.

Source diagnostics separately expose `sourcePacks`, `sourcePackBytes`,
`sourcePackMs`, `sourcePackMaxMs`, `sourceRegistrations`, `sourceCacheHits`,
`sourceCacheMisses`, `sourceCacheEvictions`, `retainedSourceBytes`,
`peakSourceBytes`, `sourceTransferredBytes`, and `matrixTransferredBytes`.
Retained source bytes include both compiler ownership domains. Transfer bytes
describe inputs; the existing total transfer counter also includes outputs.
These counters establish avoided copying, not an FPS or startup claim.

```bash
pnpm --filter @gredice/game benchmark:chunks
pnpm --filter @gredice/game test
pnpm typecheck --filter @gredice/game --filter garden --filter www
pnpm --filter garden exec playwright test tests/spatial-interaction.spec.tsx \
  tests/cursor-anchored-zoom.spec.tsx tests/instanced-mesh-material-swap.spec.tsx \
  --project chromium-webgl --workers 1
```

The CPU diagnostic loads the shipped BlockGround, BlockGrass, and BlockStone GLBs,
compares direct compilation with the former clone/transform/merge algorithm, and
checks a one-cell edit in a 4,096-cell scene. It asserts a sub-2 ms p95 for cases
eligible for synchronous compilation. This is bounded local CPU evidence, not a
physical-device guarantee. The WebGL fixture verifies untouched buffer identity,
worker transfers, a local edit, and twelve garden teardown/remount cycles, ending
with zero owned geometry bytes and pending jobs.

Production captures use the unchanged cross-tier, fauna, garden-switch, and
lifecycle profiler scenarios. Both served builds must include their actual clean
source marker, and both captures must use the same harness and server mode. See
[the profiler guide](game-scene-performance.md) for capture and comparison gates.


## Validation for #4719

Captured on 2026-09-23 UTC (23–24 September in Zagreb), using clean production
builds on macOS arm64, Node 24.15.0, and Chromium 151.0.7922.34 with ANGLE Metal
on Apple M4 Pro. The immutable subjects were:

- Baseline: `2445d504d605f2e82614bc0313c134e339d79aea`.
- Candidate: `0168eef8a076142c474cbfe96cc1e66494642200`.
- Frozen profiler harness for every comparable capture:
  `018a6d73cfda8db46086d3f7d1bfff7a05c42476`.

A follow-up review fix adds legacy `Goat` actors to the full-scene subscription
used by roaming animals. Eighteen farm-animal and entity-memo tests pass after
that fix. Direct fixture-inventory checks confirm that both `high-target` and
`fauna-heavy` contain zero legacy `Goat` blocks, so this routing correction does
not change the captured workloads. The buffer compiler is unchanged.

The final symmetric 2×2 comparison passes **344/344 checks and 42/42 invariants**,
with zero reproduced regressions and zero unresolved replications. Each of the
four independent reports passes all 39 acceptance/budget runs: five quality
modes in steady and camera-motion states, fauna interactions, garden switches,
and lifecycle transitions. The 18 individual screening signals remain in the
comparison report; none reproduced across all four pairings. In particular, the
first candidate's High steady fixture-ready timing did not reproduce as a
confirmed regression. Missing lifecycle GPU instrumentation and unavailable
switch-phase script-duration metrics remain explicitly skipped (108 entries
across the four pairings), not inferred passes.

| Candidate evidence across both captures | Result |
| --- | --- |
| Cross-tier rendered delivery | 29.4–30.2 FPS against the declared 30 FPS target |
| Cross-tier frame p95 | 26.1–27.2 ms |
| Garden-switch arrivals / transitions | 42 / 36 |
| Persistent Canvas and context | 42/42 arrivals |
| Warm resource plateau | Pass in all six switch runs |
| Maximum switch frame stall / settle | 78.9 / 1,383.4 ms |
| Lifecycle runs | 6/6 passed, including suspension and context restoration |

The visible compilation fallback adds one retained shared geometry and shader
variant in the cross-tier fixture; textures remain unchanged. This is within the
existing resource gate, and repeated switching reaches the measured plateau.
Final High-tier screenshot inspection preserved terrain, water, plants, shadows,
and the selected-bed outline; the automated cross-tier population and visual
witness checks also pass.

Separate production readback of the normal and snow-onset fixtures confirms
13 synchronous and three worker compiles each, zero worker failures, zero pending
jobs, and no page errors. Observed maxima are 1.2 ms for scene reconciliation,
0.9 ms for synchronous compilation, 2.4 ms in the worker, and 0.3 ms for transfer
preparation. The two fixtures each retain 16 owned geometries / 178,920 bytes.
The WebGL teardown fixture independently runs twelve garden remount cycles and
finishes with zero owned geometry bytes and pending work.

The Game suite passes 1,852 tests; the unchanged profiler suite passes 455 tests.
Game, Garden, and WWW typechecks, the Garden production build, and five focused
WebGL tests pass. Game lint has only the existing unused-suppression warning in
`RaisedBedFieldRelationshipIndicator.tsx`; scoped changed-file checks and
`git diff --check` pass.

### Host controls and retained diagnostics

A normal-launch baseline initially passed 39/39. Later, the initial candidate
passed 34/39 and an unchanged baseline passed only 15/39, with idle graphics
cadence near 9 FPS despite passing motion scenarios. Competing host activity was
observed. Those reports are retained and excluded from the passing comparison.
A three-run baseline control with macOS application resource policy passed at
30.0–30.2 FPS and 26.2 ms frame p95. The second valid baseline and both final
candidates therefore used `caffeinate -du taskpolicy -a` around the existing
profiler command. No browser flags, quality settings, scene content, or thresholds
were relaxed. This supports host scheduling sensitivity without attributing all
variation to a single cause.

The initial shipped-asset CPU diagnostic had a maximum synchronous p95 of
0.083 ms and a 4,096-cell patch p95 of 1.992 ms. A subsequent loaded-host run
failed the unchanged 2 ms synchronous p95 gate. The final complete diagnostic
passed all ten synchronous cases at a maximum p95 of 1.858 ms, but retained a
30.477 ms individual wall-time maximum and an 18.394 ms large-scene patch p95.
These measurements and the production readback are bounded local evidence;
they do not establish a hard scheduling deadline or physical-device thermal
clearance. The benchmark now prints its complete measurements before reporting
a budget failure.

Raw JSON, Markdown, screenshots, controls, and excluded attempts are retained
under `apps/garden/.game-profile-results/4719/`. The initial unmarked `baseline`
report lacks served-build provenance and is diagnostic only. `candidate` and
`baseline-second` retain the failed full captures. `baseline-confirmation` was
stopped before completion for the half-float fix and is not a comparison input.
Only the four reports below feed the passing comparison.

| Report directory | SHA-256 of `latest.json` |
| --- | --- |
| `baseline-clean` | `0f9bf5a13538e38da891387ff706f4b22e9ac1591d141514c84924e6911ddeaa` |
| `baseline-application` | `a6b7d0698984b83caea2de21f32c60abc7aa4bd5303db918d7e04483eaa73ea9` |
| `candidate-application` | `b1b9973722ec6849cd66ec60104931ce4e64e0b19f728ccc79a2e31e124aed67` |
| `candidate-application-confirmation` | `3f34c6052762b3deb1cf9fb8035406a1b92fd8a5fcfd720ce218c6f9c4084e46` |
| `comparison` | `8763847cee17f4179881d369d8df4bb94c9f5d996ca59e7b9e327fe03c36f612` |

Reproduce the comparison from the repository root:

```bash
node apps/garden/scripts/compare-game-profile-reports.mjs \
  --baseline apps/garden/.game-profile-results/4719/baseline-clean/latest.json \
  --baseline-confirmation apps/garden/.game-profile-results/4719/baseline-application/latest.json \
  --candidate apps/garden/.game-profile-results/4719/candidate-application/latest.json \
  --confirmation apps/garden/.game-profile-results/4719/candidate-application-confirmation/latest.json \
  --out-dir apps/garden/.game-profile-results/4719/comparison
```
