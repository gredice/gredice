# Open tray bird feeder (#4968)

Original Gredice decoration: an open octagonal tray, two broad perches and a cross-foot pedestal. Its shallow uncovered silhouette differs from the existing BirdHouse's enclosed room, pitched roof and diagonal feet. One tile, 0.85 high, 0.9 square hitbox, 45 sunflowers, non-stackable and not placeable on water.

First-party art references inspected: BirdHouse for the contrasting enclosed silhouette and timber; SeedDryingRack for the shallow tray and simple support; GardenTeaTable for the restrained warm palette. No external geometry or textures. The source is `assets/game-assets/BirdFeeder.blend`; `assets/scripts/generate-bird-feeder.py` regenerates it and `-- --check` audits the saved source. Named vertex groups retain editable construction parts.

The GLB has one opaque rough material, one mesh, 496 triangles, 47,608 bytes and bounds 0.82 × 0.82 × 0.835. Baked vertex colors distinguish feet, post, bowl and decorative seed shapes. No animations, lights, transparent surfaces, wind, food inventory or actor registration are added. The production bird system still creates habitats only from BirdHouse: the feeder has the same generic perch eligibility as other solid decorations for birds that already exist, with no attraction bonus or extra actors.

`BirdFeeder` uses the shared stack height, animated rotation, snow and wet-surface helpers. Weather visualization switches disable both overlays. The offline/draft importer and local sandbox share Croatian catalogue data from `packages/js/src/birdFeeder`; production picker availability follows the published directory response.

The fixture places the feeder and BirdHouse together in a 4×4 garden with a real crop bed, lantern and connected approach. Review includes four day/night rotations, cloudy/dusk/rain/snow, a small low-quality canvas, four raised-support rotations, real geometry picking, neighboring props and the crop action. Covers and top-downs have all four rotations. Release hashes and measured GLB cost are in `docs/bird-feeder-2026/release-manifest.json`.

Validation passed: three focused GLB/catalogue/placement tests, 21 browser cases, eight preview renders, game/Garden/WWW typechecks, scoped importer types and its offline plan, plus package/scoped lint. All 13 review captures and the preview images were inspected; all ten cover/top-down files have transparent backgrounds.

Publication remains gated by #5000: exact reviewed/merged Garden and WWW deployment SHA, model/image/price readback, draft creation/readback, CMS publish, recorded catalogue ID, and authenticated purchase/place/rotate/reload. No live database writes, deployment, catalogue publication or production purchase are claimed.
