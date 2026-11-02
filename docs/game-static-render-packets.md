# Static render packets and shared garden materials

`StaticRenderPacketBatchProvider` in `EntityInstances` collects compatible stable
opaque/cutout geometry into render packets on the existing 8-unit chunk grid.
New rigid GLTF and additional prop callers opt in with
`batchStaticMaterial`; declared static cache groups also qualify. Active
placement drops, articulated parts, sorted transparency, unknown material hooks,
and unsupported JSX ownership remain on their authored paths.

## Exact stock material compatibility

`getGardenPacketMaterialSignature` accepts supported `MeshStandardMaterial`
sources and includes every serializable rendered property: color, roughness,
metalness, emissive and intensity, maps, alpha/cutout, side, depth/blend state,
vertex-color flags, and registered shader configuration. Different PBR uniforms
remain separate packets. No palette attributes, custom GLSL, new vertex-color
flag or async warmup policy is introduced.

`useGardenPacketSource` acquires a committed owned clone. It preserves the
original values, texture references, authored `onBeforeCompile`, and
`customProgramCacheKey`. The ownership key includes the actual scene root;
equal supported materials share within that root, while independent roots own
separate clones. The root identity does not enter the native shader key. The
last active lease disposes unverified or unsupported clones. For a verified
resident authored GLTF material, the persistent Scene root may retain one
compatible idle opaque stock clone. Its selected full signature replaces an
incompatible idle slot; older active variants finish under their own leases
without retaining a history of configurations. Pure ground-patch decoration
carries exact original material identity without acquiring asset residency.

Asset eviction/disposal and root cleanup release the idle ownership. GLTF
replacement registers the new resident materials before releasing the previous
registration, preserving shared originals through that handoff. Existing
GLTF budget, grace and consumer references remain unchanged; borrowed textures,
geometry and source materials retain their existing owners. Root generations
isolate StrictMode cleanup from later setup, and aborted render acquires no
lease. Transparent JSX, unregistered hooks and weather-integrated material routes
retain their existing ownership. Cloud candidates stay consumer-scoped. Before
repatching a cached cloud program, the scene layer supplies its actual renderer
and refreshes only the five current cloud uniform bindings. This covers active
and idle cloud-feature changes without altering shader code, callbacks, native
keys or program reference counts. The uniform-table shape is guarded against the
pinned Three 0.186 implementation; newly compiled programs receive the same
bindings through their normal shader hook. Program reuse and uniform correctness
are verified separately from native timing acceptance.

Registered weather hooks on newly admitted props keep their exact configuration
and mutable uniform identities. Existing `renderStableChunksAsMergedGeometry`
sources retain their original material/JSX/weather route and nonowning sharing
lease; weather-integrated sources remain excluded from registry packets even
while their integrated material is not mounted. The cloud decorator is removed
from the borrowed source callbacks and applied once to the owned clone by its root. New packet/fallback
candidate tokens are scoped to that root. Existing production weather uses its
established shared cloud uniform/mask owner; these leases do not claim concurrent
independent production weather masks.

Simple intrinsic `<meshStandardMaterial>` nodes can qualify through supported
scalar/Color constructor values. Their concrete source materials are created in
layout effects and disposed by their source owner. Refs, `args`, children, maps,
custom hooks and unknown JSX components retain the authored path. Geometry must
be immutable or replaced by a new source object; morph-bearing geometry and
partial authored draw ranges retain the previous explicit merged/instanced path.

Stool's rigid AdditionalEntityInstances caller explicitly belongs to
`static-props`, like its compatible planks peers. Its active drop is excluded
from stable chunks; drag, pickup outlines, articulated/live overlays, and
placement identity keep their existing owners. Cache group remains part of the
packet key; no grouping boundary is removed.

## Packet planning and ownership

A contribution contains one component's stable instances of one geometry in one
chunk. Contributions join only when chunk, cache group, canonical material,
shadow flags, render order and complete vertex layout match. Stable owner/chunk
IDs preserve source ordering. Unchanged contributions retain their packet and
source-list identities so untouched aggregate chunks keep compiled geometry.
A supported singleton whose original presentation is instanced renders one
`InstancedMesh` with borrowed immutable geometry and its leased stock material.
It never mounts a compiler hook, queues a job or allocates a merged buffer.
Joining contributors with different geometry objects mounts compilation;
returning to a singleton cancels pending work and releases the aggregate's owned
geometry. Identical eligible geometry objects use native instancing instead. Matrix updates
retain the original placement rebuild duration and transformed-instance counters;
first mounts remain uncounted as before.


### Identical geometry stays instanced

An aggregate whose contributors borrow the same immutable geometry object keeps
one native `InstancedMesh` presentation instead of baking repeated vertices.
Every contributor must already use original instanced visibility, opt into source
bounds, have a distinct visibility group and cover its complete unmorphed geometry.
Equal vertex data in different geometry objects still uses compilation; there is
no content hash, worker-residency cache or cross-root output cache.

One immutable instance-matrix buffer contains the existing Float32 transforms in
source order. The aggregate and source proxies bind that same GPU buffer at fixed
source offsets. The pinned Three WebGL attribute/binding managers support the
interleaved instanced buffer; normal source-relative CPU views preserve native
`getMatrixAt`, bounds and raycasting. Camera motion changes draw counts, without
rewriting or uploading matrices. Adjacent visible sources form one instance span;
a hidden or empty source breaks it. Array cameras retain independent source draws.

Main and shadow callbacks select their actual camera's span. The existing renderer
guard also restores instance counts after nested or interrupted renders. Picking
always tests only the proxy's authored instances, even during a coalesced draw;
the all-visible aggregate does not raycast. Original source bounds and parent
transforms remain unchanged. Disposal releases owned instance buffers and never
borrowed geometry, materials or textures. A committed native packet advances the
existing geometry revision and requests one owned presentation frame, preserving
cache/shadow invalidation without mounting a compiler hook or transient fallback.

The existing compiler copies source arrays and matrices for each dispatched
job. It never transfers live GLTF buffers and has no worker source-ID protocol
or versioned source-residency cache. Indexed/non-indexed, normalized/interleaved,
weather and existing color attributes keep their original compiler semantics.

Until an aggregate replacement compiles, supported contributions render with
committed transient geometry/material clones of their authored inputs and the same
instance transforms. Clones preserve maps, cutout, exact ground/weather hooks,
and source-local data. Pending material ownership is root-scoped; immutable
geometry clones share by source object and release after the last user. Clone
failure unwinds the material lease. Pending or failed work never disposes source
geometry, materials or textures. Once the compiled replacement commits, the
transient clones and their GPU buffers/programs release. Compilation failure
keeps authored presentation. No shader-readiness presentation gate is added.

Each committed compiled geometry has its existing effect owner. Replacement or
unmount cancels jobs, rejects stale results, and disposes only owned geometry.
The compiler worker and queue retain their existing final-owner cleanup.

## Original visibility and picking

Supported stock contributions explicitly opt into original-source visibility;
unsupported sources already using explicit merging retain their previous path.
Instanced source bounds use the same Float32 matrices and ordered sphere unions
as Three's `InstancedMesh`. Sources previously compiled together retain their
original combined bounds, rather than acquiring finer culling.

When every original group intersects the actual render-camera frustum, a single
mesh submits the complete compiled packet. Mixed visibility submits only visible
groups through contiguous ranges of the same compiled buffer and material.
No visible groups means no native draw. Main and shadow camera decisions are
independent; camera motion does not recompile or allocate additional buffers.

Partially visible packets also join adjacent visible source ranges into one
native draw. A hidden or empty source ends a run; disconnected visible ranges
stay separate. Culling admits only the first source in each visible run; its
actual main/shadow draw callback selects the combined range. Other sources in
that run never enter the render list, avoiding both native calls and duplicate
triangles. Stereo/array-camera renders retain their original per-source path.
Range selection uses the current camera projection and
view matrices, including moved lights and cube faces. The all-visible path keeps
its existing single full-buffer draw.

Picking continues to intersect each original source range once, independently
of the current camera. Nested render/raycast scopes snapshot selected spans in
reusable stack entries so a different shadow camera or an interrupted nested
render cannot overwrite the outer range. Camera/frustum and span-count caches
own no GPU resources; material, geometry, cache, and placement ownership stay
with their existing owners.

Paired main/shadow callbacks select a range and restore it after drawing. A
renderer-keyed, refcounted guard restores ranges in `finally`, including callback
failures, nested renders and sibling cleanup. Whole-scene raycasts skip the full
render-only mesh and raycast each source range once under the same range guard.
Distance, UV, face, side and near/far semantics remain inherited from Three;
raycasting can still hit an offscreen source. Static-cache replay accepts only
the exact packet main/shadow range callbacks; replacing any callback restores
the unsupported path. Captures use the real renderer and camera under the same
range guard, preserving source culling and captured depth. Packet material
partitions keep unsupported/cutout shaders live without excluding compatible
opaque packets in the same layer. Committed compiler handoffs refresh the
registry's renderable references before the next draw.

## Diagnostics and validation

`window.__grediceGameProfile.renderPackets` reports contributions, packets,
material/family counts, completed compiles, live fallback meshes and fallback
reasons. `savedSubmissions` is potential all-visible contribution-minus-packet
work, not measured native draws. `gardenMaterials` reports active canonical,
shared, deduplicated and identity-only material users. Compiler telemetry covers
preparation/transfers/transforms and compiled geometry lifetime, not source
residency or total heap/VRAM.

The historical `GardenPalette*` fixture names remain test entry points; their
current assertions test stock materials. Controls preserve day/night,
clear/rain/snow/combined weather, mapped PBR, existing vertex colors, cutout
shadows and foreground depth. Mutation/StrictMode tests require owned cleanup
and remount. Distinct PBR values stay separate; equal-uniform sources must
actually aggregate positive native main/shadow draws. Root fixtures verify
separate material ownership and surviving sibling rendering.

Actual worker compilation uses a test-only 100 ms response-delivery delay to
bind a positive pending authored-clone submission and subsequent compiled
submission/disposal. A separate singleton-to-aggregate-to-singleton witness binds
zero compile counts, source geometry survival, positive native submissions and
final owned-output release. Existing merged-source controls require unchanged
source material identities and no stock clone. Culling fixtures retain
mixed/all/none/opposite main and shadow views, unique whole-scene raycasts, native ranges/triangles and unchanged
buffer identities. Light-change/context-restoration receipts capture pixels in
the actual submitted frame. No shader-warmup delay remains.

The adjacent-range fixtures exercise both distinct geometry objects through the
compiler and shared geometry through native instancing. They use opposite
overlapping main/shadow views: each
sees two of three sources, with a different combined buffer span. It compares
authored versus packet native draws, triangles, pixels, and scene raycasts in
Low, Medium, High, and Automatic. This is a deterministic Chromium WebGL semantic
and submission witness; it does not establish a whole-game GPU-time or latency
improvement. Native readbacks additionally require exactly two instances with the
correct fixed source offset, one draw and 24 triangles per enabled pass. A shared
geometry admission control requires native shader instancing, zero compiler jobs,
source geometry survival and matching pixels/picking after context restoration.
The current complete material suite has 38 cases. Run it with the rest of the material, weather, interaction, lifetime,
and context-restoration controls:

```bash
pnpm --filter garden exec playwright test tests/garden-palette-packets.spec.tsx \
  --project chromium-webgl --workers 1
```

The real Tree/GardenBox interaction controls retain hover, pickup, selection,
drag, active drop and settled drop states. A separate Stool case exercises the
new explicit static group through the actual production Additional path. Rain
controls converge through real positive weather frames and require two native
wet-overlay draws and Float32 wetness 1. Active drops compare the exact first
16 ms public spring input, committed 0.1 lift, original animated geometry,
matching pose/camera/light/weather inputs and same-submission PNGs. Pixel limits
remain fewer than 0.1% materially different pixels and maximum channel error 8.
The packet retention repair passes 69 focused units, Game/Garden/WWW typechecks
and a single 23-case Chromium SwiftShader semantic matrix. That matrix includes both
the original two-chunk Stool drop and a separate same-chunk retained singleton
rewrite, with real placement counters. Buttons drive production store state;
these tests do not claim pointer hit-test coverage or a device GPU benefit.

The active-drop control prospectively waits, before any drop or spring exists,
for one uncancelled owned root RAF on the unchanged Playwright 16 ms display
phase, then dispatches the existing button synchronously. Public root receipts
bind the original callback identity; the submitted drop must match that exact
root, request and next timestamp before the existing spring and pixel assertions
run. Bounded readiness history and native-wrapper restoration are checked.
Earlier strict 32 ms failures and delegated diagnostic passes remain preserved;
this control establishes matched pre-input test conditions, not a general
production guarantee that every render interval is 16 ms.

## Performance acceptance


### Integrated canonical acceptance (2026-11-02)

Candidate `a31175bfdbfd9c1d23810e993d8b2b3853b5a68c` and authored-material
control `ecadc8ff576fd274598051dfac5f7f1811d9ea73` pass the complete symmetric
2x2 comparison: all 344 metrics and 42 invariants, with zero screening,
reproduced or unresolved failures. Each of the four independent bundles contains
all 39 canonical runs. The control differs only by the null packet provider;
rigid fauna batching and current shadow-membership reporting are common to both.

The canonical profiler, quality settings, content, clocks, five-second warmup and
sample windows, and numerical gates are unchanged. Both subjects use the same
30-workspace installed graph, Node 26.12.1, pnpm 12.16.1 and Chromium
151.0.7922.34 with native ANGLE/Metal on Apple M4 Pro. Per-profile steady native
draw medians from the two independent bundles are:

| Resolved profile | Authored material draws | Shared packet draws |
| --- | ---: | ---: |
| Low | 249.7 / 249.3 | 240.2 / 240.3 |
| Medium | 255.9 / 254.6 | 246.9 / 246.3 |
| High | 253.2 / 253.4 | 244.2 / 244.4 |
| Automatic, standard classification | 256.4 / 256.4 | 247.4 / 246.9 |
| Automatic, constrained classification | 250.2 / 250.5 | 241.2 / 241.5 |

Nine metric/phase groups remain unavailable: script duration for the seven garden
arrivals and GPU timing in the active/context-restored lifecycle windows. Their
108 raw skip entries are preserved across captures and pairings. All available
CPU/GPU, cold, switching, lifecycle, resource, cadence and content gates pass.
Fauna-heavy High draws are 589.2 / 589.1 in the authored control and
564.2 / 564.1 in the shared-packet candidate, with common rigid fauna.

### Native rain/camera and cache integration

All 30 supplemental rain/camera runs pass their original producer and cadence
gates. Both subjects retain 270 stacks, 297 blocks, three raised beds and identical
resolved settings. Minimum delivery ratios are 0.995 at 30 fps and 0.945 at 60 fps,
against the unchanged 0.85 minimum. Median submitted draws per rendered frame are:

| Profile | Authored | Shared packets |
| --- | ---: | ---: |
| Low | 163.8 | 154.9 |
| Medium | 166.9 | 158.2 |
| High | 169.6 | 160.8 |
| Automatic, standard | 166.9 | 158.8 |
| Automatic, constrained | 169.3 | 156.9 |

These descriptive live-work observations accompany the complete canonical relative
clearance. Camera/population exposure can change triangle medians. The generic
comparative CLI rejects this supplemental report schema's missing canonical
inventory aliases; that invalid diagnostic is retained. Independent checks verify
the original `profileGarden*` inventory and settings without rewriting reports.

The first 15-run control failed its 60 fps gate while the real 60 Hz display was
asleep and Chromium delivered 50 Hz. Those failures remain retained. A temporary
display-wake assertion restored native 16.7 ms cadence, verified before the new
30-run cohort with the same headless ANGLE/Metal arguments. Clock, frame-rate flag,
quality, sample-window and threshold settings stayed unchanged.

All 19 cache integration runs pass: cached depth on all five profiles, three High
lifecycle/context-restoration runs, a sustained High cloudy soak, and five cloudy
live/cache pairs. Cloudy GPU p95 medians fall from 17.69 to 6.91 ms; paired median
ratio is 0.3974 and the worst pair is 0.4642. Submitted draws fall from 167.1 to
132.5 and the triangle ratio is 0.5265. The existing cache image gates pass with
maximum mismatch 0.6715% and P99 channel error 1. After 60.536 seconds of resource
warmup, the 60.337-second soak has zero geometry, shader or texture growth.

Raw reports, images, original-runtime trajectories, source guards, plans and all
rejections are retained outside the worktree in
`issue-4715-performance-evidence-2026-11-02.tar.gz`, SHA-256
`6ce375334a817c8a1b729ac2c56ac7426e0a42899840bc724afd32f0869aec9e`.
Independent verification checked all 4,471 regular/hard-linked file entries against
the source manifest. These are desktop measurements; physical-device/thermal
clearance remains #4344.

### Retained rejected candidates

The prior integrated material cohort reproduced visible-switch latency and a GPU
tail regression. The native-instancing cohort then passed 343/344 relative metrics
and all 42 invariants but reproduced fauna-switch settled latency. Both rejected
cohorts remain intact. Registry, metadata and native-shadow submission traces
identified the stale membership-reporting interval; the submitted-buffer regression
fails before the correction and passes afterward. The accepted cohort above is a
fresh complete comparison after that common source correction.

The stock candidate `f191ad05` passed all 39 absolute/comparability scenarios but
failed original-cost admission with 24 binding relative exceptions: 13 geometry
rows and 11 switch/cold rows. Exact canonical inventories reproduced the geometry
increase, and native switch traces located repeated terrain clone/program
lifetimes and cumulative info-log costs. Its artifacts remain rejected evidence.
The subsequent `7c5775ac` partition repair preserved the original merged terrain
route and avoided compiling zero-benefit original-instanced singletons. It passed
all 39 absolute/comparability scenarios and 343 of 344 original-cost metrics with
all 42 invariants, but cold garden-switch canvas readiness remained rejected:
483 to 610 ms exceeded both unchanged relative limits. The later signed-empty
placement metadata/build accounting repair and the prospective input control
had semantic proof while matched native admission remained pending at that point.
Those original cold-rejection artifacts remain retained.

The earlier custom-PBR palette and async-warmup candidate `a62d2277` is rejected:
its full canonical matrix has a retained telemetry 500 failure and 18 binding
relative exceptions, including repeated switch long tasks, cold canvas latency
and peak shader growth. Those artifacts remain separate historical evidence.

The historical `f191ad05` inventory projected 33 Fauna uniform buckets following
the explicit Stool classification; that planner topology predates singleton
passthrough and is not the current submitted draw count. Native Fauna runs and the unchanged
full canonical CPU/GPU/cold/lifecycle/resource gates must establish acceptance.
No threshold, quality, population, clock, camera, shader diagnostic, or baseline
eligibility exception is implied by successful semantic tests. Transparent
batching remains unsupported pending an ordering-preserving visual witness.
