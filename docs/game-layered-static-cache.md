# Layered static opaque cache

`StaticOpaqueSceneCacheProvider` keeps a screen-space copy of the static opaque
scene: color, depth, and the cloud-shadow response. While the camera,
lighting, and cached content stay the same, each frame replays that copy with
one full-screen triangle. Dynamic content then renders live on top and is
depth-tested against the replayed depth.

Issue #4723 replaced the old High-only, all-or-nothing gate with layers that
can each fall back to live rendering, a memory budget per device, and a
benefit gate that runs while the game runs.

## What changed and why

The previous cache:

- ran only when the quality tier was High;
- allowed up to 160 MiB on every device;
- switched the whole cache to live rendering whenever rain, snow, frost, or
  surface wetness was active;
- became `unsupported` for the whole scene when any cached boundary swapped to
  a material the cache cannot replay;
- had no measure of whether it saved GPU time.

The renderer draws only on demand. The cache can only help on frames where
the camera, lighting, and static content stay the same while something else
moves. Examples are fauna, particles, leaves, rain, snow, and cloud shadows.
Rain and snow were common cases of that, but the old weather bypass turned the
cache off for them.

## Layers

Boundaries register under a layer group: `base-terrain` or `static-props`.
#4721 renders each group's static render packets under one boundary. Each
frame, every mounted boundary is either:

- **cached**: all of its renderables pass the opaque material and replay
  checks; or
- **live**: at least one renderable needs shader behavior the cache cannot
  replay. Examples are an integrated rain, snow, or frost material, a
  transparent overlay, or a custom shader hook. A live boundary renders
  normally over the replay.

When a boundary changes between cached and live, the registry invalidates
with `layer-change`. That frame renders live, and the next stable frame
captures only the boundaries that are still cacheable. A boundary that becomes
cacheable again rejoins the same way. Only the boundaries that changed leave
the cache. Static props stay cached while the base ground swaps to its
integrated weather material.

Weather no longer bypasses the whole cache. Every weather input that can
change a cached layer's pixels is already covered elsewhere:

- integrated weather surfaces swap materials, so their boundary goes live;
- light, fog, and environment changes are part of the lighting signature;
- static-shadow refreshes bypass through `shadow-update`;
- rain, snow, splashes, and overlays render live and are depth-tested against
  the replayed depth;
- cloud shadows keep their per-frame replay response.

Camera and pointer interaction, close-up view, wireframe, XR, scene override
materials, and auto-updating shadow maps still render live.

## Gates

The cache is offered on every quality tier. `GameScene` still turns it off
for the garden avatar. Each frame checks these gates in order:

1. **Capability**: WebGL2, a multisampled canvas, ACES tone mapping, sRGB
   output, a complete framebuffer, and a live context.
2. **Memory budget**: `resolveStaticOpaqueSceneCacheBudget` allows 20 MiB per
   GiB of `navigator.deviceMemory`, capped at the original 160 MiB.

   | Reported device memory | Budget |
   | --- | --- |
   | under 2 GiB | disabled (`low-device-memory`) |
   | 2 GiB | 40 MiB |
   | 4 GiB, or not reported | 80 MiB |
   | 8 GiB or more | 160 MiB |

   The target estimate includes resolved RGBA8 color and cloud response, D24
   depth, and 8 bytes per pixel for each MSAA sample. A drawing buffer above
   the budget reports `target-budget` and keeps 1×1 targets.
3. **Benefit**: `staticOpaqueSceneCacheBenefit.ts` judges windows of 60 hits
   and captures, or ends a window early after 8 captures:
   - **Measured GPU time.** Used when `EXT_disjoint_timer_query_webgl2` is
     available and no other owner holds the only timer query. Adaptive High
     and the profiler's external timer both hold it. Capture and hit frames
     are timed. Every 30th consecutive hit renders live as a probe, and the
     first probe comes after 4 hits. The window keeps the cache only when
     `hits × (live − hit) − captures × (capture − live)` is positive.
   - **Submitted work diagnostic.** It estimates static work from submissions,
     triangles, and a full-screen shading term. Negative work can reject capture
     churn, but positive work does not establish a GPU saving. At the end of
     the bounded probe, missing live/hit/capture samples disable caching with
     `gpu-unavailable`. This includes absent timer extensions, external timer
     ownership, query timeouts and disjoint results.

   Query samples carry the benefit window that started them. Results arriving
   after a window, scene signature or context change cannot enter a later
   decision. Scene changes and disjoint results clear GPU evidence and its
   matching frame counts without extending the probe. The net GPU rate is per
   cached frame in that unchanged scene; paired timing also includes live probes.
   Sample arrays are bounded to the 60-frame window. Unsupported render paths
   and the diagnostic legacy path retain 1×1 targets.

   A losing window disables the cache with `low-benefit`, shrinks its targets
   to 1×1 so their memory is released, and waits 30 seconds. Each consecutive
   loss doubles that cooldown, up to 5 minutes. The cache then probes again.

## Diagnostics

`window.__grediceGameProfile` adds these fields to the existing
`staticOpaqueSceneCache*` counters:

- `...BudgetBytes`, `...BudgetSource`: the device budget and how it was
  chosen.
- `...AllocatedTargetBytes`, `...PeakTargetBytes`: current and peak estimated
  target bytes.
- `...BenefitStatus` (`probing`, `enabled`, or `disabled`),
  `...BenefitReason`, `...BenefitEvaluationCount`,
  `...BenefitNetGpuMsPerFrame`, `...BenefitNetWorkPerFrame`.
- `...GpuTimingSupported`, `...GpuSampleCount`, `...ProbeFrameCount`.
- `...LiveBoundaryCount`, `...BaseTerrainLayer`, `...StaticPropsLayer`
  (`cached`, `live`, `mixed`, or `absent`).

`staticOpaqueSceneCacheEnabled` is now `true` on Low and Medium as well when
the cache is requested. Paired comparisons treat it as a runtime-policy field,
so the before and after reports must both come from builds with the same
cache policy.


## Supplemental cache clearance

Issue #4723 can conclude with a measured live no-op. Cache preference, draw-call
reduction and a positive work estimate do not establish measured GPU savings.
The existing canonical `cross-tier`, `all`, lifecycle and strict comparison v6
scenarios remain unchanged. The following opt-in sets reuse the same profiler,
resource receipt barrier, image comparator, depth fixture and lifecycle driver:

| Set | Coverage |
| --- | --- |
| `static-cache-visuals` | Low, Medium, High, Automatic standard→Medium and Automatic constrained; clear, cloudy, rain and snow; five fixed-time legacy/cache pairs per mode |
| `static-cache-depth` | Existing foreground/occluder/background pixel fixture in every resolved tier |
| `static-cache-lifecycle` | Existing cold, offscreen, hidden, resumed and WebGL context loss/restoration sequence in every tier |
| `static-cache-layers` | Sparse/integrated snow, cloud response, rain/clear and fresh frost/clear transitions, with a fresh resource witness after every change |
| `static-cache-soak` | At least 60 seconds per tier; resource witnesses every five seconds plus the final measured window |
| `static-cache-clearance` | All supplemental sets above |

Run against a separately built production server after the optimized live scene
has established an opportunity. For example:

```bash
node apps/garden/scripts/profile-game-scene.mjs --base-url http://localhost:3101 \
  --scenario-set static-cache-depth --out-dir .game-profile-results/cache-depth
```

The supplemental profiler observes the cache's own render-pass queries without
claiming the WebGL query slot. Its explicit `cache-owned-render-pass-v1` mode
uses the same timer/render boundary for legacy and cached frames and records
capture, hit and live-probe samples together. Only paired runs using that mode
can provide supplemental GPU comparisons. Absent, disjoint, invalid or undrained
queries stay inconclusive. The unchanged paired limits require five GPU pairs,
median GPU ratio ≤0.95 and maximum individual ratio ≤1.05, CPU median ≤1.05,
draw/triangle ratios ≤0.9, at most one additional program/four textures, visual
mismatch ≤0.01 and P99 byte error ≤8. Depth keeps match ≥0.96, leak ≤0.04 and
three verified hits. A failed savings comparison remains a negative result even
when the safe live no-op passes its ownership checks.

The observer also times cold, shadow-refresh and layer-change live renders,
but those diagnostic samples carry window `-1` and cannot enter admission or
advance its probe cadence. A legacy row polls the same timer and renders once
without registry, lighting, geometry or material signature scans. Its disabled
decision/replay metadata is reset while actual query/live counts and the resource
peak remain visible. Switching cache preference off releases both targets;
restarting keeps a monotonic benefit generation so pending pre-disable queries
cannot become evidence for a later probe.

`staticCacheEvidence` stores decision, budget, current/peak bytes, independent
terrain/prop layer states, weather values and resource receipts outside timed
windows. The target byte estimate already includes the 36-byte replay triangle;
do not add that replay again. All snapshots must fit the reported per-device
budget, and rejected probes must release their targets. Soak resource growth
is bounded to one program, four textures and two geometries after warmup.
Lifecycle retains the canonical suspension/context requirements and adds cache
admission and resource witnesses before suspension and after restoration.
Every supplemental witness binds the original URL's cache role, quality setting
and scene mode to the committed scene and renderer diagnostics. Automatic
resolving to Medium must still prove the Automatic setting. Explicit legacy visual rows
must remain legacy; every cache row and weather phase must prove measured
admission with replay ready or a diagnosed live no-op with released targets.
A measured phase followed by a no-op still requires valid cache-owned GPU
queries. These local decisions do not themselves establish paired GPU savings.

Only supplemental URLs enable `staticCacheWitness=1`. Their hidden React
receipt records the exact weather inputs passed to `GameScene`, the accepted
transition request and its increasing revision. Each weather event must commit
that receipt before sampling; a non-cancelled dispatch is insufficient. Weather
visual rows additionally require actual cloud/rain/snow effect counters. Layer
rows require integrated snow to enter and return to sparse fallback, frost to
follow the resolved tier policy and clear, and active rain/snow/frost terrain
to remain live. Low and constrained frost's deliberate zero still needs the
fresh cold input receipt. Ignored events, stale receipts, wrong modes, legacy
cache rows and missing rendered effects fail clearance.
Automatic hardware witnesses are deterministic browser overrides for coverage;
they do not replace physical-device memory, thermal or GPU clearance.

Low disables grounding shadows, so its shadow registry has no registrations.
Supplemental resource snapshots reuse the canonical absent-registry policy only
when both the requested tier and the freshly observed runtime disable shadows.
The recorded `shadowPopulationPolicy` names that boundary; an empty shadow
exposure does not claim zero fauna. Enabled, unknown or mismatched shadow modes
still require valid population telemetry, and malformed counts always fail.
Actual fixture blocks/plants and fauna trajectories have separate witnesses.

Retained compiler source reuse has a separate 4 MiB/256-source bound documented
in [game-retained-chunks.md](./game-retained-chunks.md). Shared palette geometry
is an owned clone with immutable PBR attributes; its identity/version and
last-owner disposal preserve that compiler contract. Neither cache diagnostic
owns, detaches or disposes the live GLTF geometry.
