# Renderer / WebAssembly experiment

An isolated, local experiment. It does not replace the application renderer or
change persisted gardens. See [the investigation](../../../../docs/game-engine-migration-investigation.md)
for findings, limitations, current engine options, and an AI-assisted effort estimate.

## Run

From the repository root, after the normal pinned `pnpm install`:

```bash
# One short validation round; not enough evidence for a performance conclusion.
node packages/game/experiments/engine-migration/run.mjs --quick

# Full matched comparison: 3 repetitions × 4 workloads × 3 backends.
node packages/game/experiments/engine-migration/run.mjs

# Focused WebGPU render-bundle comparison: 3 repeats × 2 workloads × 3 backends.
node packages/game/experiments/engine-migration/run.mjs --bundles

# iPhone 14 emulation: 3 repeats × 4 workloads × WebGL/WebGPU (24 runs).
node packages/game/experiments/engine-migration/run.mjs --mobile

# Short mobile setup/visual-parity validation (2 runs).
node packages/game/experiments/engine-migration/run.mjs --mobile --quick

# macOS: the same comparison with sleep prevention / application scheduling.
caffeinate -du taskpolicy -a node packages/game/experiments/engine-migration/run.mjs

# Interactive scene, renderer/device links, touch orbit, pinch/wheel zoom.
node packages/game/experiments/engine-migration/run.mjs --serve
```

Open <http://127.0.0.1:4179>. Optional query parameters: `side=32`, `dpr=1.5`,
`shadows=0`, `layout=individual`, `device=iphone14`, and
`backend=webgl|webgpu|webgpu-gl|webgpu-bundle`.
Use `POC_PORT` to change the server port, `POC_REPEATS` to change repetitions,
or `--headed` to run the benchmark in a visible browser.

Open <http://127.0.0.1:4179/?backend=webgl&device=iphone14> for the phone
preview. It uses a 390×664 CSS-pixel canvas at render DPR 3 (1170×1992 backing
pixels). The 1.5× link reduces backing pixels to 585×996. Renderer links preserve
the chosen device/settings. Close live previews while measuring; the standalone
preview renders continuously, and the automated runner owns a separate frame loop.
The preview URL changes canvas dimensions/resolution; it does **not** emulate
the browser user agent or throttle the CPU. `--mobile` performs that separate test.

The mobile runner applies Playwright's installed iPhone 14 descriptor: 390×664
browser viewport, 390×844 screen, device DPR 3, mobile viewport behavior, touch
and an iPhone user agent. **The engine is still desktop Chromium**, explicitly
recorded in the results. It tests a 256-cell garden at host speed and 4× CPU
slowdown, then a 1,024-cell garden at 4× slowdown with render DPR 3 and 1.5.
All four cases have the same 1024² shadows and batching; browser DPR stays 3 even
when render DPR is capped. Throttling is applied before navigation through CDP.
The runner asserts actual viewport, screen, touch capability, DPR and backing
resolution, in addition to the existing geometry and image checks.

The 4× factor is relative to this host, **not an A15 calibration**. GPU, memory
bandwidth, Safari/iOS behavior, network, battery and thermal constraints are not
emulated. Use this to compare controlled workloads and input/layout behavior;
do not label these results iPhone FPS. `--mobile` and `--bundles` are separate
campaigns. See [Playwright emulation](https://playwright.dev/docs/emulation) and
[Chrome's emulation limits](https://developer.chrome.com/docs/devtools/device-mode#limitations).

Requires Node >=24, the repository's pnpm version, and the Garden Playwright
Chromium installation (`pnpm --filter garden exec playwright install chromium`
if missing). Uses the existing Three, esbuild (via tsx), Playwright and Sharp
dependencies. The runner downloads the pinned `wabt@1.0.39` compiler through
`pnpm dlx`; it adds no dependency to the application. `transform.wat` is the
reviewable WebAssembly source, compiled to `.output/transform.wasm`.

## What is measured

- Three 0.186.0 `WebGLRenderer`, `WebGPURenderer` with the actual WebGPU backend,
  and `WebGPURenderer` with its explicit WebGL2 fallback. A requested WebGPU run
  fails if it falls back silently.
- Shipped `BlockGrass`, `Tree`, and `GardenBox` GLBs; selected production mesh
  parts and materials. Terrain uses the production mesh-buffer compiler in 8×8
  retained chunks. Props are instanced by part and chunk. The separate
  `individual` stress case deliberately disables batching for **all** backends.
- Desktop: fixed 960×640 CSS canvas, DPR 1 or 1.5; mobile: 390×664, DPR 3 or 1.5.
  No MSAA, orthographic moving camera,
  matching lighting, ACES tone mapping and sRGB output. Shadow cases use a 1024²
  PCF map. The WebGPU renderer retains its default half-float intermediate target;
  its additional output-color pass is part of its measured cost.
- 90 warm-up frames then 240 measured frames. Main results are CPU render-call
  duration and delivered RAF frame cadence, not inferred unlimited FPS. GPU
  timestamps are disabled during this pass. Forty GPU samples are collected
  separately using WebGL disjoint timer queries or Three's timestamp API.
- Browser contexts are fresh, only one page is active, and backend order rotates
  across repetitions. Browser console errors, blank canvases, population or
  scene/shadow triangle-count mismatches fail the run. The new renderer's
  documented one-triangle output pass is accounted for in the count comparison.
- Screenshots are captured at the same camera pose; numeric pixel differences
  are recorded. The current runner rejects images where more than 0.1% of RGB
  channels differ by more than 10/255. Inspect them before asserting visual parity.
- `--bundles` uses Three's static `BundleGroup` around the same renderables,
  with lights outside the group. Its replayed draws are missing from Three's
  current `renderer.info` counters (the reported 1 draw / 1 triangle is only the
  output pass). These counters are retained as reported, never presented as a
  geometry reduction. Source geometry/population parity and pixel comparisons
  at a changed camera angle validate this path; the normal backend pair still
  checks submitted triangles. Bundle runs must be compared within their own
  campaign, not subtracted from older runs with a different harness or host load.
  This path is restricted to `shadows=0`: a separate shadowed camera-motion
  probe produced displaced shadows and failed visual parity. Requesting shadows
  with the bundle backend shows an explicit error instead of presenting a
  misleading performance comparison. `--quick --bundles` validates the supported
  shadow-free case.
- A separate position-transform kernel uses f32 input/output and f64 arithmetic
  in both JavaScript and Wasm, including the homogeneous divide. Output is also
  compared against the production `compileMeshBuffers` result. Timing rotates
  JS, Wasm with resident memory, and Wasm including input/output copies; all use
  reused output buffers. No allocation, SIMD, worker, or threads are timed.

The server binds to loopback and serves only an explicit file allowlist. Local
COOP/COEP headers provide a higher-resolution timing clock; they are not a
proposal to change production headers. No accounts, API calls, or private data
are required. Build products, complete raw JSON and screenshots stay in ignored
`.output/<timestamp>/`. The small retained results summary is an intentional
measurement artifact, not application build output.

## Boundaries

This is a production-minified **standalone renderer slice**, not a production
Next.js game benchmark. It does not include React/R3F, HUD, network/storage,
generated plants, weather, animated fauna, water, outline/capture passes, dynamic
garden edits, or the production scheduler/cache. It continuously renders at the
browser cadence; the real game has demand rendering and frame-rate policies.

The Wasm kernel is a numeric feasibility experiment, **not a Wasm game engine**,
nor a full port of the mesh compiler (normal/tangent transforms, arbitrary
attributes, indices, bounds, and worker integration remain in TypeScript).
Bevy, Godot, and native application builds are researched, not benchmarked here.
GPU timers have different pass coverage, JS heap is not total process/GPU memory,
and local initialization is not a mobile cold-network load test. Mobile frame
delivery, thermal behavior, battery use, native-engine speedups, and full-game
performance require separate matched tests.
