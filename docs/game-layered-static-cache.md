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
   - **Work model.** Used when there are not enough timer samples. It
     estimates static work from submissions, triangles, and a full-screen
     shading term. A hit saves that work minus the composite. A capture costs
     it once per extra capture pass (two passes with cloud shadows) plus the
     composite.

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
