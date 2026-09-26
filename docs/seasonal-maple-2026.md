# Compact seasonal maple (#4967)

Original Gredice maple-inspired decoration: a narrow forked trunk, five stepped crown lobes, and broad, folded five-point blades. One tile, 1.81 high, 0.9 square hitbox, 85 sunflowers, non-stackable, no water placement or crop output. Croatian catalogue data lives in `packages/js/src/seasonalMaple`; the importer defaults to an offline plan and only creates unpublished drafts with an explicit database flag.

## Art and source

Inspected first-party covers: Tree (simple trunk and leaf mass), AutumnShrub (flat facets and warm leaf palette), DeadTreeTall (readable forked branches), AutumnGrassTuft (broad pointed leaves). The new silhouette has a tapered, layered crown and original lobed blades; no external geometry or textures were used. `assets/scripts/generate-seasonal-maple.py` creates the editable `SeasonalMaple.blend`; `-- --check` audits it without rewriting.

Export through `pnpm generate:game-assets`. The GLB contains Wood and three mutually exclusive Full/Thinning/Sparse meshes, two rough opaque materials, no textures, lights or animations. Total stored geometry: 1,240 triangles, 122,024 bytes. Visible geometry: 680 / 560 / 440 triangles and two base draw calls per maple; enabled rain and snow overlays add bounded passes. Actual bounds are 0.8172 × 0.8592 × 1.8 (X/Z/Y), base exactly on its support plane. Covers and top-down images include all four rotations.

## Shared seasonal contracts

`SeasonalMaple` consumes `useAutumnState`, `getAutumnCanopyStage`, `getAutumnPaletteSeed` and the existing crown-to-bottom `useAutumnFoliageGeometry` hook. It does not introduce a clock or a calendar. Spring regrowth starts green using the shared season, while retention continues along the shared regrowth curve. The geometry hook owns and disposes its clones; the loaded GLTF remains unchanged. Full foliage returns when either the per-entity or global weather switch disables visualization. Snow and wet overlays obey both switches. Shadow invalidation includes the maple's retention stage.

One source registers with `AutumnSources` while mounted and enabled, and unregisters on disable/unmount. Its anchor is 0.5 above the support plane, matching the shared sampler. The existing scene-wide `AutumnLeaves` pool handles frustum filtering and the combined mixed-tree budget (24 leaves low, 160 high). No emitter, per-frame React state, light, actor or sound is added per tree. Crown sway is deliberately static.

## Review and validation

`packages/game/tests/SeasonalMapleFixture.tsx` uses the existing shared seasonal review dates. The 4×4 garden has ground/table maples, a per-item disabled maple, an existing bush, a real crop bed and a connected approach. Browser checks exercise four day/night rotations, summer, early/late autumn, winter, three spring stages, rain, snow, global disable and return, low quality, real geometry picking, crop UI access and immutable cached assets. A separate 64-tree mixed grove checks the shared leaf cap and records draw/triangle counts on low/high quality. Source/GLB, bounds, support stacking, pricing and release hashes are unit checked.

Reproduce browser captures with `GREDICE_GARDEN_CT_PORT=3197 pnpm --dir apps/garden exec playwright test --config playwright.seasonal-maple.config.ts`. Add `--update-snapshots` only when intentionally reviewing new visual baselines. Review images are in `docs/seasonal-maple-2026/`; the release manifest records model, source and image hashes.

Verified checks: 1,963 game unit tests; game, Garden and WWW typechecks; scoped draft-importer types and offline plan; game/JS/scoped Biome; eight public preview renders; 26 browser cases. A visual review corrected spring regrowth to green and the four affected transition cases were rerun. The full mixed grove (32 maples + 32 existing trees, plus the three review maples) measured high: 223 draws / 113,610 triangles / 160 leaves; low: 93 draws / 49,404 triangles / 24 leaves. These are frozen-scene render counters, not frame-time or device FPS measurements. Capture fixtures render on demand to avoid unnecessary background GPU work.

## Publication gate

Publication remains in #5000. No database writes, catalogue publishing, purchase or production deployment are claimed. Before publishing, verify the reviewed/merged commit is READY in Garden and WWW, read back exact model/image bytes and price, create/read back a draft, publish through CMS, record the catalogue ID and validate an authenticated purchase/place/rotate/reload flow. Owned items are available all year.
