# Game scene performance analysis

Date: 2026-04-29

## Summary

The scene still does not look asset-bound. The shared GLB is unchanged and small
for a 3D scene: `apps/garden/public/assets/models/GameAssets.glb` is 822,460
bytes and contains 57 meshes, 73 primitives, 21,314 vertices, about 21,295
triangles, one texture, and no animations.

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
- The remaining expensive areas are continuous `useFrame` systems, snow overlays,
  CPU weather loops, animated sprite billboard callbacks, plant/detail LOD, and
  profiling noise from app-level providers.

## Current static snapshot

Measured from the current workspace on 2026-04-29:

| Area | Current value | Notes |
| --- | ---: | --- |
| GLB size | 822,460 bytes | unchanged |
| GLB meshes | 57 | unchanged |
| GLB primitives | 73 | unchanged |
| GLB vertices | 21,314 | unchanged |
| GLB triangles | ~21,295 | unchanged |
| GLB textures | 1 | unchanged |
| Runtime `useFrame` source files | 12 | still enough to keep continuous work alive |
| `castShadow` / `receiveShadow` occurrences | 109 | coarse source count in `packages/game/src` |
| Directional shadow map | low: off, medium: 2048, high: 4096 | legacy default was 8192 |
| Canvas DPR policy | low: cap 1, medium: cap 1.5, high: cap 2 | set as a DPR cap, not a forced upscale |
| Weather particle policy | low: 35% rain / 30% snow, medium: 70% / 60%, high: 100% | profiler reports active rain/snow counts |
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
scene without signed-in game data requirements, login UI, HUD, or sound. In dev
it still inherits app-level providers, so reports can include unrelated
auth/analytics console noise; isolating that is now part of the profiling cleanup
step. It supports these stable modes:

- `/debug/profile/game?mode=baseline&controls=0&quality=medium`
- `/debug/profile/game?mode=baseline&controls=0&quality=low`
- `/debug/profile/game?mode=details&controls=0&quality=medium`
- `/debug/profile/game?mode=rain&controls=0&quality=low`
- `/debug/profile/game?mode=snow&controls=0&quality=low`

The `quality` query accepts `low`, `medium`, or `high`. When omitted, the game
uses the automatic quality resolver.

Generate the default production report. This builds the garden app, starts it
with `pnpm start` on `http://localhost:3101`, profiles the scenarios, and then
stops the managed server:

```bash
cd apps/garden
pnpm run profile:game
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

The profiler currently samples these scenarios:

- `game-baseline-desktop`
- `game-baseline-mobile`
- `game-details-desktop`
- `game-rain-mobile`
- `game-snow-mobile`
- `plants-desktop`

Each scenario records startup readiness, canvas backing size, reported DPR,
active quality tier, DPR cap, shadow map size, rain/snow particle counts, active
snow overlay count, raised-bed mulch overlay count, ground decoration count, FPS,
frame-time percentiles, long tasks, draw calls, instanced draw calls, submitted
triangles, JS heap, CDP task/script/layout duration, console warnings, and
budget pass/fail. Budgets
warn during local runs and fail the process only when
`GAME_PROFILE_FAIL_ON_BUDGET=1` is set, which `profile:game:ci` does for
production checks. Managed production profiling refuses to reuse an already
reachable base URL so it cannot silently profile a running `next dev` server.

Useful overrides:

```bash
GAME_PROFILE_BASE_URL=http://localhost:3001 pnpm run profile:game:existing
GAME_PROFILE_BASE_URL=http://localhost:3201 pnpm run profile:game
GAME_PROFILE_WARMUP_MS=8000 GAME_PROFILE_SAMPLE_MS=10000 pnpm run profile:game
GAME_PROFILE_FAIL_ON_BUDGET=1 pnpm run profile:game
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
report. The important mobile confirmation: the baseline/rain/snow mobile scenes
now render at `390 x 844` instead of `780 x 1688`, and report low quality with
shadows off.

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
detail counts, and repeated longer samples for optimization deltas. The useful
confirmation is that low mobile now eliminates optional ground decorations, and
clear scenes no longer mount snow overlays.

### Steady browser sample

The VS Code browser sample stayed at DPR 2 even when different profiles were
requested, so treat this as a steady-state draw-call sample rather than a true
desktop-vs-mobile comparison. It ran a 5 second `requestAnimationFrame` sample
after the scene was already loaded.

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
- Keep explicit DPR caps by tier: `1` low/mobile, `1.5` default, `2` high.
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
so calm/static sprites do not register a per-frame callback. Ground decorations
are also quality-gated: low disables them, medium renders reduced density, high
keeps full density, and far zoom skips them.

Recommended work:

- Batch ground decoration sprites by atlas page using instanced planes and
  per-instance UV rectangles.
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
  gated by coverage, zoom, and quality; the next win is batching/instancing
  active overlays and atlas sprites.
3. Replace CPU weather particle loops with shader-driven animation or a mobile
   overlay fallback.
4. Tighten plant/detail LOD. `deferDetails` is now enabled on the main garden
  route, but dense plant/detail work still needs quality-aware LOD.
5. Batch atlas sprites; static and animated sprite billboards are already split.
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
