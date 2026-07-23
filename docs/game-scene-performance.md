# Game scene performance analysis

Date: 2026-04-29

## Summary

The scene still does not look asset-bound. Game models are now split into one
runtime GLB per asset under `apps/garden/public/assets/models`, generated from
one Blender source file per asset under `assets/game-assets`. The split set is
932,304 bytes across 31 GLBs and contains 59 meshes, 75 primitives, 22,300
vertices, 18 shared material names, and no animations.

The optimization already made since the first pass is meaningful: the scene no
longer mounts the old one-second game-time manager. Environment, sun/moon, plant,
and suggestion code now read `useSnapshotTime()`, which removes recurring React
state churn from normal unfrozen time. That should help idle stability and avoid
unrelated scene re-renders.

The remaining cost is still render policy and auxiliary systems rather than raw
model complexity: continuous frame loops, high-resolution shadows, many shadow
casters/receivers, per-instance snow overlays, CPU-updated weather particles,
per-sprite billboard callbacks, and detailed plant/decoration layers. These costs
scale poorly on high-DPR mobile and lower-end desktop GPUs.

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

Measured from the current workspace on 2026-04-29:

| Area | Current value | Notes |
| --- | ---: | --- |
| GLB size | 932,304 bytes across 31 files | split by asset; `GiftBox.glb` is the largest at about 207 KB |
| GLB meshes | 59 | summed across split assets |
| GLB primitives | 75 | summed across split assets |
| GLB vertices | 22,300 | summed across split assets |
| GLB triangles | not remeasured | split export changed file boundaries |
| GLB textures | 1 source texture | material names are duplicated only as runtime GLB-local data |
| Runtime `useFrame` source files | 12 | still enough to keep continuous work alive |
| `castShadow` / `receiveShadow` occurrences | 109 | coarse source count in `packages/game/src` |
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
- `/debug/profile/game?mode=details&profile=plant-heavy&quality=medium`

The `quality` query accepts `low`, `medium`, or `high`. When omitted, the game
uses the automatic quality resolver. The `profile` query accepts `default`,
`dense`, or `plant-heavy`. Dense profile scenes use deterministic 25x25 mock
gardens so larger-scene measurements do not depend on signed-in garden data. The
`details` query defaults to `1`; use `details=0` only when intentionally
profiling the reduced scene without detail layers such as mulch, ground
decorations, and animals. Controls, the regular HUD, and the debug HUD are
hidden by default; add `controls=1`, `hud=1`, or `debugHud=1` only when needed.
Mobile profile scenarios use `quality=medium`, matching the automatic resolver
policy that no longer selects the low tier by default. Use `quality=low` only
for explicit manual low-tier comparisons.

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
render-build state. Shader prewarming starts when close-up intent becomes
active, during the camera transition. Successful representative materials stay
retained per renderer/quality variant so Three.js cannot release the compiled
programs before detailed plants mount.

Each close-up pass separates the selected field's near-LOD intent,
pending-near billboard fallback, first exact chunk, first detailed field, fully
detailed field set, and settled camera milestones. Its raw JSON preserves the
pending-or-first-detail and settled profile checkpoints. It also separates selected
and non-selected field and plant counts by near/mid/far/invisible state;
L-system requests, completions, consumer cancellations, worker duration and
failures; main-thread render-data builds; detailed stem, leaf, flower, produce,
and thorn instances; billboard instances; detailed shadow-caster
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
and maximum values for symbol generation, render-data construction, packing,
root batching, and the complete worker request. Scheduler and cache cumulative
counters are rebased to each cold or warm profile session. Pass the scheduler
snapshot as `schedulerBaseline` when starting a session. Worker cache response
deltas are accumulated directly, so cache counters remain valid after a worker
restart resets its internal lifetime counters. Each sub-record has
an `observed` flag, and the Markdown report renders `n/a` rather than zero until
the corresponding runtime integration submits a sample.

`PackedPlantRenderWorkerResponseV1` consumers should pass the complete worker
timing object rather than only its total:

```ts
recordGeneratedPlantProfilePackedWorkerResult({
    sessionId,
    timings: response.timings,
    transferByteLength: response.transferByteLength,
});
```

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
GAME_PROFILE_SCENARIO_SET=weather-transitions pnpm run profile:game
GAME_PROFILE_SCENARIO_SET=plant-closeup pnpm run profile:game
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
