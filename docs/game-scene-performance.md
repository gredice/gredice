# Game scene performance analysis

Date: 2026-04-29

Static inventory refreshed: 2026-08-30

## Summary

The 2026-04-29 analysis did not find the scene asset-bound. Game models are now
split into one runtime GLB per asset under `apps/garden/public/assets/models`,
generated from one Blender source file per asset under `assets/game-assets`.
The current runtime inventory contains 146 GLBs totaling 14,648,032 compressed
bytes (13.97 MiB), while the generated manifest exposes 145 asset names. The
extra file is the intentionally obsolete `BlockStoneStairsHalf` compatibility
asset, which the runtime manifest excludes. Mesh, primitive, vertex, material,
texture, and animation totals have not been remeasured against this expanded
asset set, so the static refresh alone does not reconfirm the earlier
asset-bound conclusion.

The optimization already made since the first pass is meaningful: the scene no
longer mounts the old one-second game-time manager. Environment, sun/moon, plant,
and suggestion code now read `useSnapshotTime()`, which removes recurring React
state churn from normal unfrozen time. That should help idle stability and avoid
unrelated scene re-renders.

The earlier analysis attributed the remaining cost to render policy and
auxiliary systems rather than raw model complexity: continuous frame loops,
high-resolution shadows, many shadow casters/receivers, per-instance snow
overlays, CPU-updated weather particles, per-sprite billboard callbacks, and
detailed plant/decoration layers. The cross-tier matrix below exercises one
deterministic garden, not the full asset catalog; current before/after profiles
must establish which of these costs still dominate.

The latest implementation pass added explicit game quality tiers, canvas DPR
caps, tiered shadow maps, low-tier shadow disabling, tiered rain/snow particle
counts, detail-layer gates, and profiling metadata. Mobile low quality now
renders at a 1x canvas backing store, disables dynamic shadows, cuts weather
particles, disables ground decorations, and only mounts snow overlays once the
coverage threshold is high enough to matter. The default profile command now
builds the production app and starts it with `pnpm start` so future reports are
not accidentally based on `next dev`.

## What changed since the first analysis

- `packages/game/src/hooks/useGameTimeManager.ts` is gone.
- `packages/game/src/hooks/useSnapshotTime.ts` returns `freezeTime` or one
  mount-time snapshot, so normal time no longer advances through React state.
- `packages/game/src/GameScene.tsx` no longer calls a time manager hook.
- `Environment`, `SunMoon`, `RaisedBedPlantField`, and
  `RaisedBedFieldSuggestions` use `useSnapshotTime()`.
- The latest pass added explicit quality tiers, DPR caps, smaller tiered shadow
  maps, low-tier shadow disabling, weather particle caps, profiling metadata,
  app-level `deferDetails` on the main garden page, snow-overlay coverage gates,
  ground-decoration density gates, and static sprite billboard rendering.
- Game assets are split by model unit. The runtime preloads all ground block
  models first, then preloads raised bed and common assets, while less common
  block assets load behind local Suspense boundaries only when present in the
  scene.
- The latest instancing pass moved base rendering for additional repeated block
  types into instanced meshes, including water blocks, raised beds, shade,
  garden boxes, pots, cactus variants, dead trees, buckets, watering cans, water
  wells, composters, cat pillows, fences, stools, bird houses, gift boxes, and
  remaining ground block variants.
- The 2026-06-01 dense-scene pass replaced Drei per-instance children with
  chunked raw `InstancedMesh` updates, batched ground decoration sprites by
  atlas sprite/material, retained decoration wind motion through a batched
  shader path, and rendered repeated rain/snow overlays with shared instanced
  overlay meshes. Instanced block control wrappers are skipped for no-control
  profile scenes and for covered instanced blocks, so stacked scenes no longer
  mount buried grass controls under every top block.
- The 2026-07-03 terrain/water chunk pass added merged geometry output for
  stable grass, sand, snow, and dirt terrain chunks while preserving the
  existing instanced path for animated or interactive blocks. Water tops now
  batch many foam-edge variants inside chunk meshes with per-vertex foam
  and shore-depth attributes, and merged water side walls are partitioned by
  chunk while still checking all water neighbors to avoid chunk-boundary side
  seams. Water meshes carry sampled depth-map attributes: top surfaces grade by
  water-column depth plus shaped terrain angle/corner depth under the surface,
  then smooth those samples across adjacent top surfaces so flat stepped
  columns shade as a continuous depth field instead of abrupt per-block bands.
  Shore-distance color also uses smoothed per-vertex samples so flat water near
  banks, islands, and garden edges fades toward deeper color gradually. Side
  faces receive the same smoothed top-edge depth and shore samples, matching the
  top color at the bend before easing darker down the wall. Shore foam still
  follows exposed edges, and color/opacity ease continuously with depth instead
  of snapping at a fixed block threshold. Production profile runs should be used
  for before/after budget decisions.
- Snow and rain overlays are optimized for repeated instanced blocks, but many
  non-instanced entities can still mount per-block `SnowOverlay` or
  `RainWetOverlay` meshes when weather makes them visible, so snow/rain profiles
  can remain overlay-bound outside the repeated instanced block path.
- The remaining expensive areas are continuous `useFrame` systems, snow overlays
  outside the repeated instanced block path, CPU weather loops, plant/detail LOD,
  and profiling noise from app-level providers.

## Current static snapshot

Source inventory refreshed from the current workspace on 2026-08-30. Geometry
figures explicitly marked as historical retain the 2026-04-29 evidence boundary:

| Area | Current value | Notes |
| --- | ---: | --- |
| GLB size | 14,648,032 compressed bytes (13.97 MiB) across 146 files | source-backed file inventory; no runtime transfer or decode cost is implied |
| Generated manifest asset names | 145 | names exposed by the generated runtime manifest |
| GLB meshes | historical: 59 | not remeasured; 2026-04-29 count covered the earlier 31-file split |
| GLB primitives | historical: 75 | not remeasured; 2026-04-29 count covered the earlier 31-file split |
| GLB vertices | historical: 22,300 | not remeasured; 2026-04-29 count covered the earlier 31-file split |
| GLB triangles | not remeasured | expanded asset inventory needs a fresh geometry audit |
| GLB textures | not remeasured | the previous one-source-texture result is not asserted for the expanded inventory |
| Runtime `useFrame` registrations / source files | 59 / 48 | coarse current source count in `packages/game/src`; registrations are not equivalent to active callbacks in every scene |
| `castShadow` / `receiveShadow` occurrences | historical: 109 | not remeasured; coarse 2026-04-29 source count in `packages/game/src` |
| Directional shadow map | low: off, medium: 2048, high: 4096 | legacy default was 8192 |
| Canvas DPR policy | low: cap 1, medium: cap 1.5, high: cap 2 | set as a DPR cap, not a forced upscale |
| Weather particle policy | low: 35% rain / 30% snow, medium: 70% / 60%, high: 100% | rain fades through shader intensity and unmounts below the visible threshold; profiler reports active rain/snow counts |
| Ground decoration policy | low: off, medium: 50%, high: 100% | skipped in far zoom and reported in profile metadata |
| Snow overlay policy | low: min coverage 0.35, medium: 0.08, high: 0.02 | overlays are not mounted below the tier threshold |

## Runtime measurements

These measurements were taken against the running `apps/garden` dev server on
port 3001. They are useful for direction, not as final product benchmarks. Dev
mode includes Next.js compilation/HMR, auth fetches, PostHog/session tooling, and
warnings that will not exactly match production.

### Repeatable profiling reports

The garden app now has a profiling route and report generator for future checks.
The route `apps/garden/app/debug/profile/game/page.tsx` renders the mock game
scene without signed-in game data requirements, login UI, HUD, controls, or
sound, while keeping the normal in-game scene details enabled. In dev it still
inherits app-level providers, so reports can include unrelated auth/analytics
console noise; isolating that is now part of the profiling cleanup step. It
supports these stable modes:

- `/debug/profile/game?mode=baseline&quality=medium`
- `/debug/profile/game?mode=details&quality=medium`
- `/debug/profile/game?mode=rain&quality=medium`
- `/debug/profile/game?mode=snow&quality=medium`
- `/debug/profile/game?mode=cloudy&quality=medium`
- `/debug/profile/game?mode=windy&quality=medium`
- `/debug/profile/game?mode=details&profile=dense&quality=medium`
- `/debug/profile/game?mode=details&profile=fauna-heavy&quality=high`
- `/debug/profile/game?mode=details&profile=plant-heavy&quality=medium`

The `quality` query accepts `low`, `medium`, or `high`. When omitted, the game
uses the automatic quality resolver. The `profile` query accepts `default`,
`dense`, `fauna-heavy`, or `plant-heavy`. Dense profile scenes use deterministic
25x25 mock gardens so larger-scene measurements do not depend on signed-in
garden data. The fauna-heavy profile uses the shared deterministic animal
fixture described below. The `details` query defaults to `1`; use `details=0`
only when intentionally profiling the reduced scene without detail layers such
as mulch, ground decorations, and animals. Controls, the regular HUD, and the
debug HUD are hidden by default; add `controls=1`, `hud=1`, or `debugHud=1` only
when needed. Mobile profile scenarios use `quality=medium`, matching the
automatic resolver policy that no longer selects the low tier by default. Use
`quality=low` only for explicit manual low-tier comparisons.

Generate the default production report. This builds the garden app, starts it
with `pnpm start` on `http://localhost:3101`, profiles the scenarios, and then
stops the managed server:

```bash
cd apps/garden
pnpm run profile:game
```

Run the dense production report when measuring larger scenes or validating one
of the rendering architecture tasks:

```bash
cd apps/garden
pnpm run profile:game:dense
```

Run the dense mobile matrix to cover baseline, details, camera motion, rain,
snow, cloudy, windy, and plant-heavy scenes with the mobile viewport and
budgets:

```bash
cd apps/garden
pnpm run profile:game:dense-mobile
```

Run the cross-tier production matrix to measure the same deterministic
high-target garden fixture in steady and bounded camera-motion phases across
explicit low, medium, and high quality plus synthetic auto-standard and
auto-constrained device classes:

```bash
cd apps/garden
pnpm run profile:game:cross-tier
```

The matrix keeps the viewport, reported browser DPR, garden contents, detail
layers, and legacy static-scene-cache mode fixed. Its acceptance checks verify
the resolved quality tier, synthetic Auto inputs, canvas backing-store policy,
and full plant-fixture visibility throughout each repeated sample. Camera
motion uses bounded zoom/rotation cycles so it exercises visibility and render
updates without changing the measured fixture; motion runs also require a
camera snapshot/version change during the sample, so dropped input cannot be
reported as motion evidence. Every steady and moving run also dispatches the
same connected-raised-bed outline command and requires exact target telemetry
plus a nonblank Canvas screenshot. Screenshot dimensions follow the browser
DPR, independently of the quality-capped WebGL backing-store dimensions. The
auto device classes are deterministic profiler inputs rather than measurements
from representative hardware.
Reported results therefore establish a reproducible local production-build
regression baseline; they do not replace physical-device, sustained thermal,
or deployed runtime validation. Do not record performance conclusions here
until a report has been generated and reviewed.

Run the daytime fauna profile to measure the shared all-animal fixture at
explicit High quality, a reported DPR of 2, and the legacy static-scene-cache
path:

```bash
cd apps/garden
pnpm run profile:game:fauna
```

The fixture is exact and fresh for every consumer: 117 stack positions contain
117 ground blocks and 30 detail blocks, for 147 blocks total, with no raised
bed. The production scenario runs three repeats. After each repeat's warmup it
dispatches the exact Cow `trot` command once, then requires runtime-resolved
acknowledgement from both Cow actors, including distinct actor and moving-actor
IDs for the dispatched sequence. It also captures a canvas screenshot and
requires a nonblank visual witness alongside the normal performance, error, and
fauna-presence gates. This keeps fixture presence, actual runtime interaction,
and rendered output separate pieces of evidence instead of inferring one from
another.

This is intentionally a clear daytime probe. Bats and other night-only behavior
need a separate night scenario, while wetland- and rain-dependent fauna such as
frogs and slugs need separate habitat/weather probes. Passing the daytime
scenario does not establish those paths or complete fauna coverage.

Run the persistent-Canvas garden-switch and lifecycle baselines independently,
or run them with the fauna baseline through one release-gate command:

```bash
cd apps/garden
pnpm run profile:game:garden-switch
pnpm run profile:game:lifecycle
pnpm run profile:game:runtime-baselines
```

Each of the three garden-switch runs owns one browser context and one WebGL
Canvas, then records seven arrivals in the exact sequence `high-target →
fauna-heavy → high-target → fauna-heavy → high-target → fauna-heavy →
high-target`. The gate verifies the
actually displayed garden ID on the Scene root and in profiler telemetry, exact
fixture cardinalities, High-target generated-plant counts, an exact raised-bed
outline interaction on each High arrival, and an exact two-Cow `trot`
acknowledgement on each fauna arrival. Every arrival also requires a nonblank
Canvas screenshot, one Canvas node, the original Canvas and WebGL context
objects, a healthy context, zero context-lost/restored events, and zero API
requests/errors, console errors, or page errors. Fixed fixture species are
exact; dynamic bee, butterfly, ladybug, and squirrel counts remain visible in
the report without being mistaken for fixed-fixture drift.

The request and runtime witnesses also require the legacy static-scene path:
`staticSceneCache=legacy` and `staticOpaqueSceneCacheEnabled=false` on every
arrival. High arrivals exact-gate all 54 generated-plant fields and all 537
instances as visible, rather than treating generated totals as proof that the
workload remained on screen.

Transition gates follow the current 280 ms fade-out swap and 500 ms visual
settle contract with deliberately conservative scheduling headroom: the garden
must swap no earlier than 200 ms and within 1,000 ms, become visible within
1,200 ms, and finish the observed settle window within 1,800 ms. No frame may
stall for more than 500 ms. These are structural transition safeguards, not
machine-specific FPS targets. Renderer geometry, program, and texture counts
are recorded on every arrival. For fauna, the warmed plateau compares F2→F3.
High needs two warm returns, so H2→H3 remains explicit warm-up evidence and the
plateau compares H3→H4. The later arrival may release resources but must not
increase live geometry, program, or texture counts. Reports keep all three
independent runs and all 21 arrivals visible so a passing median cannot hide one
broken switch.

The lifecycle scenario is one deterministic High target repeated in three
fresh browser contexts at `1280x720`, reported DPR 2, fixed midday time, and the
legacy static-scene-cache path. It uses a document-start tracker rather than
post-wait timestamps for Navigation Timing `DOMContentLoaded`, Canvas DOM
attachment, the first correctly sized backing store, and the first submitted
WebGL draw. Exact fixture readiness (270 stacks, 297 blocks, three raised beds,
54 visible generated-plant fields, and 537 visible instances) and an exact
raised-bed outline interaction remain separate later milestones. Cold and
restored screenshots must be nonblank `2560x1440` Canvas captures.

The active phase records the normal render sample and all runtime frame-loop
telemetry: active lease count, Canvas/document/effective visibility, loop state,
target FPS, scheduled callbacks, wakeups, owned invalidations, cancellations,
and suspend/resume counts. The offscreen phase inserts a real viewport spacer
and requires both the runtime's IntersectionObserver state and an independent
observer witness to report a zero-area, nonintersecting Canvas. The document
hidden phase is explicitly synthetic: the profiler overrides
`document.hidden`/`visibilityState`, dispatches `visibilitychange`, and records
those getters in the report. It must not be presented as browser lifecycle or
background-tab proof.

Both suspended phases require the owned SceneTime scheduler to add zero
callbacks, wakeups, and invalidations. Browser RAF instrumentation itself is
active, so submitted WebGL frames/draws/triangles and CDP script time are kept
as honest residual observations rather than release failures in this baseline.
Each resume must return to the same healthy Canvas and WebGL context, re-prove
the exact fixture, accept a fresh outline command from an exact zero-target
state, submit new draw work, and produce a nonblank screenshot.

Finally, the profiler forces `WEBGL_lose_context` without preventing the loss
event itself. It records that the renderer handled the event, requires one
ordered lost/restored event pair on the original Canvas/context, samples zero
submitted frames/draws/triangles while the context is lost, then requires fresh
interaction, draw work, exact fixture evidence, and a valid screenshot after
restoration. External GPU timer queries are disabled for this scenario so the
forced loss cannot invalidate profiler-owned query handles. These are local
headless production-build lifecycle witnesses; they do not replace a real
background-tab, device thermal, or deployed-runtime check.

Capture the complete regression bundle before and after a runtime change with
the same machine, browser, options, and deterministic fixtures. Use distinct
output directories so the candidate run cannot overwrite the baseline:

```bash
cd apps/garden
GAME_PROFILE_OUT_DIR=test-results/game-profile/baseline \
  pnpm run profile:game:regression-baselines

# Capture an independent repeat of the exact same clean baseline commit:
GAME_PROFILE_OUT_DIR=test-results/game-profile/baseline-confirmation \
  pnpm run profile:game:regression-baselines

# After checking out and building the candidate commit:
GAME_PROFILE_OUT_DIR=test-results/game-profile/candidate \
  pnpm run profile:game:regression-baselines

# Capture an independent repeat of the exact same clean candidate commit:
GAME_PROFILE_OUT_DIR=test-results/game-profile/candidate-confirmation \
  pnpm run profile:game:regression-baselines
```

Compare the four raw repeated-run reports with the checked-in relative policy:

```bash
cd apps/garden
pnpm run profile:game:compare \
  --baseline test-results/game-profile/baseline/latest.json \
  --baseline-confirmation test-results/game-profile/baseline-confirmation/latest.json \
  --candidate test-results/game-profile/candidate/latest.json \
  --confirmation test-results/game-profile/candidate-confirmation/latest.json \
  --out-dir test-results/game-profile/comparisons/baseline-to-candidate
```

The comparator validates and pairs raw scenarios by stable base name and repeat
index; it does not compare precomputed summaries. Performance samples from the
two independently captured bundles are then treated as exchangeable repeats:
the release decision uses the ratio of batch medians, while sorted raw ranks are
retained as diagnostics and cannot make an otherwise stable median fail. This
avoids assigning statistical meaning to baseline run 1 versus candidate run 1.

A relative median breach below its practical noise floor returns `needs-rerun`
instead of passing or being mislabeled as a regression. A breach beyond both
boundaries is a regression in a single comparison. For release evidence, use
both `--baseline-confirmation` and `--confirmation`. The comparator evaluates
the two independent baseline bundles against both independent candidate bundles
and confirms a regression only when the same scenario, phase, and metric crosses
its relative screen in all four pairings. This symmetric 2x2 gate prevents an
unusually low baseline bundle or unusually high candidate bundle from deciding
the release. A non-diagnostic CLI invocation rejects an incomplete matrix;
single-pair comparisons require an explicit diagnostic flag and cannot be used
as release evidence. Non-reproduced signals stay visible in JSON and Markdown
but do not fail the confirmed result. The exported single-pair comparison API
also marks its output diagnostic and returns `needs-rerun` for an otherwise
passing canonical pair; only the complete confirmed API can emit a
non-diagnostic pass.

Each repeat must preserve its source commit, fixtures, options, runtime, and
environment while using a different report path and valid capture timestamp.
A timestamp-only copy of an existing JSON report is rejected because it is not
independent evidence. If a screened metric is unavailable in any required
pairing, the confirmed result returns `needs-rerun` rather than passing open.

The floors cover observed same-commit variation in browser startup clocks, GPU
queries, uncollected heap snapshots, script counters, and isolated long tasks;
deterministic fixture, quality, interaction, provenance, and lifecycle zero-work
witnesses remain hard checks in every raw run. Long-task counts compare batch
medians, and duration medians use bounded millisecond floors, so one isolated
browser task is visible in the raw ranks without being mislabeled as an
application regression. Renderer resource medians have a one-count tolerance;
larger growth must reproduce across the symmetric confirmation matrix.

| Median metric | Relative allowance | Practical floor |
| --- | ---: | ---: |
| p95 frame duration | 15% | 2 ms |
| Rendered FPS | 10% | 5 FPS |
| Draws / triangles per rendered frame | 5% | none |
| JavaScript heap snapshot | 15% | 8 MiB |
| Script duration | 15% | 0.5 s |
| GPU p95 duration | 15% | 3 ms |
| DOM content loaded | 25% | 25 ms |
| Canvas and lifecycle readiness | 20% | 100 ms |
| Switch displayed / visible | 15% | 50 ms |
| Switch settled | 15% | 100 ms |
| Long-task maximum / total duration | 20% | 10 / 20 ms |

“Practical floor” is not an extra allowance added to the percentage. A signal
is meaningful when its worsening reaches the floor while also crossing the
relative boundary. These are profiler noise floors, not product budgets; each
raw run must still pass the scenario's checked absolute performance budget
before either report is comparable. The comparator validates both the aggregate
budget outcome and every recorded absolute-budget check in every raw run.
For cross-tier scenarios it also derives the required requested quality,
Automatic device inputs, DPR cap, decoration density, resolved tier, shadow-map
size, and shadow state from the canonical scenario name; two reports cannot
become comparable merely by agreeing on the same incorrect tier policy.

Exit `0` means compatible evidence and all confirmed relative gates passed.
Exit `1` means either `needs-rerun` or a regression, and exit `2` means the
reports are invalid or incomparable. The generated comparison report uses
schema version 2 and distinguishes screening signals from reproduced
regressions. The gate fails closed for dirty, unknown,
same-commit, stale-build, or mismatched served-build provenance, changed
fixtures/options/runtime, missing runs, and one-sided required measurements. The
default gate requires the complete `cross-tier,fauna,garden-switch,lifecycle`
manifest with three raw repeats per scenario, and it rejects an output directory
that contains either input report. `--allow-partial` and `--allow-same-source`
exist only for local harness diagnostics, are marked as diagnostic in the
generated report, and must not be used as release evidence.

Run every profiler scenario together:

```bash
cd apps/garden
pnpm run profile:game:all
```

Run the weather-transition matrix, including the rain-to-clear cutoff timing:

```bash
cd apps/garden
GAME_PROFILE_SCENARIO_SET=weather-transitions pnpm run profile:game
```

Run the same production build/start flow as a CI gate with budget failures
enabled:

```bash
cd apps/garden
pnpm run profile:game:ci
```

Profile an already running server only when you intentionally want to compare a
specific dev or production server:

```bash
cd apps/garden
pnpm run profile:game:existing
```

If the production build already exists and you only want the profiler to run
`pnpm start`, use:

```bash
cd apps/garden
pnpm run profile:game:start
```

Reports are written to ignored files under
`apps/garden/test-results/game-profile/`. The latest report is always available
as both `latest.json` and `latest.md`; timestamped copies are kept beside them.
The JSON is intended for CI/trend comparison, while the Markdown summary is meant
for quick review in a PR. Reports also include whether the profiler ran a build
and whether the server was managed with `pnpm start` or supplied externally.
Schema-v5 reports distinguish the profiler harness commit from the commit baked
into the served Garden build. Only the served-build marker is authoritative for
the comparison subject; a runner environment SHA is not deployment proof.

The default `core` scenario set currently samples these scenarios:

- `game-baseline-desktop`
- `game-baseline-mobile`
- `game-details-desktop`
- `game-rain-mobile`
- `game-snow-mobile`
- `plants-desktop`

The `dense` scenario set samples:

- `game-dense-25x25-desktop`
- `game-dense-25x25-high-desktop`
- `game-dense-25x25-controls-desktop`
- `game-dense-25x25-camera-motion`
- `game-dense-25x25-rain-desktop`
- `game-dense-25x25-snow-desktop`
- `game-dense-25x25-cloudy-desktop`
- `game-dense-25x25-windy-desktop`
- `game-plant-heavy-25x25-desktop`

The `dense-mobile` scenario set samples:

- `game-dense-25x25-baseline-mobile`
- `game-dense-25x25-details-mobile`
- `game-dense-25x25-camera-motion-mobile`
- `game-dense-25x25-rain-mobile`
- `game-dense-25x25-snow-mobile`
- `game-dense-25x25-cloudy-mobile`
- `game-dense-25x25-windy-mobile`
- `game-plant-heavy-25x25-mobile`

The `buildings` scenario set is available only when the production server was
built and started with
`GREDICE_GARDEN_BUILDING_PROFILE_FIXTURE_ENABLED=true`. The query alone cannot
enable the fixture. The gated server route constructs one bounded,
serializable descriptor; production `GameScene` consumes that descriptor and
does not import the benchmark fixture compiler. The same descriptor document
drives normal rendering and the editor session.

The matrix begins with a true no-structure baseline and fails if the production
`GardenStructureKitV1.glb` is requested. It then covers empty shells on desktop
and constrained mobile, a furnished house, a dense garden plus furnished house
mixed-production workload, shell and cutaway-interior editing, greenhouse rain,
the valid 20x9 / 100-cell / 301-edge / 100-roof-region / 100-prop comb as a
closed-roof exterior, a fully furnished cutaway, and an edit-churn state, plus
repeated build-mode entry/exit. Mobile runs use
`390x844`, DPR 3, automatic quality, and emulated 4 GiB/four-core navigator
hints. Active editing explicitly bypasses the static opaque cache.

The building report copies only bounded metadata: counts, durations, cache
outcomes, byte totals, quality/device class, and budget results. It does not
copy a structure document, player identity, garden identity, or account
balance. Runtime work comes from resolved production GLB primitives: opaque and
transparent draws, vertices, triangles, unique CPU attribute/index bytes,
estimated texture bytes, and instance-buffer bytes. Semantic fallback and
editor-preview work remain separate columns. The network witness records the
exact GLB URL, response status and body length together with same-origin
Resource Timing sizes and milestones; the no-building row must remain zero.
Each plan resolution prepares, validates, canonicalizes, and keys the document
exactly once. Prepare-plus-cache-lookup duration starts before that work and
ends after `cache.get`, so a hit exposes its complete hot-path cost. Miss
resolution starts at the same point and ends after
`compilePreparedGardenStructurePlan`, so its maximum includes the preparation
subset instead of hiding it behind a separate near-zero cache lookup. Current
and maximum lookup duration, miss-resolution maximum, and hit/miss outcome are
reported separately. Editor p95 uses nearest-rank `ceil(n * 0.95) - 1`.
Avatar collision-step samples wrap one complete production horizontal-movement
resolution, including bounded substeps and slide retries. They remain
default-off with the server-gated building fixture, accumulate in a fixed-size
histogram, and report count, p95, maximum, and total duration without retaining
positions or movement input.

Outside the exact server-gated profiler, plan and navigation resolution do not
read the profile clock, editor updates schedule no profile RAF, and the Canvas
boundary preserves the original click handlers. The saved-structure collection
allocates no profile fallback geometry, and the lazy kit metrics reporter (with
its measurement code and `appBaseUrl` subscription) is not mounted.

The saved-scene production layer derives one visibility set from each compiled
structure's conservative world bounds when the camera matrix changes, and
passes that set into the collection renderer before instance submission. An
empty set mounts no kit renderer and therefore cannot initiate the GLB request.
Interior prop batches additionally require an explicit per-structure admission
set, which defaults empty for the saved scene; future avatar/authoring callers
must supply only structures that are actually inside or cut away. The gated
fixture editor applies the same rule directly: normal closed-roof exterior
submits zero props and cutaway admits them. Profile metadata keeps
structure/prop frustum rejection, exterior prop suppression, and detail-tier
suppression as distinct counts.

The building gates retain the 33.3 ms mobile p95 frame target, 100 ms
editor-action p95 target, 500 ms maximum editor stall, 192 KiB document limit,
and 600,000-byte production GLB response limit. Use
`GAME_PROFILE_SOAK_MS=600000` to hold each normal/editing state for ten minutes
before its sample; use
`GAME_PROFILE_SAMPLE_MS=600000` when the edit-churn or entry/exit actions must
run for the full soak window.

The automated matrix also includes a constrained-mobile furnished 100-cell
solid-wall workload for dense-bucket collision cost and separate representative
house movement that travels in third-person and returns in first-person. It
does not claim a doorway crossing because the timed row has no portal/interior
witness. The owned/public WebGL component proofs cover doorway correctness, and
the renderer-free 2D contract remains correctness evidence rather than an
invented performance row; the building report labels that boundary explicitly.

### 2026-08-30 building production profile

The local production-build witness used headless Chromium 149 with ANGLE Metal
on an Apple M4 Pro/24 GiB host, Node 24.15.0, a 5 s warmup, and a 5 s sample.
Constrained-mobile rows used a 390x844 CSS viewport at browser DPR 3, emulated
4 GiB/four-core navigator inputs, the resolved `auto-constrained` tier, DPR cap
1, a 390x844 backing buffer, 1024 px shadows, and the legacy static-scene-cache
path. These are browser/host measurements, not a physical constrained phone.

| Scenario | p95 / max frame | Rendered FPS | Draws / rendered frame | Triangles / rendered frame | Long tasks | JS heap | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| No structure / no building asset | 17.2 / 17.7 ms | 29.1 | 71 | 4,050 | 0 | 57.5 MiB | pass |
| Dense 25x25 garden + furnished house | 17.6 / 17.8 ms | 27.1 | 74 | 18,584 | 0 | 54.2 MiB | pass |
| Furnished 100-cell closed-roof exterior | 18.4 / 18.8 ms | 27.5 | 98 | 178,822 | 0 | 57.5 MiB | pass |
| Furnished 100-cell cutaway editor | 18.4 / 18.8 ms | 26.4 | 49 | 183,096 | 0 | 61.0 MiB | pass |
| Furnished 100-cell edit churn | 17.3 / 18.6 ms | 59.9 | 123.4 | 183,465 | 0 | 77.6 MiB | pass |

The production kit response body was 364,684 bytes, below the 600,000-byte
gate; the same-origin local server reported 41,117 encoded bytes and 41,417
transfer bytes. The closed-roof worst case resolved 24 production draws,
376,320 submitted vertices, 173,044 triangles, 135,936 unique attribute bytes,
8,472 index bytes, 115,216 instance-buffer bytes, zero textures, zero fallback
draws, and zero unresolved batches. Cutaway admission raised this to 29 draws,
390,432 vertices, 179,176 triangles, and 127,908 instance-buffer bytes while
making all 100 props visible. The normal exterior made zero props visible and
reported all 100 as exterior-suppressed.

That broader report's 4.3/3.7 ms compile figures timed only the core compiler
after preparation and are superseded by the complete miss-resolution evidence
below. Its edit-churn row reused the plan cache; the historical editor action
p95/max was 15.6/17.0 ms and final Canvas pointer resolution max was 2.0 ms.
The no-structure baseline made zero kit requests and reported zero production,
fallback, and preview draws. The automated desktop row uses a 20 ms p95 gate
because 60 Hz headless rAF samples commonly land just above 16.7 ms; the
physical desktop target remains 16.7 ms.

### 2026-09-01 miss-resolution and avatar collision-step refresh

A clean, comparable production-build run at `ee78c6524` refreshed the two
constrained-mobile avatar rows with headless Chromium 149, Node 24.15.0, a fresh
managed build, and 5 s warmup/sample windows. Both rows passed the 33.3 ms frame
p95, 100 ms miss-resolution, navigation-compile, and prepare-plus-lookup gates,
plus the initial 2 ms collision-step p95 gate.

| Workload | Frame p95 / max | Long tasks | Miss resolution max | Navigation compile max | Prepare + lookup max / current | Cache | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Furnished 100-cell solid wall | 18.3 / 83.2 ms | 1 | 9.1 ms | 0.4 ms | 4.2 / 2.6 ms | hit | pass |
| House two-view movement | 26.6 / 27.4 ms | 0 | 0.6 ms | 0 ms | 0.3 / 0.3 ms | hit | pass |

The miss maximum begins before preparation and therefore supersedes the older
core-compile-only figures. Current compile duration is zero after a hit, while
the miss maximum remains available for acceptance. The profiler measures one
complete production horizontal-movement resolution per collision sample; the
fixed 0.05 ms histogram bucket makes reported p95 conservative to the bucket
ceiling.

| Workload | Total / held-key collision steps | Collision p95 / max | Collision primitives / buckets | Movement witness | Result |
| --- | ---: | ---: | ---: | --- | --- |
| Furnished 100-cell solid wall | 490 / 37 | 0.15 / 0.2 ms | 304 / 220 | Third-person push stopped after 0.14 m | pass |
| House two-view movement | 512 / 71 | 0.15 / 0.2 ms | 11 / 21 | 1.23 m third-person, then 1.34 m first-person | pass |

The timed house row is one representative owned-garden orientation. Existing
four-rotation semantic movement checks and the owned/public production-WebGL
component flows remain correctness support, not additional performance rows.
Renderer-free 2D likewise remains a no-WebGL correctness contract. Physical
iPhone/Android collision timing, interaction, memory, thermal behavior, GPU
resources, and the ten-minute soak are still required separately.

Run the matrix with:

```bash
cd apps/garden
pnpm run profile:game:buildings
```

These Chromium measurements are automated production-build evidence. They are
not physical-device frame, memory, thermal, touch, or GPU-resource proof; record
real iPhone and Android evidence separately before rollout.

The `plant-closeup` scenario set isolates the expensive transition from the
normal garden camera into a plant-heavy raised bed:

- `game-plant-heavy-closeup-desktop`
- `game-plant-heavy-closeup-mobile`

Both scenarios use the deterministic `plant-heavy` garden and select center
raised bed `29`, rather than a corner bed, so neighboring generated fields stay
in view. The desktop scenario uses the medium tier at `1280x720`/DPR 1. The
mobile scenario uses the automatic quality resolver at `390x844`/DPR 3 while
emulating a constrained 4 GiB, four-core device. Each scenario runs in five
fresh browser contexts and records separate cold and warm close-up transitions;
the report includes the individual samples and medians.

Run only this matrix with:

```bash
cd apps/garden
GAME_PROFILE_SCENARIO_SET=plant-closeup pnpm run profile:game
```

The close-up controller is enabled only when the debug profile route receives a
valid `closeupRaisedBedId` query. It drives the real normal/close-up game-state
transition while leaving the initial camera untouched. Outside an active debug
session, the generated-plant instrumentation does not publish or retain
per-session field, scheduler, cache, worker, instance-buffer, shader, or
render-build state. Shader prewarming starts immediately when close-up intent
becomes active, during the camera transition. Focused near detail retains its
billboard and raised-bed shadow proxy until the matching renderer/quality
prewarm reaches a terminal state. The retained representative materials cover
both initial and React-updated custom-material cache keys plus instanced and
non-instanced mid billboards, so Three.js cannot release or lazily introduce
their programs when detailed plants mount. Failure and timeout remain visible
fallbacks: they allow detail to mount instead of pinning the bed to a billboard.
Program diagnostics are profile-session-only and retain hashed cache keys,
numeric program IDs, and material names rather than raw shader cache keys.

Each close-up pass separates the selected field's near-LOD intent,
pending-near billboard fallback, first exact chunk, first detailed field, fully
detailed field set, and settled camera milestones. Its raw JSON preserves the
pending-or-first-detail and settled profile checkpoints. It also separates selected
and non-selected field and plant counts by near/mid/far/invisible state;
plant-generation requests, completions, consumer cancellations, worker duration,
failures, and synchronous fallback task count; main-thread render-data builds;
detailed stem, leaf, flower, produce, and thorn instances; billboard instances;
detailed shadow-caster
submissions/primitive instances; and active/peak generated-plant buffer
capacity, bytes, uploads, releases, empty meshes, and orphan detections.
Transition and steady-state samples include
browser/rendered frames, draw and instanced calls, submitted triangles, long
tasks, heap, and CDP task/script/layout duration. The steady-state record also
captures the final `generatedPlantProfile` snapshot so work which settles after
the transition sample is not lost.

Batch instrumentation can report partial field readiness with
`resolvedInstanceCount` and `billboardInstanceCount` on each field. The
profiler uses those values rather than treating a whole field as either
billboard or detailed: resolved instances contribute their detailed part
counts, unresolved fallback instances contribute to
`pendingNearPlantInstances` and `parts.billboardInstances`, and the
fully-detailed milestone is reached only after every selected field has no
billboard fallback. Each batch may also report `activeArchetypeCount` and
`failedArchetypeCount`. The snapshot exposes their totals together with
`detailedPlantInstanceCount` under `renderData`, plus
`maxArchetypeCountPerBatch` for the bounded-archetype acceptance gate.

The `generatedPlantProfile.pipeline` record accepts scheduler queue/current and
peak depth, cancellation, stale-result, deduplication, and delivery counters;
template-cache hit/miss/eviction/current and peak byte counters; and packed
worker phase-duration and transfer-byte counters. Packed timings retain total
and maximum values for topology generation, render-data construction, packing,
root batching, and the complete worker request. Scheduler and cache cumulative
counters are rebased to each cold or warm profile session. Pass the scheduler
snapshot as `schedulerBaseline` when starting a session. Worker cache response
deltas are accumulated directly, so cache counters remain valid after a worker
restart resets its internal lifetime counters. Each sub-record has
an `observed` flag, and the Markdown report renders `n/a` rather than zero until
the corresponding runtime integration submits a sample.

The optimization acceptance gate requires both `workerFailureCount` and
`syncFallbackTaskCount` to remain zero. Worker construction failure still uses
the compatibility fallback for gameplay, but a profile cannot call that
main-thread path worker-clean.

`PackedPlantRenderWorkerResponse` protocol v3 consumers should pass the complete worker
timing object rather than only its total:

```ts
recordGeneratedPlantProfilePackedWorkerResult({
    sessionId,
    timings: response.timings,
    transferByteLength: response.transferByteLength,
});
```

### Developmental plant catalog benchmark (2026-08-04)

`pnpm --dir packages/game benchmark:plants` measures every one of the 50 plant
presets at generations 4, 8, and 12, with four deterministic archetype variants
per preset. Each template receives six warmups and 24 measured samples. The
legacy baseline was captured with the same matrix and Node 24 process
immediately before the L-system implementation was removed.

| Generation | Developmental instances | Legacy instances | Change | Developmental packed bytes | Legacy packed bytes | Change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 3,572 | 8,777 | -59.3% | 276,912 | 675,720 | -59.0% |
| 8 | 9,085 | 15,129 | -39.9% | 702,924 | 1,166,900 | -39.8% |
| 12 | 11,220 | 21,258 | -47.2% | 865,472 | 1,640,616 | -47.2% |

Mature generation timing across all 200 archetypes:

| Phase | Developmental median | Legacy median | Change | Developmental p95 | Legacy p95 | Change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Topology | 0.0263 ms | 0.0219 ms | +20.2% | 0.0661 ms | 0.0668 ms | -1.1% |
| Render data | 0.0154 ms | 0.1513 ms | -89.8% | 0.0453 ms | 1.6204 ms | -97.2% |
| Packing | 0.0064 ms | 0.0093 ms | -30.8% | 0.0167 ms | 0.0331 ms | -49.6% |
| Total | 0.0494 ms | 0.1811 ms | -72.7% | 0.1270 ms | 1.7404 ms | -92.7% |

The topology phase is roughly flat, while bounded organ counts and direct organ
transforms remove most of the old turtle-rendering cost and nearly half of the
mature worker payload. Browser frame-time and GPU behavior should still be
validated with `/debug/plants?catalog=1`, which renders one mature instance of
every preset in a single deterministic scene.

The legacy `buildDurationMs` input remains accepted and maps to total worker
duration, but it cannot populate the individual phase counters. Prewarm
instrumentation records `scheduled`, `compiling`, `ready`, `failed`,
`timed-out`, or `cancelled` status plus duration and program counts before and
after compilation. Detail-swap instrumentation records any subsequent compile
count and the post-swap program count:

```ts
recordGeneratedPlantProfileShaderPrewarm({
    durationMs,
    programCountAfter,
    programCountBefore,
    status: 'ready',
});
recordGeneratedPlantProfilePostSwapCompilation({
    compilationCount,
    prewarmReady,
    programCount,
    sessionId,
});
```

All asynchronous generated-plant recorders accept an optional `sessionId`
guard. Producers should capture the value returned by
`startGeneratedPlantProfile()` (or
`getGeneratedPlantProfileSessionId()`) before scheduling work and pass it on
completion, so late results from a cold pass cannot contaminate a later warm
pass. The first detailed swap is sampled once per session. If prewarm was not
ready, `postSwapCompilationCount` stays `null` rather than reporting a
misleading zero. The Markdown close-up summary includes transition and steady
renderer/CDP/GPU medians, hierarchical LOD work per update, instance-buffer
allocation/upload metrics, render-data counts, all packed worker phase
totals/maxima, and shader status/deduplication/duration/program evidence.

When WebGL2 exposes `EXT_disjoint_timer_query_webgl2`, transition and
steady-state samples include directional GPU elapsed-time samples. The report
sets `supported: false` and records the reason when the extension is
unavailable, so a missing GPU number is not mistaken for zero work.

Normal, cold pending-near (when the transition remains pending long enough to
capture), and detailed screenshots are written below
`apps/garden/test-results/game-profile/screenshots/<scenario>/`. The JSON and
Markdown reports remain under `apps/garden/test-results/game-profile/`; use the
raw JSON when comparing optimization implementations because it preserves all
per-run cold/warm metadata.

Each scenario records startup readiness, canvas backing size, reported DPR,
requested mode, garden profile, controls mode, camera-motion mode, active
quality tier, DPR cap, shadow map size, rain/snow particle counts, active snow
overlay count, raised-bed mulch overlay count, ground decoration count, FPS,
frame-time percentiles, long tasks, draw calls, instanced draw calls, submitted
triangles, JS heap, CDP task/script/layout duration, console warnings, and
budget pass/fail. `fps` remains the browser requestAnimationFrame cadence;
`renderedFps` and `renderedFrames` count only animation ticks that submit WebGL
draw calls, so demand-rendering changes remain visible. Per-rendered-frame and
per-second draw-call and triangle fields keep scene cost attributable when the
browser and renderer cadences differ. Budgets warn during local runs and fail
the process only when `GAME_PROFILE_FAIL_ON_BUDGET=1` is set, which
`profile:game:ci` does for production checks. Managed production profiling
refuses to reuse an already reachable base URL so it cannot silently profile a
running `next dev` server.

Use `--scenario` (or `GAME_PROFILE_SCENARIOS`) to run one or more exact scenario
names independently of the selected scenario set. Repeat the option or provide
a comma-separated list. Use `--soak-ms` (or `GAME_PROFILE_SOAK_MS`) to keep each
scene running after warmup before collecting the existing `sample-ms` window.
This provides a consistent post-soak measurement without changing sample
semantics.

Useful overrides:

```bash
GAME_PROFILE_BASE_URL=http://localhost:3001 pnpm run profile:game:existing
GAME_PROFILE_BASE_URL=http://localhost:3201 pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=dense pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=dense-mobile pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=buildings pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=garden-switch pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=lifecycle pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=weather-transitions pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=plant-closeup pnpm run profile:game
GAME_PROFILE_CLOSEUP_REPEAT=1 GAME_PROFILE_SCENARIO_SET=plant-closeup pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=all pnpm run profile:game
pnpm run profile:game -- --scenario game-dense-25x25-rain-mobile
GAME_PROFILE_SCENARIOS=game-dense-25x25-rain-mobile pnpm run profile:game
GAME_PROFILE_WARMUP_MS=8000 GAME_PROFILE_SAMPLE_MS=10000 pnpm run profile:game
GAME_PROFILE_CLOSEUP_TIMEOUT_MS=45000 GAME_PROFILE_SCENARIO_SET=plant-closeup pnpm run profile:game
GAME_PROFILE_SOAK_MS=600000 GAME_PROFILE_SAMPLE_MS=10000 pnpm run profile:game
GAME_PROFILE_FAIL_ON_BUDGET=1 pnpm run profile:game
```

### Optimization report template

Use this short format when adding before/after measurements for a rendering
optimization:

```md
### YYYY-MM-DD optimization name

Build: production profile via `pnpm run profile:game:dense`
Change: short description of the optimization

| Scenario | Quality | Controls | Motion | FPS | p95 | Draw/frame | Triangles/frame | Heap | Notes |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| before | medium | 0 | none |  |  |  |  |  |  |
| after | medium | 0 | none |  |  |  |  |  |  |

Visual smoke:
- Desktop canvas nonblank and framed correctly.
- Mobile/touch canvas nonblank and controls usable.
- Drag/drop, rotate, close-up, GardenBox, raised beds, rain, snow, clouds, and
  windy sway checked where relevant.
```

### 2026-04-29 quality pass measurement

Measured with the previous existing-server profiling flow against the running
dev server. Both runs used a 5 second warmup and 5 second sample. These numbers
are still dev/headless measurements; use them for relative deltas only.

| Scenario | Main policy change | Before | After | Delta |
| --- | --- | ---: | ---: | ---: |
| Desktop baseline p95 | shadow 8192 -> medium 2048 | 250.0 ms | 208.6 ms | -16.6% |
| Mobile baseline p95 | DPR 2x -> 1x, shadows off | 275.0 ms | 141.6 ms | -48.5% |
| Mobile baseline draw/frame | DPR 2x -> 1x, shadows off | 152.6 | 97.5 | -36.1% |
| Mobile baseline triangles/frame | DPR 2x -> 1x, shadows off | 464,333 | 240,266 | -48.3% |
| Rain mobile p95 | shadows off, 2000 -> 700 drops | 641.8 ms | 149.8 ms | -76.7% |
| Rain mobile draw/frame | shadows off, 2000 -> 700 drops | 172.8 | 115.1 | -33.4% |
| Snow mobile p95 | shadows off, 3500 -> 1050 flakes | 333.4 ms | 150.0 ms | -55.0% |
| Snow mobile draw/frame | shadows off, 3500 -> 1050 flakes | 168.4 | 113.1 | -32.8% |
| Plants desktop p95 | shadow 8192 -> medium 2048 | 642.6 ms | 434.3 ms | -32.4% |

Canvas backing sizes and active quality metadata are now visible in the Markdown
report. Mobile scenarios should be profiled at medium quality by default,
matching the automatic resolver and using the medium DPR cap instead of the
manual low-tier cap.

Frame-time budgets still fail in dev because every scenario reports many long
tasks and low rAF cadence in headless Chromium. The draw-call and triangle deltas
show the renderer policy is doing useful work, but final budget decisions should
come from `profile:game:ci` plus real mobile/lower-end desktop device runs.

### 2026-04-29 detail gate production smoke

Measured with `GAME_PROFILE_WARMUP_MS=1000 GAME_PROFILE_SAMPLE_MS=1000 pnpm run
profile:game`, which builds the production app and starts it with `pnpm start`.
This is a short smoke profile, not a final performance benchmark, but it verifies
that the quality gates are active in production output.

| Scenario | Quality | Snow + mulch / decorations | Draw/frame | Triangles/frame | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| `game-baseline-desktop` | medium | 0 + 0 / 14 | 140 | 513,394 | medium keeps half-density ground details |
| `game-baseline-mobile` | low | 0 + 0 / 0 | 62.2 | 258,903 | low disables ground decorations and shadows |
| `game-details-desktop` | medium | 0 + 0 / 14 | 54.6 | 82,592 | explicit details route confirms decoration count |
| `game-rain-mobile` | low | 0 + 0 / 0 | 38.3 | 56,698 | low rain uses 700 particles |
| `game-snow-mobile` | low | 13 + 0 / 0 | 56.0 | 59,132 | snow overlays mount only above low-tier coverage threshold |
| `plants-desktop` | medium | 0 + 0 / 0 | 468 | 1,663,219 | still the largest render-work hotspot |

The short profile still fails frame-time budgets. The reported p95 values are
dominated by long headless-browser stalls, so use draw calls, triangles, active
detail counts, and repeated longer samples for optimization deltas. These
historical mobile rows used the manual low tier; current mobile profiling uses
medium because automatic quality no longer resolves to low.

### 2026-06-01 dense 25x25 production smoke

Measured with a production `apps/garden` build started on `http://localhost:3205`
and a synthetic `/debug/sandbox` garden injected through local storage. Each
sample used a 3 second warmup and 3 second collection window in headless
Playwright. Treat absolute FPS/p95 as noisy; use heap and render-work deltas for
direction.

| Scenario | Blocks | Quality | Details | Draw/frame | Heap | Notes |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| `25x25-ground-desktop-medium` | 625 | medium | 1,370 decor | 426 | 132.6 MB | before pass: about 830 draw/frame and 179 MB |
| `25x25-raised-desktop-medium` | 1,250 | medium | 1,352 decor | 453 | 149.7 MB | before pass: about 1,186 draw/frame and 347 MB |
| `25x25-ground-mobile-low` | 625 | low | 0 decor | 133 | 132.6 MB | before pass: about 120 draw/frame and 179 MB |
| `25x25-raised-mobile-low` | 1,250 | low | 0 decor | 140 | 202.2 MB | before pass: about 227 draw/frame and 391 MB |

The main improvement is memory and submitted draw work for dense scenes without
forcing a low-quality fallback. Desktop medium still creates many shadow and
decoration draw calls, but the repeated block geometry, decoration billboards,
and weather overlays no longer mount one React/fiber child per instance.

### Steady browser sample

The VS Code browser sample stayed at DPR 2 even when different profiles were
requested, so treat this as a steady-state draw-call sample rather than a true
desktop-vs-mobile comparison. It ran a 5 second `requestAnimationFrame` sample
after the scene was already loaded.

Note: the `/debug/plants` row is historical from the older standalone generated
plant grid. The current `/debug/plants` route uses the normal game scene with
the `plant-heavy` mock garden profile.

| Route | FPS | p95 frame | Draw calls / 5s | Approx draw calls / frame | Triangles / 5s | Approx triangles / frame |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` signed-out mock scene | ~119.9 | ~8.8-9.2 ms | ~88,948 | ~148 | ~265M | ~442k |
| `/debug/plants` | ~119.8 | ~8.9 ms | ~198,330 | ~331 | ~691M | ~1.15M |

Interpretation:

- The optimized mock scene can hit the local desktop browser's 120 Hz cadence in
  dev when the page is already warm.
- The submitted triangle count is high relative to the simple visible scene,
  especially in the plant debug route. Shadow passes, instancing, overlays, and
  detail layers likely multiply the small source asset into a much larger render
  workload.
- The debug plants route roughly doubles draw calls and more than doubles
  submitted triangles compared with the home scene, which makes plant/detail LOD
  a real optimization target even though the base GLB is small.

### Controlled Playwright startup sample

Standalone Playwright was also run with explicit desktop and mobile contexts.
The first usable run measured from soon after the canvas appeared, so it mostly
captured dev-mode startup, lazy route work, hydration, auth warnings, and scene
warmup rather than pure steady rendering. That is still valuable because startup
churn is part of the perceived lag.

| Profile | Canvas backing size | Reported DPR | FPS | p95 frame | Long tasks | Notes |
| --- | --- | ---: | ---: | ---: | --- | --- |
| home desktop DPR 1 | 1280 x 720 | 1 | 3.8 | 1299 ms | 38 / 10.8 s total | dev startup dominated |
| home mobile DPR 3 | 780 x 1688 | 3 | 3.1 | 1483 ms | 32 / 8.7 s total | backing store was effectively 2x, not 3x |
| plants desktop DPR 1 | 1280 x 639 | 1 | 3.8 | 1600 ms | 24 / 5.7 s total | route and scene warmup dominated |
| plants mobile DPR 3 | 780 x 1486 | 3 | 4.4 | 1408 ms | 37 / 6.0 s total | route and scene warmup dominated |

Interpretation:

- Startup/warmup in dev can be extremely noisy and should not be used as a final
  FPS number.
- The measured mobile DPR 3 contexts produced 2x canvas backing stores. That is
  probably coming from library/default clamping, but it is implicit. We should
  make DPR caps explicit in the game quality layer so mobile behavior is owned by
  the app rather than defaults.
- The cold-ish samples show many multi-hundred-ms and multi-second main-thread
  stalls. Production profiling should separate app startup/hydration costs from
  steady WebGL frame cost.

## Current bottleneck assessment

### 1. Shadow quality is still the largest obvious GPU risk

`Environment.tsx` now uses quality-tiered shadows: low disables them, medium uses
2048, and high uses 4096. The package still has 109 coarse `castShadow` /
`receiveShadow` occurrences. On mobile and integrated GPUs, shadow map rendering
and sampling can dominate frame time before the scene geometry itself becomes
complex, so the remaining work is to remove shadows from effects and tiny detail
layers.

Recommended work:

- Keep current quality-tier shadow sizes: low off, medium 2048, high 4096.
- Verify whether low tier needs a cheap contact-shadow or baked grounding cue.
- Remove shadows from transparent/effect layers: snow overlays, clouds,
  precipitation, billboards, tiny ground details, and transient particles.

Expected impact: high on mobile and lower-end desktops.

### 2. Canvas quality policy is now explicit but basic

`Scene.tsx` now sets explicit DPR caps by quality tier. Low caps to 1, medium to
1.5, and high to 2, using the cap form so DPR 1 desktop displays are not
upscaled. The policy is still static after mount; it does not yet degrade based
on sustained slow frames or expose a user preference.

Recommended work:

- Continue refining the automatic game quality resolver using viewport, pointer
  type, DPR, memory, CPU cores, and eventually a persisted user override.
- Keep explicit DPR caps by tier: `1` manual low, `1.5` medium/default, `2`
  high.
- The debug HUD now exposes FPS/p95, active tier, DPR cap, canvas backing size,
  shadow size, and weather particle counts.
- Add adaptive degradation after sustained slow frames: lower DPR, reduce
  shadows, hide decoration layers, then reduce particle counts.

Expected impact: high on high-DPR devices.

### 3. Continuous frame work remains spread across the scene

The old time manager optimization removed one recurring React update, but the
scene still has about a dozen `useFrame` systems: controls, camera animation,
clouds, sun/moon, stars, rain, snow, action particles, sprite billboards, plant
sway, plant LOD, and snow overlay material damping.

Recommended work:

- Classify frame systems as always-needed, interaction-only, weather-only, or
  close-up-only.
- Avoid registering `useFrame` callbacks when the feature is disabled or static.
- Move shared animation time into grouped uniforms rather than many small React
  component callbacks.
- Evaluate `frameloop="demand"` only after optional continuous effects are gated;
  otherwise weather/cloud systems will keep invalidating every frame anyway.

Expected impact: medium to high, especially for idle gardens.

### 4. Snow overlays are still mounted and animated per instance

`EntityInstancesBlock` instances the base block meshes, but maps snow overlays
as separate `SnowOverlay` meshes. `SnowOverlay` creates overlay geometry/material
and registers a per-overlay frame callback to damp a uniform. Raised-bed mulch
also mounts snow overlays.

Current status: overlays are no longer mounted below tier-specific coverage
thresholds, and snow overlay meshes no longer receive shadows. Low quality uses a
high coverage threshold so ordinary mobile scenes avoid overlay geometry until
the visual snow effect is meaningful.

Recommended work:

- Keep validating snow overlay thresholds against real winter scenes.
- Batch or instance overlays by source geometry and snow preset.
- Share materials per overlay group where possible.
- Update snow amount through one shared material group updater or only when
  coverage changes.

Expected impact: high for normal gardens with many blocks; low in scenes where
snow is disabled and overlays are absent.

### 5. Weather particles are CPU-updated every frame

Rain loops over up to 2,000 drops and repeatedly reads/decomposes/writes instance
matrices. Snow can mount `snowParticles * 5000` flakes and updates each particle
on the CPU every frame. That pattern is particularly expensive on low-end mobile
CPUs.

Recommended work:

- Move rain/snow animation to the vertex shader with instanced attributes for
  seed, spawn position, speed, drift, and lifetime.
- Cap counts by quality tier and viewport area.
- Use a 2D/mobile overlay fallback for low tier.
- Pause weather when the scene is hidden, offscreen, or used as a non-interactive
  preview.

Expected impact: high in rain/snow; neutral in clear weather.

### 6. Ground sprites and plants need tighter batching and LOD

`SpriteAtlasBillboard` registers a `useFrame` callback per sprite and still runs
for static sprites to reset rotation. The plant debug route also submitted far
more draw calls and triangles than the home scene.

Current status: sprite billboards now split static and animated mesh components,
so calm/static sprites do not register a per-frame callback. Dense ground
decorations are batched into atlas/material instanced planes with shader-driven
wind motion. They remain quality-gated: low disables them, medium renders
reduced density, high keeps full density, and far zoom skips them.

Recommended work:

- Add distance/viewport culling for decoration batches in larger gardens.
- Keep hiding small decoration sprites by quality tier, distance, and zoom.
- Use plant billboards for normal/far garden views and detailed generated plants
  only for close-up or high-quality mode.
- Keep `deferDetails` enabled on `apps/garden/app/page.tsx`, and add quality-
  aware LOD so dense plant/detail work does not all mount after the short delay.

Expected impact: medium in mock scenes, high in dense gardens and plant-heavy
views.

### 7. Startup and profiling noise need their own budget

The controlled Playwright run exposed severe dev startup stalls. Some of that is
expected in `next dev`, but it can hide real scene regressions. Runtime warnings
also showed auth 401s, missing dialog descriptions, and a `THREE.Clock`
deprecation in the plant route.

Recommended work:

- Profile production builds on devices before final decisions.
- Keep extending the repeatable profiling route so it bypasses app-level auth and
  analytics noise while still rendering realistic garden data.
- Guard verbose logs in game runtime paths.
- Keep startup metrics separate from steady frame metrics.

Expected impact: high for measurement clarity; variable for production frame
time.

## Recommended implementation order

1. Clean up profiling noise: make the production profile the primary gate,
  suppress or isolate unrelated auth/analytics requests on debug routes, and
  keep dev-headless frame timing separate from render-work deltas.
2. Continue batching detail layers: snow overlays and ground decorations are now
  gated by coverage, zoom, and quality; ground decorations are batched by atlas
  page with per-instance sprite UVs, so the next win is active overlay and
  plant/detail LOD batching.
3. Replace CPU weather particle loops with shader-driven animation or a mobile
   overlay fallback.
4. Tighten plant/detail LOD. `deferDetails` is now enabled on the main garden
  route, but dense plant/detail work still needs quality-aware LOD.
5. Batch remaining plant/detail billboards; ground atlas sprites now share
   atlas-page instanced batches.
6. Evaluate `frameloop="demand"` or adaptive frame-loop modes after optional
   continuous effects are controlled.
7. Add adaptive quality fallback after sustained slow frames.

## Measurement plan

Use the same matrix before and after each optimization:

- Production build, not only `next dev`.
- Mock garden route, one realistic signed-in garden, and a synthetic dense garden
  with many blocks/raised beds/plants.
- Desktop integrated GPU, low-end laptop, mid-tier iPhone/Android, and high-DPR
  desktop display.
- Clear weather, heavy rain, snow particles, and winter snow accumulation.
- Startup sample and steady sample as separate numbers.
- Metrics: FPS, p95/p99 frame time, max frame spike, long tasks, draw calls,
  triangles, canvas backing resolution, DPR, shadow map size, JS heap, weather
  particle counts, active snow overlays, and WebGL errors/context loss.

Target budget for smooth mobile interaction: p95 below 16.7 ms for 60 FPS, or
below 33.3 ms for an acceptable 30 FPS fallback during heavy weather or large
gardens.

## Weather QA matrix and performance budget (GRE-306)

Use this matrix for weather sign-off so we validate realistic overlaps instead
of isolated effects. Run each preset in **day**, **twilight**, and **night**,
on both desktop and mobile viewport presets.

### Preset definitions (debug path)

Preferred local path: open a garden scene with the in-game debug panel and
enable weather override controls.

- Toggle **Override weather**.
- Set cloudy/rain/snow/fog sliders and wind values for the target preset.
- Use the time controls to force day/twilight/night snapshots.

If the panel is not available in your environment, use
`/debug/profile/game` modes (`baseline`, `rain`, `snow`) plus temporary local
debug values in `GameScene` props as a fallback.

### Required QA presets

| Preset | Weather control target | Extra checks |
| --- | --- | --- |
| Clear | cloudy 0, rain 0, snow 0, fog 0, wind 0-2 | HUD icons/text legible in full sun and night contrast |
| Cloudy | cloudy 0.6-0.9, rain 0, snow 0, fog 0-0.1 | Cloud coverage does not flatten scene readability |
| Foggy | fog 0.5-0.9, cloudy 0.2-0.7 | Near/far depth remains readable and clickable |
| Light rain | rain 0.2-0.4, cloudy 0.4-0.8, wind 2-6 | Rain sound level and mute behavior are correct |
| Heavy rain | rain 0.8-1.0, cloudy 0.8-1.0, wind 6-14 | No input lag spikes; overlays do not hide interactables |
| Snow | snow 0.4-0.8, cloudy 0.5-0.9, wind 2-8 | Snow particles and audio remain balanced |
| Accumulated snow | snow 0.6-1.0 + snow accumulation maxed | Block/entity overlays align with geometry |
| Windy | wind 12-25, rain/snow 0-0.2 | Wind-driven motion and sound stay synchronized |
| Thunderstorm | rain 0.8-1.0, cloudy 0.9-1.0, wind 10-20 + thunder/lightning | Flash + thunder are noticeable but not overwhelming |
| Autumn leaves | windy + autumn season/leaves enabled | Leaf particles + accumulation keep scene readable |

### Cross-cut checks per preset

- Interaction: no state makes the garden blank, unclickable, or touch-blocked.
- HUD: weather HUD remains readable in day/twilight/night on desktop and mobile.
- Audio: mute, volume sliders, and weather-disable settings are respected.
- Accessibility: reduced-motion mode lowers or simplifies weather motion.
- Fallback behavior: disabling weather visualization removes weather FX without
  breaking non-weather gameplay.

### Performance budget for heavy weather sign-off

Treat these as release gates for heavy-rain/heavy-snow/windy/autumn scenarios
on a full garden:

- **Desktop target:** p95 frame time <= 16.7 ms (about 60 FPS).
- **Mobile target:** p95 frame time <= 33.3 ms (about 30 FPS minimum fallback).
- **Stability target:** no sustained interaction stalls > 500 ms during active
  weather and overlay updates.

Measure via `apps/garden/scripts/profile-game-scene.mjs` profiles plus manual
device checks for touch/HUD/audio quality. If any preset fails, file a focused
follow-up ticket with reproduction details instead of broadening this pass.
