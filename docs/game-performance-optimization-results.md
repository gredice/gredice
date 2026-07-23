# Garden performance optimization results

This document tracks the mobile garden performance work requested after users
reported device overheating. The visual contract is explicit: falling rain,
falling snow, moving clouds, plant motion, and other ambient animation remain
available. Quality adaptation may reduce cadence, density, resolution, or
secondary surface detail, but it must not remove the atmosphere.

## Measurement method

- Production `apps/garden` build served through the repository profiler.
- Chromium mobile context: `390x844`, device pixel ratio `3`; the medium game
  profile caps the backing canvas at DPR `1.5`.
- Warmup `5,000 ms`, sample `5,000 ms` unless a row says otherwise.
- `Browser FPS` measures browser `requestAnimationFrame` callbacks.
- `Rendered FPS` counts browser ticks that submitted WebGL draw calls.
- Calls and triangles per second are the primary energy-workload comparisons
  once demand rendering changes renderer cadence.
- Headless Chromium reports `ReadPixels` GPU stalls on this machine. Absolute
  FPS is therefore directional; before/after deltas use the same build and
  profiler configuration.
- Raw local reports are kept under
  `apps/garden/test-results/game-profile/steps/` and are intentionally ignored
  by Git.

Physical-device thermal validation is still required before release. Use at
least one mid-range iPhone and one mid-range Android device for a 10-minute
full-garden clear/rain/snow soak.

## Baseline

Report: `steps/00-baseline/latest.json`, generated 2026-07-22 from `80b2ae267`.

| Scenario | Browser FPS | Rendered FPS | p95 frame | Calls/s | Calls/render | Triangles/s | Heap | Long tasks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Default mobile | 19.6 | 19.8 | 62.5 ms | 792.3 | 40.0 | 51,896 | 45.2 MB | 70 |
| Default rain mobile | 14.7 | 14.8 | 81.8 ms | 1,250.8 | 84.2 | 98,126 | 42.6 MB | 74 |
| Default snow mobile | 13.2 | 13.4 | 84.7 ms | 1,281.8 | 95.5 | 114,380 | 51.0 MB | 67 |
| Dense mobile | 6.4 | 6.6 | 172.0 ms | 383.3 | 58.0 | 62,918 | 57.5 MB | 33 |
| Dense camera motion mobile | 5.9 | 6.1 | 272.8 ms | 321.2 | 52.7 | 58,995 | 168.8 MB | 31 |
| Dense rain mobile | 4.9 | 5.1 | 194.3 ms | 1,624.9 | 318.0 | 196,362 | 57.5 MB | 26 |
| Dense snow mobile | 9.7 | 9.9 | 111.2 ms | 2,780.8 | 280.0 | 604,509 | 54.2 MB | 50 |
| Dense cloudy mobile | 5.7 | 5.9 | 188.9 ms | 1,895.0 | 320.0 | 211,923 | 45.2 MB | 30 |
| Dense windy mobile | 6.0 | 6.2 | 176.5 ms | 1,954.0 | 316.0 | 221,212 | 40.1 MB | 32 |
| Plant-heavy mobile | 7.4 | 7.6 | 164.4 ms | 287.3 | 38.0 | 63,508 | 110.6 MB | 36 |
| Plant viewer desktop | 3.4 | 3.6 | 317.4 ms | 609.2 | 169.8 | 159,861 | 242.2 MB | 17 |

## Implementation log

Each runtime row is profiled immediately after it lands so its result is
attributable. Later rows are cumulative and should be compared with both the
baseline and the preceding row.

| Step | Optimization | Status | Target profile | Result |
| ---: | --- | --- | --- | --- |
| 00 | Dense-mobile, targeted, soak, and rendered-frame profiler support | Complete | Core + dense-mobile | Baseline above |
| 01 | Stop generated-plant batch render/effect churn | Complete | Plant-heavy mobile + plant viewer | Frame time neutral; heap `242.2 -> 214.6 MB` in the plant viewer and `110.6 -> 92.9 MB` in plant-heavy mobile |
| 02 | Demand-based cadence scheduler and hidden/offscreen suspension | Complete | Default, camera motion, rain, snow | Desktop default work/s `-22%`; mobile default p95 `-20%`; overloaded weather/dense scenes mostly neutral |
| 03 | End finite weather blends and eliminate idle environment work | Complete | Clear, rain, snow, cloudy | Steady-state neutral; transitions now snap to zero and clear weather removes all cloud slots/frame work |
| 04 | Make automatic quality constrained-device aware | Complete | Deterministic medium-vs-auto dense mobile A/B | Auto rendered FPS `+81%` to `+102%`, p95 `-36%` to `-46%`; weather and shadows retained |
| 05 | Remove redundant cloud-shadow invalidations | Complete | Clear/cloudy transition pair | Shadow invalidations `22 -> 1` and `47 -> 1`; calls/s `-5%` and `-23%` |
| 06 | Reduce steady cloud-shadow refresh cadence | Complete | Transition + dense cloudy/windy | Transition calls/s `-5%` to `-7%`; all 7–8 clouds/casters retained |
| 07 | Bypass full L-system work for billboard plant LODs | Complete | Far plant viewer + plant-heavy mobile | Far cache writes `6,168 -> 0`, script time `-68%`, heap `-17%`; frame time neutral |
| 08 | Bound and instrument the generated-plant symbol cache | Complete | Plant viewer + plant-heavy mobile + 10k unit churn | Viewer capped at 16 MiB/3,583 entries with 2,585 evictions; no oversize skips |
| 09 | Stabilize snow buffers and simplify the rain fragment shader | Complete | Rain/snow + dense rain/snow | Dense rain rendered FPS `+15%`, script time `-67%`; snow keeps one capacity buffer with unchanged per-frame geometry work |
| 10 | Share weather-surface uniforms and skip inactive wet materials | Complete | Rain/snow + dense rain/snow | Active snow materials compressed `11 -> 6` and `14 -> 6` uniforms; snow p95 `-1%` to `-2%` with visual passes unchanged |
| 11 | Centralize dense-garden block indexes and instance selection | Complete | Dense + camera motion | Camera canvas-ready `-5.5%`, script time `-2.7%`, p95 `-2.6%`; static dense task time `-4.0%` |
| 12 | Make sky astronomy and projection event-driven | Complete | Clear + dense cloudy mobile | Clear p95 `-23%`, task time `-5.6%`; dense cloudy neutral with all eight clouds/casters retained |
| 13 | Crop unused decoration-atlas page rows | Complete | Dense mobile + renderer memory + screenshots | Estimated mipmapped RGBA8 residency `42.7 -> 32.0 MiB` (`-25%`); all 914 decorations and render work retained |
| 14 | Fade rain intensity and stop invisible transition-tail particles | Complete | Clear + rain-to-clear mobile | Rain unmounted `49%` sooner; transition calls/s `-3.2%` and triangles/s `-5.5%`; steady clear render work unchanged |
| 15 | Repack small decoration sprites into one 1024px atlas | Complete | Atlas manifest + decoded residency + generated file sizes | One page replaces two; estimated mipmapped RGBA8 residency `32.0 -> 5.3 MiB` (`-83.3%`) with all 22 sprite IDs retained |

### Step 01: generated-plant batch effect

Report: `steps/01-plant-loop/latest.json`.

- Plant viewer: rendered FPS `3.6 -> 3.6`, p95 `317.4 -> 316.4 ms`,
  heap `242.2 -> 214.6 MB`, long tasks `17 -> 17`.
- Plant-heavy mobile: rendered FPS `7.6 -> 7.2`, p95
  `164.4 -> 166.4 ms`, calls/s `287.3 -> 273.7`, heap
  `110.6 -> 92.9 MB`, long tasks `36 -> 36`.
- Interpretation: the loop fix removed unnecessary state/request churn and
  reduced retained heap in both targeted runs, but rendering and plant geometry
  remain the dominant frame-time bottlenecks. The next plant-specific gain must
  come from bypassing full L-system work for billboard LODs.

### Step 02: demand-render cadence scheduler

Report: `steps/02-frame-scheduler/latest.json`.

- Default desktop: rendered FPS `31.3 -> 24.4`, p95
  `46.2 -> 29.0 ms`, calls/s `1,253.8 -> 975.0`, and triangles/s
  `82,124 -> 63,862`. The browser callback rate recovered from
  `31.1 -> 56.3 FPS` because less GPU work blocked the main loop.
- Default mobile: rendered FPS `19.8 -> 18.1`, p95
  `62.5 -> 50.2 ms`, calls/s `792.3 -> 724.0`, and triangles/s
  `51,896 -> 47,423`.
- Rain, snow, and dense camera motion were already slower than the ambient
  30 FPS target. Their renderer work changed by roughly `-3%` to `-6%`, while
  p95 movement was mixed and within the noisy headless range.
- Interpretation: the scheduler removes about `22%` of submitted work in the
  unconstrained default scene, raises camera interaction to 60 FPS, and stops
  the loop while the page or canvas is not visible. It cannot improve scenes
  that are already GPU-bound below 30 FPS; the following steps target their
  per-render weather, plant, and entity cost.

### Step 03: finite weather and clear-cloud idle work

Report: `steps/03-finite-weather/latest.json`.

- The steady default, rain, snow, and dense-cloudy samples remained within the
  run-to-run headless range: rendered FPS moved between `-0.8%` and `+8.3%`
  relative to the immediately preceding comparable report, with mixed p95.
- This is expected for steady weather: the optimized path changes the end of a
  transition. Unit coverage proves that blends now reach the exact target and
  release their render lease instead of stalling roughly 1–2% away.
- A transition to clear now reaches exact rain/snow zero, allowing particle
  systems to unmount. Cloud slots retain their fade-out, then the clear scene
  reports `cloudVisualCount = 0`, releases the cloud lease, unmounts all eight
  slots, and skips its frame callback body.

### Step 04: constrained automatic quality

Reports: `steps/04-auto-quality-before/latest.json` and
`steps/04-auto-quality-after/latest.json`.

- The before run proves constrained `auto` was identical to manual medium:
  DPR `1.5`, 2048 shadow map, 1,400 heavy-rain particles, and 2,100 snow
  particles.
- Automatic quality on the deterministic constrained phone now uses DPR `1`,
  a 1024 shadow map, 1,000 rain particles, and 1,575 snow particles. Shadows
  remain enabled and cloudy scenes still report all eight moving clouds.
- Against adjacent manual-medium samples in the same after build:

| Dense mobile scenario | Medium rendered FPS | Auto rendered FPS | Medium p95 | Auto p95 |
| --- | ---: | ---: | ---: | ---: |
| Clear | 6.4 | 12.5 | 168.8 ms | 95.1 ms |
| Rain | 5.5 | 10.2 | 208.6 ms | 112.4 ms |
| Snow | 9.4 | 17.0 | 117.9 ms | 75.2 ms |
| Cloudy | 5.9 | 11.9 | 183.5 ms | 103.9 ms |

- The backing canvas drops from `585x1266` to `390x844`, 56% fewer pixels.
  Even after the faster scene renders more frames, canvas pixel-frames per
  second fall by roughly 10–20% across the four pairs; shadow texels per
  refresh fall by 75%. Draw calls/s rise because the previously blocked scene
  completes more frames, not because each frame contains more objects.
- Standard desktop automatic quality still resolves to medium. Manual and
  custom selections ignore device classification.

### Step 05: shadow invalidation separation

Reports: `steps/05-shadow-invalidation-before/latest.json` and
`steps/05-shadow-invalidation-after/latest.json`.

- Clear to cloudy: shadow invalidations `22 -> 1`, calls/s
  `1,119.5 -> 1,061.3`, triangles/s `53,717 -> 49,436`, and p95
  `68.9 -> 68.1 ms`.
- Cloudy to clear: shadow invalidations `47 -> 1`, calls/s
  `1,004.9 -> 776.6`, triangles/s `59,513 -> 43,006`; p95 moved
  `67.2 -> 72.1 ms` in the noisy headless sample.
- Light color, intensity, weather opacity, and timestamps no longer restart a
  900 ms every-frame shadow settle. Real garden/view/caster changes retain the
  settle path. Starting or stopping dynamic cloud shadows requests one update,
  so the final fading shadow is still cleared.

### Step 06: cloud-shadow refresh cadence

Report: `steps/06-shadow-cadence/latest.json`. The immediately preceding
Step 05 after-report is the transition reference.

- Hard cloud shadows refresh every `160 ms` instead of `96 ms`; soft shadows
  refresh every `96 ms` instead of `64 ms`. Cloud billboard/caster transforms
  continue at the scene cadence.
- Clear to cloudy: calls/s `1,061.3 -> 983.7` and triangles/s
  `49,436 -> 44,841`, with rendered FPS unchanged at `13.1`.
- Cloudy to clear: calls/s `776.6 -> 741.4` and triangles/s
  `43,006 -> 41,022`; p95 movement was slightly negative in both short
  samples and remains below the release gate.
- Dense cloudy and windy scenes retained eight and seven visible clouds and
  real shadow casters respectively. The cadence changes shadow-map work only;
  rain, snow, and visible cloud motion are unchanged.

### Step 07: billboard plant summaries without L-systems

Report: `steps/07-plant-billboard-lod/latest.json`. Step 08's pre-LOD report
is the immediate comparison because the cache landed first.

- Far/mid plant-viewer cache entries `3,583 -> 0`, writes `6,168 -> 0`, and
  evictions `2,585 -> 0`; CDP script duration `0.1089 -> 0.0346 s` and heap
  `227.9 -> 189.8 MB`.
- Canvas-ready time improved `868 -> 428 ms` in this pair. Rendered FPS/p95
  remained neutral (`3.5 -> 3.3`, `343.8 -> 348.4 ms`).
- Per-render calls moved `169.3 -> 172.0` and triangles
  `43,763 -> 48,508` because deterministic approximate summaries retain
  visible foliage/accent layers for more billboard instances. This small GPU
  increase accompanies the much larger worker/script/heap removal and needs
  physical-device visual/thermal confirmation.
- Near LOD still builds the exact existing L-system geometry. A mid-detail
  billboard remains visible while newly near symbols load, preventing plant
  pop-out. Determinism, lifecycle/produce behavior, and broad size fidelity
  pass for tomato, carrot, lettuce, and apple fixtures.

### Step 08: bounded generated-plant cache

Report: `steps/08-plant-cache/latest.json`.

- The cache is a weighted LRU capped at `16,777,216` estimated bytes and
  4,096 entries. Oversized results are returned but do not evict the useful
  working set.
- The intentionally broad plant viewer wrote 6,168 unique results, retained
  3,583 entries at `16,777,084` estimated bytes, and evicted 2,585. It recorded
  2,807 hits, 21,390 misses, and zero oversized skips.
- Plant-viewer frame metrics were neutral/noisy (rendered FPS `3.6 -> 3.5`,
  p95 `316.4 -> 343.8 ms` versus Step 01); active React batches still retain
  their currently rendered symbols independently of the cache.
- Plant-heavy mobile remained frame-time neutral and its sampled heap moved
  `92.9 -> 77.6 MB`. A deterministic 10,000-insertion unit soak remained
  within both ceilings throughout.
- Results larger than the cache's 16 MiB ceiling remain satisfied by the
  current keyed hook state instead of being regenerated on every effect pass;
  the oversized-result regression is covered by a focused unit test.

### Step 09: stable precipitation buffers and analytic rain

Reports: `steps/09-precipitation-before/latest.json` and
`steps/09-precipitation-after/latest.json`.

- Rain's 40-iteration fragment loop is replaced by one analytic tapered-streak
  mask. Particle count, vertex motion, weather progress, field fades, and the
  visible rain effect remain enabled.
- Default rain was neutral: rendered FPS `15.1 -> 15.2`, p95
  `80.3 -> 80.1 ms`, and calls/render `77.8 -> 77.7`. Dense rain improved
  from `4.8 -> 5.5` rendered FPS; CDP script duration fell
  `0.1165 -> 0.0382 s`, and the sampled maximum frame fell from an anomalous
  `852.5 -> 202.9 ms`.
- Medium-quality snow now allocates one 3,000-particle geometry and changes the
  active draw count for the sampled 2,100 flakes. Wind and fall changes update
  continuity-preserving uniforms rather than seeded GPU attributes.
- Snow calls and triangles per rendered frame stayed exactly equal in both
  pairs (`89.5`/`8,307` default and `175.0`/`47,306` dense). The profiler
  reported one geometry build in each snow scenario. Default snow p95 moved
  `89.6 -> 84.8 ms`; dense snow p95 moved `114.8 -> 121.2 ms`, which is
  treated as headless variance because its steady rendering work is identical.

### Step 10: shared weather-surface uniforms

Report: `steps/10-shared-weather-uniforms-after/latest.json`. Step 09's after
report is the immediate comparison.

- One Canvas-local coordinator now advances the keyed accumulated-snow and wet
  surface uniforms. Existing per-material bounds, colors, thickness, noise,
  gloss, snow clamp/override, and rain wet/dry dynamics are unchanged.
- Default snow used 11 material consumers backed by six distinct uniforms;
  dense snow used 14 consumers backed by the same six uniforms. This removes
  five and eight duplicate frame updates respectively while keeping all snow
  overlay meshes enabled.
- Default snow p95 moved `84.8 -> 83.4 ms`, task duration
  `5.2590 -> 5.1568 s`, and rendered FPS `13.5 -> 13.7`. Dense snow p95 moved
  `121.2 -> 119.8 ms` and script duration `0.0477 -> 0.0460 s`, with rendered
  FPS effectively unchanged (`10.1 -> 10.0`).
- Wet overlays are feature-gated off in these production profiles, so both rain
  samples correctly reported zero consumers/uniforms. The instanced path now
  avoids constructing its material while inactive. Dense-rain frame movement
  was negative/noisy even though calls and triangles per rendered frame returned
  to an earlier identical sample; no rain gain is claimed for this CPU-only
  inactive path.

### Step 11: shared dense-garden block index

Reports: `steps/11-dense-index-before/latest.json` and
`steps/11-dense-index-after/latest.json`.

- One memoized stack pass now creates block-name buckets and the active-drag
  lookup for the whole `EntityInstances` tree. Asset presence checks are O(1),
  and each instance builder maps only matching buckets rather than rescanning
  every stack and block. Stack/block ordering, aliases, drag identity, visuals,
  and interactions are preserved.
- Dense static canvas-ready moved `3,481 -> 3,460 ms`, p95
  `174.0 -> 169.5 ms`, and CDP task duration `5.6261 -> 5.3992 s` (`-4.0%`).
  Rendered FPS moved `6.4 -> 6.5` with identical calls and triangles per
  rendered frame.
- Dense camera-motion canvas-ready moved `4,117 -> 3,889 ms` (`-5.5%`), p95
  `279.3 -> 271.9 ms`, and script duration `0.5278 -> 0.5137 s` (`-2.7%`).
  Rendered FPS stayed `5.9`; the large sampled heap reduction
  (`307.1 -> 168.8 MB`) is recorded but treated as GC timing rather than a
  guaranteed retained-memory gain.

### Step 12: event-driven sky astronomy and projection

Reports: `steps/12-event-driven-sky-before/latest.json`,
`steps/12-event-driven-sky-after/latest.json`, and the post-review
`steps/12-event-driven-sky-orbit-fix/latest.json`.

- SunCalc/day-night results are memoized by date, time-of-day, and location.
  Sky projection updates on camera-rig or viewport changes, plus a cheap
  transform snapshot check that preserves standalone `OrbitControls` viewers.
  The existing 0.6-second gradient remains and holds a render lease only until
  exact epsilon convergence.
- Default clear mobile p95 moved `62.6 -> 48.0 ms` (`-23%`), CDP task duration
  `5.2074 -> 4.9155 s` (`-5.6%`), and measured long-task time
  `4,413 -> 3,105 ms`. Calls and triangles per rendered frame stayed exactly
  `40` and `2,620`; rendered cadence moved `19.6 -> 19.0 FPS` in the short
  headless pair.
- Dense cloudy remained GPU-bound/noisy: rendered FPS stayed `5.8`, p95 moved
  `191.4 -> 189.5 ms`, and task duration moved `5.3961 -> 5.5028 s`. Both
  reports retained eight visible clouds, eight real shadow casters, and one
  initial shadow invalidation.
- The post-review production rerun remained within that range: clear rendered
  `20.1 FPS` at `64.5 ms` p95, while dense cloudy rendered `5.9 FPS` at
  `187.9 ms` p95 with all eight real shadow casters. A camera-transform unit
  test covers position, orientation, zoom, and orthographic-bound changes.

### Step 13: cropped decoration-atlas residency

Reports: `steps/13-atlas-residency-before/latest.json` and
`steps/13-atlas-residency-after/latest.json`, including before/after
screenshots.

- The atlas generator now sizes each page to its highest occupied row while
  preserving stable page/slot assignments. The full first page remains
  `2048x2048`; the six-sprite second page is `2048x1024` instead of carrying
  two transparent unused rows at `2048x2048`.
- Estimated decoded RGBA8 residency including mip levels falls from
  `44,739,240 -> 33,554,432 bytes` (`42.7 -> 32.0 MiB`, `-25%`). Base-level
  pixels fall from 32 to 24 MiB. The second-page WebP also falls
  `28,266 -> 23,876 bytes` on disk.
- Both samples report 914 decorations, 578 visible decorations, two active
  atlas pages, and 57 chunks. Calls/render stayed `58` and triangles/render
  stayed `9,520`; the visual comparison showed the same sprites and layout.
- Rendered FPS moved `6.4 -> 6.5`, p95 `175.6 -> 166.2 ms`, and CDP task
  duration `5.4923 -> 5.3590 s`. These secondary timing improvements are
  directionally positive, but the guaranteed result is the measured texture
  allocation reduction.

### Step 14: intensity-aware rain lifecycle

Reports: `steps/14-rain-lifecycle-before/latest.json` and
`steps/14-rain-lifecycle-after/latest.json`.

- The profiler now includes a warmed rain-to-clear transition and records the
  first frame where the rain particle count reaches zero.
- Rain intensity is clamped and passed through the existing shader progress
  uniform instead of remaining fixed at full strength throughout the fade.
- The particle system unmounts once intensity reaches `0.03`. At that point the
  shader's maximum possible alpha is already below its existing fragment
  discard threshold, so the cutoff removes invisible work without shortening
  the visible effect.
- Rain unmounted at `2,798.7 -> 1,422.8 ms`, `49.2%` sooner. Across the same
  five-second transition, calls/s fell `792.1 -> 767.0` (`-3.2%`) and
  triangles/s fell `47,812 -> 45,162` (`-5.5%`). Calls and triangles per
  rendered frame fell `52.6 -> 51.8` and `3,178 -> 3,049`.
- Steady clear remained exact: zero rain particles, 40 calls/render, and 2,620
  triangles/render in both samples. Its rendered FPS and p95 movement
  (`19.7 -> 19.4`, `46.5 -> 46.9 ms`) is treated as headless variance.
- A custom quality multiplier of zero no longer mounts a zero-instance rain
  mesh. The static JavaScript import remains intentional: lazy-loading this
  small shader path could delay the first visible rain and would not address
  the sustained GPU workload behind the thermal report.

### Step 15: single-page 1024px decoration atlas

Generated 2026-07-23 with:

```bash
pnpm --filter @gredice/cdn run regenerate-cdn:decoration-atlas
```

- All 22 grass, desert-grass, and flower sprite IDs now fit on one
  `1024x1024` page using a `5x5` grid. Each cell is `204px` with `16px`
  padding, leaving up to `172px` for the visible sprite.
- Estimated decoded RGBA8 residency including mip levels falls from
  `33,554,432 -> 5,592,404 bytes` (`32.0 -> 5.3 MiB`, `-83.3%`). The
  `27,962,028-byte` reduction is the guaranteed runtime benefit; frame-time
  impact depends on device GPU memory pressure and transparent overdraw.
- Generated PNG payload falls from `894,792 -> 354,528 bytes` across pages
  (`-60.4%`), and WebP payload falls from `237,984 -> 136,632 bytes`
  (`-42.6%`). The obsolete second-page PNG and WebP are removed.
- Garden and WWW copies have identical hashes. A second generation retained
  the same IDs, slots, and output hashes, confirming stable repeat builds.
- This atlas is used by ground decorations, not procedural L-system leaves.
  It reduces decoration texture residency and page partitioning without
  changing plant-generation work, plant geometry, or L-system detail policy.

## Raised-bed close-up profiling foundation

Added 2026-07-23 for the L-system close-up optimization series.

The production profiler now has a deterministic `plant-closeup` matrix for
center raised bed `29` in the plant-heavy mock garden. It captures desktop
medium and constrained automatic-quality mobile runs. Each scenario gets five
independent samples, and every sample records both a cold and warm
normal-to-close-up transition plus steady state. Reports include the selected
and surrounding plant LOD/render states, detail-readiness milestones,
L-system/worker and main-thread build work, primitive and shadow submissions,
renderer work, long tasks, heap, optional WebGL2 GPU timing, and normal,
pending-near, and detailed screenshots.

Run:

```bash
cd apps/garden
GAME_PROFILE_SCENARIO_SET=plant-closeup pnpm run profile:game
```

The completed implementation was profiled in a production build with five
independent desktop and five independent constrained-mobile runs. Each run
captured a cold and warm transition. The ignored raw report and screenshots are
under `steps/final-integrated/`.

Three-repeat production comparisons were also captured for the historical
implementation stages:

| Stage | Desktop full detail cold/warm | Mobile full detail cold/warm | Cold transition p95 desktop/mobile |
| --- | ---: | ---: | ---: |
| `1975d497d`, buffer + profiler baseline | `2,159.3/1,316.3 ms` | `1,690.8/1,114.2 ms` | `245.5/171.8 ms` |
| `bd3d8cb8d`, selected-bed LOD/culling | `1,711.4/664.4 ms` | `738.5/309.4 ms` | `295.8/173.4 ms` |
| `7ef664ef0`, progressive/cancellable generation | `13,493.6/664.6 ms` | `1,635.0/171.0 ms` | `204.8/212.8 ms` |
| completed branch, five repeats | `3,611.4/2,878.1 ms` | `1,528.8/2,054.5 ms` | `256.2/213.7 ms` |

The historical builds carry the same harness-only backports for production URL
state, stable close-up callbacks, an independent plant Suspense boundary, and
connected-raised-bed positioning. Commits that predate scheduler snapshots omit
only that controller field. They are therefore comparable patched builds, not
bit-for-bit commit artifacts.

- Selected-bed LOD cut full-detail readiness by `20.7%` cold and `49.5%` warm
  on desktop, and by `56.3%` cold and `72.2%` warm on mobile. It also reduced
  background-near mobile fields from two to zero.
- Progressive scheduling reduced desktop cold transition p95 by `30.8%` and
  calls/triangles per rendered transition frame by `67.7%/49.4%` versus the LOD
  stage. Its serialized cold desktop completion regressed to `13.5 s`; the
  packed-worker/final pipeline brought this back to `3.6 s`. On mobile, the
  progressive stage reduced steady calls from 26 to 17 and steady triangles
  from `19,494` to `17,978`, while warm detail readiness fell another `44.7%`.
- Against the initial profile baseline, the completed cold mobile steady state
  moved from `11.0` to `13.5` rendered FPS, p95 from `92.7` to `86.2 ms`,
  triangles/render from `20,294` to `19,494`, and median heap from `104` to
  `54.2 MB`. Desktop cold transition calls/render fell from `83.4` to `59.6`
  and triangles/render from `19,609` to `16,696`.

The final pipeline uses a stricter exact-chunk milestone and four bounded
archetypes per batch, so its detail-ready time is not a like-for-like
continuation of the older single-completion milestone. The buffer optimization
also predates the profiler, while packed workers, template reuse, shadow proxy,
and shader prewarming land together in the final integration. Their individual
proof therefore comes from the dedicated counters below rather than synthetic
cherry-picked timing claims.

Both viewport suites passed every L-system-specific acceptance gate:

| Optimization | Production profile evidence |
| --- | --- |
| #4277 deterministic profiler | All 20 cold/warm phases reached camera-settled, first-exact-chunk, and fully-detailed milestones, with normal, pending-near, and detailed screenshots. |
| #4278 selected-bed LOD and hierarchical culling | The selected bed remained `18/18/18` total/near/detailed in every phase and background-near stayed zero. Median group rejection was `73.9%` desktop and `87.6%` mobile; avoided field projections were `76.1%` and `89.4%`. LOD update maximum was `0.2 ms`. |
| #4279 progressive and cancellable detail | Desktop first-exact/full-detail medians were `2,067.5/3,611.4 ms` cold and `1,751.3/2,878.1 ms` warm. Mobile medians were `1,086.1/1,528.8 ms` cold and `1,152.7/2,054.5 ms` warm. Pending work retained billboards until the exact chunks arrived. |
| #4280 packed worker output | Each phase completed 20 packed builds and transferable deliveries with zero worker failures, synchronous fallbacks, or stale results. `108,832 bytes` crossed the worker boundary; cold worker totals were `6.8 ms` desktop and `5.9 ms` mobile, falling to `0.8 ms` warm. |
| #4281 bounded template and archetype reuse | Cold phases populated 20 templates; warm phases had `20/20` hits with zero misses or evictions. Render batches stayed at four archetypes maximum, 20 total, for 131 detailed plants and zero failed archetypes. |
| #4282 exact instance-buffer ownership | Five active meshes held exactly `1,432/1,432` live/capacity instances and `108,832 bytes`, with zero empty meshes and zero orphaned resources. |
| #4283 shader and shadow work | Shader variants were ready before the first detailed swap in every phase, with zero post-swap compilations. Warm prewarm was deduplicated to `0.2 ms` desktop and `0.1 ms` mobile. Detailed plants use a single conservative raised-bed shadow proxy instead of submitting every plant part as a shadow caster. |

The legacy top-level headless budget remains red: software WebGL reported
steady median p95 values of `113.4-116.3 ms` desktop and `81.9-86.2 ms` mobile,
plus
repeated `ReadPixels` stalls. Draw-call, triangle, and heap budgets passed. This
does not invalidate the L-system-specific gates, but it also is not thermal
clearance.

Headless Chromium measurements remain directional. Release validation still
requires separate 10-minute raised-bed close-up soaks on at least one mid-range
iPhone and one mid-range Android device, recording frame stability, heap trend,
visual detail readiness, battery/thermal state, and any OS throttling signal.

## Final validation and headless soak

Report: `steps/final-soak/latest.json`. Each scenario warmed for 5 seconds,
soaked for 15 seconds, and sampled for 10 seconds in the production build.

| Scenario | Rendered FPS | p95 | Calls/render | Triangles/render | Heap | Visual runtime proof |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Clear mobile | 19.0 | 64.0 ms | 40.0 | 2,620 | 40.1 MB | 0 clouds, precipitation idle |
| Rain mobile | 15.4 | 76.7 ms | 67.4 | 5,814 | 40.1 MB | 1,400 drops, 8 clouds |
| Snow mobile | 13.7 | 85.8 ms | 89.3 | 8,300 | 40.1 MB | 2,100/3,000 flakes, one geometry build, 11/6 surface uniforms |
| Dense cloudy mobile | 5.8 | 193.0 ms | 329.2 | 36,221 | 42.6 MB | 8 moving clouds and shadow casters |

- All four completed without page or WebGL/shader errors. The only console
  errors were expected profile-route provider requests returning 401/404.
- Resuming a hidden or offscreen scene now explicitly re-arms the bounded
  900 ms shadow-settlement window, preventing stale caster shadows without
  restoring continuous offscreen rendering.
- The repository's `33.3 ms` physical-device floor still fails in this
  headless environment, which reports synchronous `ReadPixels` GPU stalls.
  This is not treated as release clearance; the physical thermal gates below
  remain mandatory.
- The steady-state soak predates Step 14. That step does not change steady rain
  or clear render work and is covered by the dedicated production
  rain-to-clear profile above.
- Final validation passed: 484 game unit tests, game and garden typechecks,
  the offscreen public-garden preview capture browser test, targeted Biome
  checks across all changed source files, production build, generated-atlas
  synchronization, and `git diff --check`.

## Release gates

- Full-garden mobile heavy-weather p95 frame time at or below `33.3 ms` on the
  selected physical-device floor.
- No sustained rendered-FPS decline or rising heap across a 10-minute soak.
- No recurring WebGL rendering while the document or canvas is hidden.
- Camera and touch interactions remain responsive.
- Rain, snow, clouds, plant motion, animals, and accumulated-weather visuals
  pass visual comparison at every quality tier.
- Cloud shadows still shade raised beds and entities, not only flat terrain.
