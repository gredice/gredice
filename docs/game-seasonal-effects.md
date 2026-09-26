# Seasonal scene debugging

The [Autumn 2026 art brief](autumn-art-direction-2026.md) defines collection
palettes, footprints, small-garden targets and the early/mid/late lighting review.
Its launch decision retains these seasonal curves and uses new decorative props
for immediate identity.

All seasonal presentation reads `seasonState` from the game store. Lighting,
seasonal effects and debug controls share `freezeTime`; no seasonal component
should create its own current date. Debug date changes also affect plant growth
visuals and suggestions, but never write garden or crop data.

The Debug HUD Time section provides a full-year slider, season starts and
mid/late autumn jumps. Reset time restores the live clock. Calendar changes
preserve clock time, while the sun position naturally changes with the date.

Debug routes accept a strict `date=YYYY-MM-DD` parameter:

- `/debug/profile/game?mode=autumn&date=2024-10-22&fixedTimeSeconds=12&debugHud=1&hud=1`
- `/debug/sandbox?date=2024-11-21`
- `/debug/entities?date=2024-11-21`
- `/debug/entities/Tree?date=2024-10-22`

Malformed dates and impossible calendar days retain the route's default time
(live for sandbox routes, the mode's frozen date for profiles). Profile dates
preserve the selected mode's clock time. These query parameters are read only by
debug routes. `fixedTimeSeconds` controls animation time independently of date.

Import `getSeasonDebugDates` from `@gredice/game/seasonal-debug` for fixture and
story dates: `spring`, `summer`, `earlyAutumn`, `midAutumn`, `lateAutumn`, `winter`.
The default capture year is 2024; callers may supply another year. Each call
returns fresh local-noon dates derived from the shared seasonal milestones.
Calendar and clock parts cross the server/client boundary without a timezone,
then become a browser-local Date. Capture reports record the resolved ISO instant
and browser timezone in their comparison signature; different dates or zones are
incompatible. Use a fixed browser timezone when comparing captures across machines.

Run the HUD browser checks with
`pnpm --filter garden exec playwright test --config playwright.season.config.ts`.

## Deciduous canopy

`autumnState` is resolved alongside the shared season state at every scene-clock
write. It exposes foliage colour, retention, shedding and settled-leaf curves.
Winter keeps the brown/low-retention endpoint; spring gradually regrows foliage.
`Tree` alone opts into the colour curve. Yellowing starts on **August 22** and
progresses from the crown downwards, with lower foliage staying green longer.
Both the canopy and its sprigs receive vertex colours using the full canopy's
local height range, including in the instanced renderer. The palette retains
stable block-ID variation. The astronomical season labels, leaf retention,
shedding and settled-leaf timing are unchanged. Cached GLTF geometry/materials,
trunk, palms, crops and grass materials stay unchanged. Weather visualization
disablement restores the base canopy. Frozen seasonal stories and WebGL captures
cover summer, early/mid/late autumn, winter, cloudy/twilight light and snow.

## Canopy retention

`Tree.blend` retains its original summer mesh and adds named thinning/sparse
canopies and an exposed branch mesh. `assets/create-tree-autumn-variants.py`
reproduces these source meshes; export with the normal asset pipeline (a focused
export may use `assets/export-game-assets.py -- --asset Tree`), followed by
`pnpm generate:models-types`. The manifest version invalidates the GLB URL cache.

Each tree selects one canopy with a bounded ID-seeded retention offset. Sprigs
belonging to the original full canopy disappear with that canopy; the same selected
geometry receives snow. Seasonal stage changes also invalidate cached shadows.

Blender 5.1.2 export counts: full tree 1,170 triangles (124 trunk, 80 canopy,
966 sprigs), thinning 284 (124 trunk, 80 canopy, 80 branches), sparse 244
(124 trunk, 40 canopy, 80 branches). All stages use three opaque meshes plus
the optional snow pass; no transparent duplicate canopy is mounted.

## Falling leaves

A scene-local registry receives only mounted deciduous tree anchors, including
batched trees. The ambient pool is separate from interaction particles and uses
closed-form seeded trajectories on the shared animation clock. Wind is clamped
to the existing 0–3 weather scale. Leaves drift, flutter and shrink at ground
contact; no particle landing is persisted. Camera-frustum culling works with the
orthographic garden camera, and scene visibility suspends the animation lease.

Active-leaf caps: low 24, auto-constrained 40, medium 80, high 160, custom 120.
At most eight leaves are sampled per tree, with intensity-dependent occupancy.
The mesh and its geometry/material are disposed on unmount. Profile metadata
exposes `autumnLeafCount` and `autumnLeafCapacity`.

`GAME_PROFILE_SCENARIO_SET=autumn pnpm --filter garden profile:game` profiles the
dense autumn-surface garden in wind at the shared late-autumn fixture date on low/medium/high.
Use `fixedTimeSeconds` in a debug link for reproducible still captures; omit it
when measuring animation cost.

## Settled ground leaves

Exposed grass, sand and swamp terrain reuse the ground-decoration surface and
slope contract. Water, mulch, raised-bed covers and higher terrain blocks suppress
covered surfaces. Density combines the shared settled-leaf curve with deciduous
trees within four tiles and a wind bias bounded to 15%. Garden/block/year/tree IDs
seed an ordered candidate set; density changes reveal a prefix of that set. The
winter seed belongs to the preceding autumn.

Three small low-poly leaves form each cluster. The existing block-instance path
preserves rotation, stack height, drag previews and placement/drop animation.
Batches are grouped by slope and rotation variant, with no leaf raycasts. Rain
darkens the leaf material and lowers roughness; snow suppresses density quadratically.
Scene cluster caps are 48/96/256/512/384 for low/constrained/medium/high/custom
(12 triangles per cluster). `autumnGroundLeafClusters` is included in profile
metadata. Frozen low/high WebGL fixtures cover flat and rotated sloped terrain.

## Entity surface allowlist

`helpers/autumnLeafSurfaces.ts` is the explicit `AutumnLeafSurface` contract.
Anchors are authored in block-local world units after applying each model's
runtime scale/offset. The initial audit covers Stool seats, StoneMedium top
facets, both Raised_Bed U-segment rims, Fence central post caps (shared by
connected variants), and all six gift-box colours on the box top away from the
ribbon/bow. Top heights and stone facet gradients were checked against exported
GLB triangles. Small clusters use 45% of the ground-cluster size.

The global layer reuses block instances and the raised-bed footprint helper, so
quarter-turns, stack heights, drag previews and placement/drop animation keep the
same block identity. Authored anchor ordering is seeded by garden/block/year and
anchor ID. Summer, absent nearby trees, covered props and full snow produce no
leaves. Shared material wetness and raycast exclusion match the ground layer.
Entity cluster caps are 24/48/96/160/128 for low/constrained/medium/high/custom;
flat surfaces share one or two batches and the two stone slopes add at most four.
Profile metadata exposes `autumnEntityLeafClusters`.

### Part-local expansion and exported-geometry audit (#4921)

`autumnLeafSurfaces` remains block-local and keeps the original anchor IDs.
`autumnPartLeafSurfaces` is part-local: the key is the stable exported part ID,
and the anchor ID is stable within that part. A scene-local `AutumnPartsProvider`
registers the **rendered** mesh/group (not a GLTF cache node). One sorted
allocator applies the same 24/48/96/160/128 cap to both coordinate spaces.
Each part candidate declares `coordinateSpace: 'part-local'` and an
`eligibilityPolicy`; fixed exposed parts use `always`, while the box lid uses
`closed-and-settled`. Current eligibility and cover are checked separately.
The dynamic batch samples `inverse(batchRoot.matrixWorld) × renderedPart.matrixWorld
× localAnchorMatrix` after scene spring writes and before rendering. It applies
the part's node, root, pickup and hinge transforms once. The 0.45 local scale
on the bench slats becomes 0.234 in world units under the bench's 0.52 root
scale; the other new clusters use 0.45 world scale. Both leaf geometry yaw
variants must fit their entire footprint, not just the anchor center.

The audit below uses triangles from `apps/garden/public/assets/models`, with
manifest versions from `assets/game-assets.json` as of 2026-09-23. Coordinates
are `(x,y,z)` and the listed normal is in the anchor's local space. A 0.006
surface lift is added at render time. `autumnSurfaceGeometry.unit.ts` samples
every vertex of both three-leaf variants against the exported supporting face.

| Entity / GLB version | Exported mesh node; variant/state | Space, anchor, normal | Render transform; footprint and decision |
| --- | --- | --- | --- |
| WoodenBench `238606505a28` | `WoodenBench_SeatSlatFront/Center/Back`; all rotations, exposed | Part-local, each slat `x=±0.4, y=0.065, z=0`, up | Node translation `(0,0.71,±0.205 or 0)`, root scale `0.52`, stack/root spring, pickup/drop wrappers. A 0.45 local cluster stays inside the flat center of the 0.17-wide slat and away from end pins; six anchors. Rails, braces, legs and pins excluded. |
| OutletDisplayTable `88f3aa524c7f` | `OutletDisplayTable_TopPlanks`; exposed, no displayed item at the corners | Part-local, `x=±0.27, y=0.67, z=±0.255`, up | Node transform, stack/root spring and pickup/drop wrappers. Four outer-plank anchors clear the seams, edge and center display area. `LowerShelf` is sheltered; frame excluded. |
| GardenBox `c007d6f4b671` | `GardenBox_Lid_HingeOrigin`; closed and settled only | Part-local, `x=±0.23, y=0.06, z=0.3`, up | Standalone rendered hinge group; instanced root rotation `+2` quarter turns then hinge `(0,0.6,-0.38)`. Two clusters fit the flat exterior panel, clear of raised strip/hinge/edges. Open, opening and closing lids, interior and body rim excluded. A hover/open request removes leaves immediately; the standalone closing spring's `onRest` restores the same IDs. |
| StoneLarge `StoneLarge.glb` (manifest unversioned; SHA-256 `b2de5f92d275`) | `Stone Large`; exposed top facet | Block-local `(-0.10343,0.58665,-0.05734)`, slope `(0.081585,0.329026)` or normal `(-0.081585,1,-0.329026)` | Renderer scale `(0.263,0.426,0.291)`, block quarter-turn and stack. One cluster fits wholly inside the broad upper triangle. Other stone heights/slopes are not reused. |
| FenceGate `ce707c4e9253` | `FenceGate_Posts`; fixed caps, all gate states | Part-local `x=±0.43, y=0.55, z=0`, up | Rendered posts mesh under root/placement spring. The 0.15-wide caps support two clusters; moving leaf and narrow rails excluded. |
| StoneFenceGate `1e715ef5972d` | `StoneFenceGate_Posts_Mesh`; fixed caps, all gate states | Part-local `x=±0.43, y=0.68, z=0`, up | Rendered posts mesh under root/placement spring. Two clusters fit the 0.32-wide caps; moving leaf excluded. |
| PolishedStoneFenceGate `6a06de6cfa10` | `PolishedStoneFenceGate_Posts`; fixed caps, all gate states | Part-local `x=±0.43, y=0.68, z=0`, up | Rendered posts mesh under root/placement spring. Two clusters fit the 0.28-wide caps; moving leaf excluded. |

| Reviewed exclusion | Reason |
| --- | --- |
| `StoneSmall.glb` and `DesertStoneSmall/Medium/Large.glb` (manifest unversioned) | Smaller or irregular sloped tops and desert crevice geometry need their own footprint/slope set; copying StoneLarge or StoneMedium coordinates would float or intersect. No anchors enabled. |
| Connected `Fence` (`dbd149ee3e7b`), `WhiteFence` (`6da3db488a19`), `StoneFence` (`e8bb66423669`), `PolishedStoneFence` (`2c5f40e1afc5`) extensions | Existing `Fence` central cap remains the single block-local owner. The resolved extension shapes add narrow rails/posts with topology-dependent ownership; none pass the current exposed whole-cluster review. No extension ID is registered, preventing duplicate central caps. |
| `WhiteFenceGate` (`7b2247eff49b`) and all moving gate leaves | White posts are too narrow for the three-leaf footprint. Moving leaves rotate at a separate hinge and have narrow tops; fixed-cap registrations on the other three families never attach to a moving leaf. |
| Bucket `651d759c9d56`, WateringCan `8b128e30b990`, ShovelSmall (unversioned), Composter `932e7624a5c1` | Bucket/watering-can openings, handles and shovel blade/shaft are occupied or too narrow. Composter top has separate overlapping meshes and no verified exposed footprint. No generic tool/container fallback is used. There is no separate crate entity in the current runtime inventory. |
| MoonRainBarrel `7425319b60fc`, WaterWell `1f8ed0929e90`, BirdHouse (unversioned), EnamelGardenLamp `c945af2c0198` and other large decorative props | Barrel lid is inclined above occupied water/leaf details; well has water and frame overhead; birdhouse roof/platform is sloped/sheltered; lamp shade is a light/fixture. These are deliberately left clear. Animals, crops and foliage also remain excluded. |

The `dense-autumn` mock profile retains 25 trees and 50 nearby props, now
mixing Stool/gift boxes with repeated benches, tables, closed boxes, large
stones and gates. A changed fixture cannot be compared with an older profile
report; run baseline and candidate with this same profile, viewport, DPR, tier
and production build. Profile metadata keeps `autumnEntityLeafClusters` as the
combined rendered count. Dynamic batches have no raycast, no shadow casting
and no idle animation lease; the scene render scheduler updates them only on
requested frames.
The scene samples a discrete visible-anchor count after each requested spring
frame. When a prop or deciduous tree crosses a density threshold, it refreshes
the shared allocation from current world matrices; this also admits a part
that had zero candidates before a drag. Existing batch matrices still follow
the rendered part each frame without a React update for every pose.

### Validation record (2026-09-23)

The `chromium-webgl` season fixture captures both quality tiers at four
quarter-turns, rain, partial snow, each reviewed face and a grazing lid view.
An animation-enabled case samples the real placement-drop wrapper while the
bench rotates and the box lid opens; its leaf/part matrices agree in every
sampled frame. Separate cases cover rapid reopen, reduced motion and two Canvas
roots, plus a bench spring moving from zero tree influence into range and back.
`autumnSurfaceGeometry.unit.ts` checks both leaf variants against the
exported triangles of every enabled new face, including the three gate caps.

A same-fixture production profile on macOS arm64, Node 24 and headless Chromium
149 compared current `main` plus the revised dense fixture with this feature.
Two independent runs per side used the `autumn` scenario set, 5-second
warmup/sample, the same quality viewport/DPR, and clean build/harness
provenance. All per-tier budgets passed. Draw calls and triangles per **rendered**
frame were stable across repeats; per browser frame varied with host FPS.

| Tier | Entity clusters baseline → candidate | Draw calls/render baseline → candidate | Triangles/render baseline → candidate | p95 frame baseline → candidate |
| --- | ---: | ---: | ---: | ---: |
| low | 24 → 14 | 131 → 132 | 116,368 → 116,320 | 26.1–26.2 → 27.1–27.2 ms |
| medium | 44 → 59 | 280 → 288 | 142,132 → 142,756 | 26.1 → 21.4–26.8 ms |
| high | 44 → 59 | 224 → 232 | 122,895 → 123,555 | 26.1–26.2 → 27.1–27.2 ms |

The final low-tier allocation contains 14 eligible clusters, below its cap of
24; the medium and high scenes include the new reviewed surfaces.
The new path is visibly populated in the high-tier screenshot and directly
counted by the part-only WebGL fixture. These are headless desktop measurements;
physical-device visual and performance checks remain separate.

## Leaf-rustle ambience

`AutumnRustle` uses one registered loop on the existing ambient mixer. Its target
combines blended 0–3 wind with retained/settled leaf presence and a mounted tree
source, only in autumn/winter. Wind enters above 0.45 and exits below 0.30; gain
is capped at 0.14 before master/ambient volume. A 0.3-second exponential time
constant smooths changes without restarting the source, and silent loops stop
after five time constants. Disablement, mute, backgrounding and unmount stop the
layer; a missing asset fails quietly and is not retried on each weather update.

`useMusic().setTargetVolume(target, fadeSeconds)` also drives the
[weather ambience crossfades](./game-weather-audio.md). It preserves buffer
caching and the existing channel/master controls. The sparse, high-frequency
leaf grains leave space for the light/medium/strong wind textures.

`assets/generate-autumn-leaf-rustle.py` reproducibly creates the original six-second
mono WAV in both garden and WWW public assets. It uses no external recording or
third-party samples. The versioned filename supports cache invalidation. Peak is
0.42, RMS is approximately 0.0648, and both loop endpoints are zero. Browser tests
verify decoding, one-source continuity, mute and missing-asset behavior; final
speaker/headphone mix tuning remains a listening check.

## Avatar leaf crunch (#4973)

The local avatar's existing movement callback samples the same 0.82-unit stride
used by its rig. Grounded contacts trigger sparse ID/step-seeded variants with a
280 ms minimum interval; there is no catch-up loop after spawn, teleport, reload,
clock rewind or backgrounding. Stationary/camera/hover frames, blocked movement,
jumps, seats and boats cannot trigger steps. Frozen calendar dates preserve
seasonal coverage, while a fixed animation clock silences steps. Reduced motion
keeps this movement feedback without adding any animation.

A scene-local spatial index registers only the rendered ground-leaf allocation,
so exposed surfaces, rotated slopes, tree influence, snow and low/high quality
caps agree with the visible leaves. Contacts check a 0.3-unit footprint and the
surface plane; prop leaves never register. Pickup/drag previews suppress audio.
The index unregisters on layer replacement/unmount and adds no geometry,
raycast targets, React frame state, frame callback or render lease.

Three original 165–195 ms mono WAVs are generated by
`python3 assets/generate-autumn-leaf-steps.py` into both game asset hosts (about
24 KB total per host). No external recordings or licensed samples are used.
The existing ambient/master controls govern the sound, with heavy rain reducing
gain by up to 65%. Missing assets fail once and stay quiet. Cancellable mixer
one-shots discard loads older than 100 ms, cancel on mute/hidden/disabled/unmount,
and never queue for a later browser audio unlock. Only one leaf step can play at
a time; hardware speaker/headphone mix tuning remains a listening check.

Validation:

- `pnpm --filter @gredice/game test`
- `pnpm typecheck --filter @gredice/game --filter garden --filter www`
- `pnpm --filter garden exec playwright test --config playwright.season.config.ts tests/leaf-steps.spec.tsx tests/autumn-audio.spec.tsx --workers=1`

The WebGL fixture uses the actual avatar, ground/falling leaves and rustle loop,
including low/high, rain, snow, frozen dates/time, reduced motion, surface
transitions, mute, background and cleanup. Its attached combined-audio report
counts decoded sources and peak concurrency alongside render and browser-frame
timing. The dense production `autumn` profile remains the whole-scene budget check.

## Ground leaf gusts

The airborne leaf mesh now also draws a short ground-level gust every 12 live
seconds when blended wind reaches 0.75. One seeded event selects a visible exposed
grass, sand or swamp block within four tiles of a mounted deciduous tree. The
same exposure, slope, rotation and stack-height rules used by settled leaves
place the gust just above the surface. An event lasts 1.4 seconds and uses at
most 2/2/3/4/3 leaves on low/constrained/medium/high/custom quality. Those
instances come out of the existing airborne-leaf cap for that frame; the
interaction-particle pool is untouched. The mesh has no raycast target.

Calm wind, heavy rain, accumulating snow, reduced motion and disabled weather
silence gusts. A scene deadline wakes each gust; the render lease is held only
during the burst and is released while quiet or hidden. Audio disablement
still mutes rustle independently of the visual layer. Event selection and
trajectory use garden, block, autumn year and elapsed-time seeds, so
`fixedTimeSeconds=10.7` gives a repeatable active burst and `14` gives a quiet
frame at the same frozen calendar date. The normal still fixture remains at 12.

Profile metadata exposes `autumnGustCount`, `autumnGustPeakCount` and
`autumnGustCapacity` beside the combined `autumnLeafCount` and the settled
ground/entity counts. Run `GAME_PROFILE_SCENARIO_SET=autumn pnpm --filter garden
profile:game` to measure the dense autumn layers together. The WebGL component
checks exercise low/high caps, wind/rain/snow/reduced-motion combinations and
cleanup.

For QA open `/debug/profile/game?mode=autumn&profile=dense-autumn&date=2024-10-22&sound=1&leafWind=light&hud=1&debugHud=1`
and click inside the page to unlock browser audio. Combine dates `2024-06-21`,
`2024-09-22`, `2024-10-22`, `2024-11-21` with `leafWind=calm|light|strong`.
Summer and calm are silent. The season slider and wind controls can be changed
rapidly without restarting an audible rustle loop. Profile metadata exposes only
the intended `autumnRustleTargetGain`; it is not proof of hardware sound output.


## Rain ripples

`RainRipples` adds one depth-tested instanced batch on exposed flat sand and
swamp-ground blocks, using the same stack height and rotation as the existing
wet overlays. A block with anything stacked above it is excluded. Prop footprints
and a conservative one-cell overhang margin exclude nearby ground; trees, palms,
shade and umbrellas use two cells. Slopes, walls, snow, water blocks, raised beds,
covered ground and active drag previews do not receive ripples. This is an
intentional surface allowlist, not a simulation of every puddle or prop surface.

Garden/block IDs seed one small ring per site, ranked independently of stack
order. The existing scene clock drives closed-form expansion and fading entirely
in the shader. Wetness and puddle strength are references to the shared weather
uniforms: ripples emerge only above 0.66 rain and 0.6 rendered wetness, and fade
with those values. Calendar changes do not reseed rainfall; the same garden and
fixed animation time reproduce the same rings in any season.

Low and auto-constrained tiers omit ripples. Medium/high/custom cap the entire
scene at 24/48/32 two-triangle quads, adding at most one draw call and 96 triangles.
Rings stay inside their terrain tile, test depth, do not write depth or shadows,
and have no raycast targets or audio. Reduced motion, weather disablement and
any snow coverage of at least 0.01 suppress them. Hidden/offscreen scenes release
the ripple animation lease through shared runtime visibility; frozen scenes need
no ripple lease. Geometry, material and instance resources are disposed on
unmount. `rainRippleCount` and `rainRippleCapacity` expose the layer to profiling.

Validation commands:

- `pnpm --filter @gredice/game exec tsx --import ./scripts/register-test-assets.mjs --test src/rain/rainRippleState.unit.ts`
- `pnpm --filter garden exec playwright test --config playwright.season.config.ts tests/rain-ripples.spec.tsx`
- `GAME_PROFILE_SCENARIO_SET=rain-ripples GAME_PROFILE_FAIL_ON_BUDGET=1 pnpm --filter garden profile:game`

The profiling matrix combines heavy rain with the existing dense autumn scene
at October 22 on low/medium/high, sharing the dense weather budgets. Commit the
candidate before profiling so the report's comparability check can identify it.

## Squirrel nut carrying and caching

During autumn, the existing squirrel begins an eligible visit with a short forage,
scamper, cache and pause sequence, then returns to its ordinary routines. One
seeded route is selected from its existing ground habitat, with at most eight
pathfinding attempts and six world units of travel. The whole sequence lasts
less than 14 seconds. Blocked routes fall back to ordinary behavior; clicks,
avatar flee reactions and scheduled departures interrupt caching. The existing
one-squirrel garden cap, 35–65 second visits and four-minute respawn cooldown
remain in force. Nuts never read or change crops, inventory, rewards or garden
blocks, and no cache object is left behind.

A single 20-triangle chestnut is parented to the cloned model's animated
`Squirrel_HeadPivot`, below the muzzle in exported head-local coordinates. It
follows the rig through movement and turning, then shrinks away during the
existing forage animation. It has no raycast, shadow pass or audio. Low quality
uses the same small mesh; it adds at most one draw call and 20 triangles. The
attachment geometry/material and actor animation mixer are released on unmount;
cached GLTF resources remain untouched.

The calendar comes from shared seasonal state and animation from `SceneTime`.
Fixed animation seconds reproduce both the path position and rig pose without
replaying intermediate frames. Hidden scenes pause animation; reduced motion
holds a still squirrel without the nut or an animation lease. Visit expiry uses
the shared deadline scheduler independently of pose animation, so a still
squirrel enters cooldown on time (or on visibility resume). Weather disablement,
rain intensity at least 0.7, or snow coverage at least 0.01 suppress caching.
Audio preferences need no extra handling because this effect adds no sound.

Validation: squirrel unit tests cover deterministic sampling, blocked paths,
season/weather gating and attachment transforms through every exported animation.
`pnpm --filter garden exec playwright test --config playwright.season.config.ts
 tests/squirrel-caching.spec.tsx` exercises the real actor with existing autumn
layers at low/high quality, frozen remounts, live completion, visibility and
resource cleanup, including the incremental draw/triangle count.

## Cold-condition frost and breath

Cold effects consume `GET /api/data/weather/now`'s **forecast air temperature in
Celsius** (`temperature`), precipitation strengths and snow accumulation in cm.
The API's `measuredTemperature` is currently unavailable and is not substituted.
Missing/non-finite temperature, `isStale`, `source: fallback`, disabled weather,
and low/auto-constrained quality all produce zero frost and breath. Debug weather
overrides must explicitly supply `temperature`; cached live temperatures never
fill that field. A frozen autumn date alone cannot activate cold effects. These
are presentation thresholds, independent of plant health, growth or storage.

Frost grows from zero at 0°C to full strength at -4°C. It reuses the integrated
base-ground weather material as a static, upward-facing crystal tint, limited
to 32% blend, without displacement, overlays, extra geometry or raycast targets.
Rain fades it out by strength 0.2; snowfall or 3 cm accumulation removes it.
Rendered wetness additionally masks residual frost, and snow-covered fragments
retain their existing snow rendering. Existing leaves remain above the ground.
The legacy weather-surface feature-flag fallback omits frost. Active frost uses
the existing weather bypass for the static opaque scene cache.

Visible breath begins below 5°C and reaches full strength at -2°C. Supported
actors are the live cloned goat and sheep rigs; source IDs determine a repeatable
6–10 second cycle with one soft 1.5 second puff. Medium/high/custom quality cap
the entire scene at 4/8/6 billboard quads in one batch (at most 16 triangles).
Source selection is stable and frame work is bounded by that cap. Hidden actors
are skipped. Breath writes no depth or shadows, accepts no pointer events and
adds no audio. Reduced motion suppresses breath while retaining static frost.
Hidden/offscreen scenes release the animation lease, frozen fixtures use the
shared fixed clock without a breath lease, and unmount disposes batch resources,
releases source registrations and clears frost/profile state.

Validation:

- `pnpm --filter @gredice/game exec tsx --import ./scripts/register-test-assets.mjs --test src/scene/cold/coldWeather.unit.ts`
- `pnpm --filter garden exec playwright test --config playwright.season.config.ts tests/cold-weather.spec.tsx --workers=1`

The WebGL fixture combines 99 ground tiles, ten actors, a tree, autumn leaves,
a stool, and optional rain/snow. At high quality the cold layer adds exactly one
draw and 16 triangles over the same scene with cold effects unmounted; frost adds
no geometry. Captures and matrix/opacity readbacks cover frozen late autumn and
winter, warm/missing/stale inputs, quality, reduced motion, precipitation,
repeatability, offscreen suspension and unmount. This is a rendering-work budget,
not a hardware frame-rate claim.
