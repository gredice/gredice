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
parts, and placement-drop identity continue to work. Cow, horse, rabbit, sheep,
and beach-ball actors separately subscribe to the full terrain because movement
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

The small path accepts up to 8,192 output attribute components with a cumulative
2 ms synchronous budget per task. Larger work goes through one module worker,
one transferable job at a time. Queued jobs pack source data only when dispatched.
Cancellation removes queued jobs and rejects in-flight stale results. Worker
failure or unavailability keeps the existing instanced geometry visible; it does
not force a large synchronous merge. Current transforms and hitboxes are visible
while a replacement packet is compiling.

Each committed geometry has one effect owner. Replacement/unmount cancels its
job, disposes its GPU geometry, and releases references. The last compiler lease
terminates the worker and clears its queue. There is no worker template cache or
cross-garden buffer history. Shared GLTF geometry/material ownership is unchanged.

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
