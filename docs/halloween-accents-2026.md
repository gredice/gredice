# Friendly ghost and supported cobweb (#4970)

Two optional decorations extend the autumn set without changing the broad autumn collections: `FriendlyGhost` (Dobroćudni duh, 45 sunflowers) and `SupportedCobweb` (Paučina na drvenom okviru, 30 sunflowers). Both occupy one tile with a 0.9 square hitbox, height 1, cannot support other blocks and cannot be placed on water. Owned items remain usable all year.

First-party references inspected: GardenScarecrow for its friendly readable face and visible support, DeadTreeTall for timber and angular silhouettes, WhiteFence for simple authored framing. The ghost has a folded opaque sheet, small round eyes, curved smile and wooden stand. The cobweb uses a quarter-fan of solid strands attached to an L-shaped wooden frame and base. No third-party geometry, textures or transparent planes are used. Named vertex groups preserve editable construction parts in each Blender source. `assets/scripts/generate-halloween-accents.py` regenerates both; `-- --check` audits saved sources.

| Model | Triangles | GLB bytes | Meshes / materials |
| --- | ---: | ---: | ---: |
| FriendlyGhost | 468 | 47,100 | 1 / 1 |
| SupportedCobweb | 596 | 55,884 | 1 / 1 |

Both are lazy-loaded, opaque, nonmetallic and untextured, with baked vertex colors and one base mesh draw per item. There are no new lights, animation loops or fauna registrations. Existing snow and rain overlays follow weather visualization switches. Empty cells between web strands pass raycasts through; there is no invisible picking surface or transparent overdraw.

The 4×4 review fixture reuses DeadTreeTall, WhiteFence and the production Bats component, plus a bench, lantern and real crop bed. Night readiness checks visible bat meshes; live bat motion and weather particles are recorded as review captures rather than static pixel assertions. Ground and raised-support rotations verify real geometry picking, neighboring controls and crop interaction. The raised fixture moves the bench aside to keep its tested surface visible above the taller supported props.

Validation: four asset/catalogue/placement tests, 23 browser cases, sixteen preview renders, game/Garden/WWW typechecks, scoped importer typecheck/offline plan and lint. All 13 scene captures were inspected; all 20 cover/top-down files have transparent backgrounds. Exact source/model/preview hashes and metadata are recorded in `docs/halloween-accents-2026/release-manifest.json`.

Publication remains gated by #5000: reviewed Garden/WWW deployment SHA, model/image/price readback, draft catalogue creation/readback, publishing, then authenticated purchase/place/rotate/reload. No live database writes or deployment were performed.
