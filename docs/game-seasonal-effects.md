# Seasonal scene debugging

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
`Tree` alone opts into the colour curve. Its existing canopy material receives a
memoized HSL colour derived from the stable block ID; cached GLTF materials,
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
dense garden in wind at the shared mid-autumn fixture date on low/medium/high.
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
