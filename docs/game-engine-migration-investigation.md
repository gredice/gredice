# Game engine migration investigation

Date: 2026-09-26. Repository baseline: `c5a42da459d5c68b1a89a9e002ac00ece7e35cef`.

## Recommendation

Keep the current Three.js renderer for now. A migration is technically possible,
but the measurements below do not justify a full engine rewrite for performance.
First profile the complete game on the phones that matter, then optimize the
measured bottleneck. Keep a WebGPU experiment as an optional renderer branch;
consider Wasm only for a demonstrated bulk CPU hotspot.

Three.js, WebGPU, and Wasm describe different layers:

- **Three.js / Bevy / Godot / Babylon:** scene, asset, rendering and sometimes
  gameplay frameworks.
- **WebGL / WebGPU:** APIs through which the browser submits work to the GPU.
  Three's WebGL renderer already runs shaders on the GPU; it does not draw
  every pixel in JavaScript. On this Mac the WebGL baseline uses ANGLE Metal.
- **JavaScript / Wasm:** execution choices for CPU work. Wasm can accelerate
  suitable arithmetic and data-oriented simulation. It does not reduce the cost
  of the same fragment shader, shadow map, overdraw, or texture bandwidth.
- **A native application:** a different deployment target. A Wasm build in a
  browser still operates through browser APIs. Results from a native Metal or
  Vulkan executable cannot be substituted for mobile-browser measurements.

WebGPU enables compute and recorded render bundles, which can enable better
algorithms. Merely changing the API does not guarantee faster frames.
[Chrome's WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview)
describes these capabilities and the native abstraction layers.

Expected benefit depends on the bottleneck. A mostly idle garden already
suspends work, so there may be almost nothing to save. A GPU-bound high-DPR scene
needs fewer pixels, shadow samples, transparent layers or shader operations;
rewriting its CPU in Rust cannot supply that reduction. CPU-heavy draw submission
can benefit from retained commands, and sufficiently large simulation/buffer
kernels can benefit from Wasm or compute. The POC tests submission and one buffer
kernel; it does not establish which cost dominates users' real gardens.

## What is already in Gredice

The visual style is simple; the integration has substantial existing behavior.
An audit of `packages/game/src` excluding `.unit.*` and `.generated.*` files found:

| Area | Current evidence | Migration implication |
| --- | --- | --- |
| Three/R3F dependencies | 228 source files | Replacing the engine touches scene ownership, transforms, picking, animation and viewers |
| Custom material hooks | 25 files containing shader materials, `onBeforeCompile`, or custom-shader-material | Water, generated plants, weather, sky, ground effects and outlines need material work |
| Frame callbacks | 53 files with `useFrame` | Timing, visibility and cleanup behavior must survive the move |
| Renderer-specific assumptions | 12 files matching WebGL renderer/context access | Statistics, capture, render targets and recovery need adapters |
| Runtime assets | 146 GLBs | Reuse Blender/GLB assets; validate material and transform parity |

These are search-based exposure counts, **not** 228 files that must all be
rewritten. The 228 files contain about 87,396 lines in total, including unrelated
logic; this is not a count of rendering code to port.

Relevant existing implementation:

- [Scene](../packages/game/src/scene/Scene.tsx) owns R3F integration, shadows,
  quality, material providers, outlines and static-scene caching.
- [Retained scene compiler](../packages/game/src/scene/compiler/retainedGardenScene.ts)
  and [mesh buffer compiler](../packages/game/src/scene/compiler/meshBuffers.ts)
  already retain unchanged chunks and compile buffers. Large compiles already
  have a worker path; moving them to Wasm is not automatically a main-thread FPS win.
- [Scene root runtime](../packages/game/src/scene/sceneRootRuntime.ts) and
  [SceneTime](../packages/game/src/scene/SceneTime.tsx) own demand rendering,
  visibility suspension, springs, and 30 FPS ambient / 60 FPS interactive policy.
- [Quality profiles](../packages/game/src/scene/gameQuality.ts) already vary DPR,
  shadows, decorations and particles. The regular high tier uses DPR 2 and a
  4096² shadow map; the POC deliberately uses smaller fixed settings.
- [GameRuntimeProvider](../packages/game/src/GameRuntimeProvider.tsx) and the
  [2D wrapper](../packages/game/src/GardenOverview2DWrapper.tsx) show that HUD and
  product state can be shared across renderers. Preserve that investment.
- [Stack contracts](../packages/game/src/types/Stack.ts) already distinguish a
  plain `{x,y,z}` `GardenPosition` from the renderer's `Vector3`-based `Stack`.
  Prefer the plain form at an engine boundary.

## POC and measured results

The runnable [experiment](../packages/game/experiments/engine-migration/README.md)
is isolated under `packages/game/experiments/engine-migration`. No application
renderer, database, dependencies, or production settings were changed.

### Primary renderer comparison

36 runs: three repetitions × four scenes × three backends, with rotated order
and one active browser page. Environment: Apple M4 Pro, macOS arm64,
Chromium 151.0.7922.34 headless with hardware GPU, Node 24.15.0, Three 0.186.0.
The fixture is an esbuild production-minified standalone page, **not** a Next.js
production build or the full Gredice game.

All backends use the same shipped GLB geometry/materials, camera path, lighting,
resolution, population, and batching. Terrain uses the production compiler in
8×8 chunks; tree parts and garden-box bodies use instancing. MSAA is disabled
for all backends. Shadows, where enabled, use a 1024² PCF map. The new renderer
keeps its default half-float intermediate target and output-color pass.

Each run warms 90 frames, samples 240 frames, then collects 40 separate GPU
timings. GPU query recording is disabled during the main CPU/FPS measurement.
Numbers below are **medians of the three per-run medians**, in milliseconds per
render. Draw/triangle counts include shadow passes; WebGPU adds one output draw
and one fullscreen triangle.

| Workload | WebGL CPU | WebGPU CPU | New renderer's WebGL fallback CPU | WebGL GPU diagnostic | WebGPU GPU diagnostic |
| --- | ---: | ---: | ---: | ---: | ---: |
| 256 cells, 16 trees, 16 boxes; 960×640; shadows | 0.740 | 1.520 | 1.605 | 0.661 | 0.721 |
| 1,024 cells, 64 trees, 64 boxes; 1440×960; shadows | 1.050 | 1.625 | 1.095 | 1.711 | 1.901 |
| Same larger scene; 960×640; no shadows | 0.595 | 1.525 | 1.615 | 0.846 | 0.721 |
| Larger scene with batching disabled for all; 960×640; no shadows | 1.880 | 2.360 | 2.590 | 0.928 | 0.983 |

All 36 runs delivered **59.93–60.00 FPS**. This is a display/RAF-limited test:
it demonstrates adequate delivery here, not each renderer's maximum throughput.
Do not convert `1000 / CPU render time` into FPS; CPU/GPU/compositor work overlaps.

The first workload has 40 baseline draws / 84,416 submitted triangles. The large
shadowed scene has 160 / 337,664. Large without shadows has 80 / 168,832; the
unbatched diagnostic has 1,280 / 168,832. The stress case is **not** the current
game's baseline and is not used to inflate the apparent migration benefit.

CPU time varied across runs. For example, the large shadowed scene's WebGL
medians were 0.275–1.155 ms and WebGPU medians were 0.780–2.325 ms. The direction
reversed in one pairing. Treat these as local distributions, not precise
universal speed ratios. The small garden's medians were 0.740–0.780 ms versus
1.320–1.695 ms. There is no measured overall FPS improvement from the simple swap.

GPU diagnostics use different backend APIs: the WebGL elapsed query encloses the
render call, while Three's WebGPU API sums timed passes. They are supporting
diagnostics, not identical whole-frame GPU measurements. In the shadow-free
batched case WebGPU reported less GPU time, while submission cost increased.

Visual checks preserved scene population and source/shadow triangles, rejected
blank canvases, and recorded no browser errors or warnings. Across primary
screenshots, mean absolute RGB-channel difference was at most **0.275/255** and
only **0.0012%** of channels differed by more than 10/255. These checks establish
parity for this limited fixture, not for the game's custom materials.

### iPhone 14 emulation follow-up

The phone experiment is now runnable with `run.mjs --mobile`. The interactive
preview is <http://127.0.0.1:4179/?backend=webgl&device=iphone14> when the POC
server is running. It has a portrait canvas, touch orbit, pinch zoom, and links
for full or capped rendering resolution. Close live previews during measurements:
the standalone preview renders continuously, while automated cases use their
own frame loop. The captured campaign ran with no continuously rendering preview.

This campaign uses **desktop Chromium on the same M4 Pro**, with Playwright's
iPhone 14 descriptor: a 390×664 CSS browser viewport, 390×844 screen, DPR 3,
touch/mobile behavior and an iPhone user agent. The runner asserts those actual
browser values and the canvas backing resolution. Setting an iPhone user agent
does not change Chromium into Safari. The interactive preview URL alone changes
canvas dimensions/resolution; device emulation and CPU throttling are applied
by the runner, not by the preview page.

24 runs: three repetitions × four workloads × WebGL/WebGPU, with backend order
rotated across repetitions. Same 90-frame warm-up, 240 measured frames, separate
40-sample GPU diagnostic pass, batching, assets, lighting and 1024² shadows as
the desktop fixture. No network throttle. CPU slowdown is applied before loading
the page. These are within-campaign comparisons; do not subtract them from the
earlier desktop campaign. DPR 3 is a native-resolution stress case, not a claim
about the full game's automatic quality/DPR selection on an iPhone.

| Phone viewport workload | Render backing pixels | Host CPU slowdown | WebGL CPU median | WebGPU CPU median |
| --- | --- | ---: | ---: | ---: |
| 256 cells | 1170×1992 (DPR 3) | 1× | 0.250 ms | 0.960 ms |
| 256 cells | 1170×1992 (DPR 3) | 4× | 0.700 ms | 1.615 ms |
| 1,024 cells | 1170×1992 (DPR 3) | 4× | 1.085 ms | 2.850 ms |
| 1,024 cells | 585×996 (render DPR 1.5) | 4× | 1.125 ms | 3.075 ms |

Numbers are medians of three per-run medians. All runs delivered
**59.95–60.01 FPS**, so this still shows no FPS benefit from switching renderers.
For the large scene at full resolution, median per-run CPU p95 was 1.580 ms for
WebGL and 3.685 ms for WebGPU. Capping render DPR from 3 to 1.5 reduces main-view
pixel count by 75%; it does not reduce geometry or fixed shadow-map size, and
did not improve delivered FPS on this host. GPU diagnostics varied considerably;
they do not support a precise phone GPU speedup claim.

All 12 matched screenshot pairs passed. Maximum mean RGB-channel difference was
0.108/255; at most 0.00066% of channels differed by more than 10/255. Geometry,
population and device-profile assertions passed, with no browser warnings/errors.

**These are not measured or predicted iPhone 14 frame rates.** A 4× CPU slowdown
is relative to the M4 Pro, not calibrated to an A15. The GPU is still the Mac's
Metal GPU. This does not reproduce iOS Safari, GPU/memory bandwidth, thermal
limits, battery drain or the full game's workload. The distinction follows
[Playwright's emulation scope](https://playwright.dev/docs/emulation) and
[Chrome's device-mode limitations](https://developer.chrome.com/docs/devtools/device-mode#limitations).
A physical iPhone Safari run remains necessary for a migration performance
decision; the emulation is useful for layout/input checks and controlled stress.

[Retained mobile results](../packages/game/experiments/engine-migration/mobile-results-2026-09-26.json)
contain the device descriptor, actual browser/GPU details, requested CPU slowdown,
per-run distributions, hashes and image comparisons. Full samples, screenshots,
and exact source/bundle snapshots are under the experiment's
`.output/2026-09-26T11-45-43-965Z/`. Raw JSON SHA-256:
`93b5eae530874e0aa5e28227d712dd5990a5bc057361cd7208131545b61994ca`.
After capture, responsive canvas sizing was expressed without CSS `!important`
and the original continuous interactive preview was restored for WebKit captures.
The automated sampling loop is unchanged. `--mobile --quick` passed again;
that smoke run is not a statistical input.

Input checks sent actual emulated touch sequences through Chromium CDP. Drag and
pinch visibly changed both backends without scrolling or browser page zoom;
renderer navigation retained the phone preset, the resolution cap took effect,
and returning to Desktop reset render DPR. Node syntax and scoped Biome checks
passed. The preview was also visually checked with `agent-browser`.

A separate desktop WebKit 26.5 compatibility probe exposed unreliable captures
of an idle WebGPU canvas. Some probes recovered on another capture or explicit
frame, but extra initialization RAFs/GPU waits did not reliably fix it and were
not retained. The interactive fixture keeps its original continuous preview;
the final live-preview probe captured both backends twice without page or
console errors. Automated performance tests still run only on Chromium. This capture behavior
is a limitation, not a WebKit performance result or proof of iOS compatibility.
Raw validation and screenshots are in `.output/`, with the observations retained
in the mobile JSON's supplemental validation.

### WebGPU render-bundle follow-up

A second, separate campaign ran 18 tests: three repetitions × two workloads ×
WebGL, ordinary WebGPU, and WebGPU with a static `BundleGroup`. It reuses the same
scene content, keeps lights outside the group, and tests a changed camera pose.
Render bundles replay recorded GPU commands; Three provides them through
[BundleGroup](https://threejs.org/docs/pages/BundleGroup.html), so exploiting this
feature does not require leaving Three.

| Workload, no shadows | WebGL CPU median | Ordinary WebGPU CPU median | Bundled WebGPU CPU median |
| --- | ---: | ---: | ---: |
| 1,024-cell batched garden, 80 baseline draws | 0.155 ms | 0.985 ms | 0.620 ms |
| Same scene unbatched, 1,280 baseline draws | 0.820 ms | 2.270 ms | 0.515 ms |

These are medians of run medians. Compare within this campaign, not against the
earlier campaign's absolute numbers: host/JIT scheduling variability is material.
In the unbatched stress case, bundles reduced median submission cost by about
37% relative to WebGL and 77% relative to ordinary WebGPU. Each paired run showed
a median reduction, but the paired WebGL-relative reduction ranged from 13% to
81%. **Tail performance did not consistently improve:** the median of run-level
CPU p95 values was 2.00 ms with bundles versus 0.95 ms with WebGL. All backends
still delivered about 60 FPS. This is a promising mechanism, not a production win.

For the already batched scene, WebGL remained cheaper in all three pairs. Moving
the existing retained chunks into GPU bundles is therefore a sensible optional
experiment if actual-game profiling finds submission overhead; it does not by
itself justify an engine rewrite.

Three's current `renderer.info` omits draws replayed from bundles and reports
only the one-triangle output pass in these shadow-free bundle runs. We retain
that raw observation but **do not claim the scene became one triangle**. Source
geometry/population and screenshot parity establish the rendered content. At
the alternate camera pose, maximum mean channel error was 0.235/255 and at most
0.00066% of channels differed by more than 10/255. There were no console errors
or warnings.

A separate **shadowed** bundle probe subsequently failed pixel parity: shadows
were visibly displaced after camera movement. This has not been fixed or
attributed to a general upstream defect; it is a limitation of this POC path.
The interactive bundle option and its benchmark now explicitly require
`shadows=0`. The successful 18-run campaign already had shadows disabled for
every backend, so its comparison remains valid. The failure is evidence against
calling this a drop-in production upgrade. Its screenshots/raw observations are
preserved in `.output/2026-09-26T10-52-21-768Z/`.

[Retained bundle results](../packages/game/experiments/engine-migration/bundle-results-2026-09-26.json)
include the per-run distributions and metadata. Raw data/screenshots/source are
in `.output/2026-09-26T10-48-44-031Z/` under the experiment directory; raw JSON
SHA-256 is `8f792736341d6ea0420bf4b69d83f48f16d00eefba8438bf0a9540f960862c20`.
An earlier incomplete campaign exposed an assertion bug when a bundle run was
first in the rotated order; it is excluded. The final campaign uses the WebGL
run as its reference independent of execution order and completed all 18 runs.

### WebAssembly CPU experiment

The actual Wasm module transforms the shipped grass geometry's 24 positions for
multiple instances. Both implementations use f64 arithmetic, f32 input/output,
the same matrices, perspective divide, and reused buffers. All measured outputs
matched the production mesh compiler exactly (`maxError = 0`). Three independent
browser runs each include 60 timing batches per size, after warm-up, with rotating
JS / resident-Wasm / copying-Wasm order.

| Instances | JS, ms | Wasm with resident buffers, ms | Wasm including copies, ms | Copy-inclusive saving |
| --- | ---: | ---: | ---: | ---: |
| 8 | 0.000420 | 0.000425 | 0.000474 | Slightly slower |
| 64 | 0.005293 | 0.003379 | 0.003613 | 0.00168 ms / 32% |
| 256 | 0.023438 | 0.013594 | 0.014844 | 0.00859 ms / 37% |
| 4,096 | 0.376250 | 0.220000 | 0.242500 | 0.13375 ms / 36% |

The larger copy-inclusive operations are about **1.46–1.58× faster**, but the
absolute savings are small. This kernel is not the whole compiler: normals,
tangents, attributes, indices, bounds, allocation and worker integration are not
ported or timed. The production code only recompiles dirty geometry. These
numbers therefore do **not** imply a 36% faster game or even a 36% faster complete
chunk compile. The 312-byte module is a numeric kernel, not an engine payload.

As an illustrative upper-bound calculation, if 20% of a serial CPU workload
could become 1.55× faster, total speedup would be
`1 / (0.8 + 0.2 / 1.55) = 1.076`, about 7.6%. If that work is off the frame's
critical path, visible FPS may not change. Neither the 20% share nor a full-game
7.6% benefit has been measured here. Bulk calls and careful memory boundaries
matter; see [WebAssembly performance patterns](https://web.dev/articles/webassembly-performance-patterns-for-web-apps).

### Evidence and limits

- [Primary retained results](../packages/game/experiments/engine-migration/results-2026-09-26.json)
  contain per-run statistics, source/bundle/asset hashes, browser/GPU metadata,
  screenshot differences and CPU parity results.
- Full raw samples and screenshots are local under
  `packages/game/experiments/engine-migration/.output/2026-09-26T10-39-41-185Z/`.
  Raw JSON SHA-256: `bc6344e01a09af408a151094e862fb102bf677b8d7bf2c715044915dc56acdea`.
  The exact original harness source and bundle are preserved in its `sources/`
  directory. Earlier quick runs are harness diagnostics, not comparison inputs.
- The combined comparison bundle is 1,228,941 bytes / 328,258 bytes gzip. It
  includes **both renderers** and test code, so this is not a production migration
  download-size delta. Local ready times include initialization/asset parsing and
  compilation but exclude module download/evaluation before `main`; browser/GPU
  caches are not cold. They are not mobile startup forecasts.
- No physical Android/iPhone tests, sustained thermal/battery tests, native
  builds, Bevy/Godot ports, or full-game bottleneck profiles were performed.
  The fixture excludes R3F/HUD, procedural plants, water, weather, animals,
  picking, placement, cache, screenshots and the production frame scheduler.
- Raw `performance.memory` values are JS heap observations, not GPU VRAM or
  total process memory; no memory-saving claim follows from them.

Final validation: both `run.mjs --quick` and `run.mjs --quick --bundles` passed
after adding the explicit bundle/shadow restriction, direct adapter metadata and
automatic source snapshots. The quick runs are smoke checks, not additional
statistical comparison inputs. Direct WebGPU device readback reported vendor
`apple`, architecture `metal-3`, corroborating hardware rather than software
WebGPU on this host. Node syntax checks and scoped Biome checks passed; report,
source-snapshot and bundle hashes were revalidated for both full campaigns.
Application builds/full suites were not run because application/runtime source
and dependencies were unchanged; the standalone production bundle and browser
benchmark exercise the changed experiment itself.

The interactive demo was also checked with `agent-browser` 0.38.1: all four
renderer links reached their intended backends, the bundle link selected its
supported shadow-free configuration, and pointer orbit plus wheel zoom changed
the visible canvas. No page errors were reported. Interactive screenshots remain
in the experiment's `.output/` directory. The experiment's local Biome config
excludes generated bundles and captures from package linting.

## Engine choices

| Path | What can be reused | What changes | Assessment |
| --- | --- | --- | --- |
| Current Three + focused optimizations | Everything | Only measured hotspots | Best current cost/benefit |
| Three WebGPURenderer / TSL | React, R3F, most geometry, data, controls, assets | Async renderer init, custom materials, targets, capture, statistics and fallback validation | Lowest-risk WebGPU path; default swap was not faster in the POC |
| Targeted Rust/C/Wasm module | Whole app and Three renderer | A bulk algorithm plus build, memory and worker boundary | Good only when the measured CPU cost warrants it |
| Babylon.js / PlayCanvas WebGPU | GLBs, React product UI, APIs; some plain JS logic | Scene, materials, picking, animation and lifecycle | Still JS engines; substantial port with no measured benefit yet |
| Bevy (Rust + Wasm + WebGPU) | GLBs, server contracts, external React UI | Scene/runtime logic, shaders, asset handling and a typed JS/Wasm bridge | Credible native-engine route; much larger rewrite, benefit unmeasured |
| Godot web export | GLBs, backend; possibly React shell | Engine/gameplay integration, materials and input bridge | Its stable docs still specify WebGL2, so it does not meet a WebGPU migration goal today |

[Three's renderer docs](https://threejs.org/docs/pages/WebGPURenderer.html) confirm
WebGPU with WebGL2 fallback. [R3F's Canvas documentation](https://github.com/pmndrs/react-three-fiber/blob/master/docs/API/canvas.mdx)
supports async renderer factories, so React does not need replacing. However,
[Material.onBeforeCompile](https://threejs.org/docs/pages/Material.html#onBeforeCompile)
is WebGLRenderer-only; custom hooks need Node Materials / TSL rather than being
silently ignored. The new renderer's WebGL fallback also uses that new material
path: it does not make old GLSL hooks compatible.

[Bevy's current feature documentation](https://docs.rs/bevy/latest/bevy/)
supports Wasm/WebGPU, but enabling `webgpu` overrides `webgl2`; plan explicit
separate artifacts and capability-based loading rather than assuming automatic
fallback. [Godot's stable web-export docs](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
say web export uses WebGL2 Compatibility and does not support WebGPU. Godot can
still be a native-app/editor decision, independently of browser performance.
[Babylon's specifications](https://www.babylonjs.com/specifications/) list WebGPU
support; its [snapshot rendering](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU/webGPUOptimization/webGPUSnapshotRendering.md)
is relevant to static scenes, but it has not been benchmarked against Gredice here.

Browser coverage has improved: Chrome's documentation records Safari 26,
Firefox support on specified platforms, and Android support on supported
OS/GPU combinations. That does not imply every installed browser, Android
WebView, older iPhone, or graphics adapter supports it. Use actual adapter
detection and keep a working WebGL/2D route. Benchmark real target devices.

## Effort with AI implementation

These are planning estimates, not measured delivery promises. Assume **one
experienced engineer using AI throughout**, roughly one working day of focused
engineering/review, reuse of GLBs and the React HUD/backend, and no product
redesign. Include tests and integration debugging. Browser/device QA is included;
app-store releases and a redesigned native UI are not. Confidence is medium for
the incremental path and low for a full engine port; discovery can move these
ranges by roughly 50%.

| Deliverable | Estimated engineering days | Scope |
| --- | ---: | --- |
| Full-game profiling on representative phones and next decision | 2–4 | Identify CPU/GPU/thermal/cold-load bottlenecks and rank fixes |
| One production Wasm hotspot | 3–7 | Bulk buffer contract, compiler/build, worker/fallback, parity and target-device proof |
| WebGPU vertical slice in the actual game | 3–6 | One isolated garden with camera, picking and basic placement; limited effects |
| Three WebGPU production parity | 15–30 (3–6 working weeks) | All relevant material families, capture/outline/cache/lifecycle, device coverage and fallback |
| Alternative JS engine production parity | 25–45 (5–9 weeks) | Scene/runtime port while retaining the React product layer |
| Bevy playable slice | 5–10 | Asset loading, terrain/props, camera, selection, local placement and React bridge |
| Bevy production parity | 45–80 (9–16 weeks) | Full current 3D behavior and integration, not just the POC scene |
| Godot production parity | 40–75 (8–15 weeks) | WebGL2 web export and/or separately scoped native targets |

For the Three WebGPU path, an indicative breakdown is 2–4 days for renderer and
capability adapters, 6–12 for shader families, 3–6 for outlines/cache/capture and
runtime lifecycle, and 4–8 for integration and real-device acceptance. Some work
overlaps; budget 15–30 days overall. A Bevy port adds 5–8 days for the data/input
bridge, 8–15 for scene/assets/chunks, 15–25 for behavior/material parity, 7–12 for
product integration and 10–20 for hardening/acceptance: 45–80 days overall.

AI helps with mechanical ports, shader translations, adapters, test fixtures and
debugging iterations. It does not remove the need to verify touch placement,
visual parity, resource lifetimes, garden switching, device loss, startup and
thermal behavior. A simplified new garden demo could take days; that is a
different deliverable from preserving today's game.

## Suggested migration boundary and decision gate

Keep authentication, purchases, inventory, persistence, query state, modals and
accessible HUD in the existing React/API layer. Feed a renderer immutable,
renderer-neutral garden snapshots/deltas and asset IDs. Send events such as
`selectBlock`, `previewPlacement`, `commitPlacement`, and camera changes back to
the existing application handlers. Preserve authoritative server placement and
optimistic reconciliation; an engine must not become the commerce authority.

For Wasm, cross the boundary in bulk typed arrays or coarse commands. Do not
marshal thousands of per-entity React updates into Wasm each frame. Reuse the
retained chunk invalidation model and keep static, articulated, and roaming
entities separate. Preserve hidden/offscreen suspension and 2D fallback.

Before authorizing a full port, require an actual-game vertical slice that:

1. Uses the same source snapshot, assets, camera, visual features, shadow/DPR
   policy and input sequence as the baseline.
2. Demonstrates a worthwhile improvement on at least two representative phones,
   including the slow class that motivated the migration. A proposed target is
   at least 20% better p95 busy-frame time with no material cold-load or memory
   regression; this is a future decision threshold, not an observed result.
3. Preserves visual capture, placement/picking, garden switching and lifecycle
   behavior using the existing [production profiler](game-scene-performance.md)
   and additional backend-appropriate instrumentation.
4. Runs sustained sessions to evaluate thermal degradation and battery impact,
   with unsupported-device and device-loss fallbacks exercised.

If those gates do not pass, retain Three/WebGL and ship the smaller fixes that
the profile supports. A full native-engine port should have a separate product
reason, such as native distribution or substantially richer simulation, in
addition to an unverified expectation of faster rendering.
