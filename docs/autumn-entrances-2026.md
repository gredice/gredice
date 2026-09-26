# Autumn entrance decorations

Implementation for [#4966](https://github.com/gredice/gredice/issues/4966), release C / garden expansion. Supported wreath and garland compositions accompany a pumpkin-decorated variant of the existing wooden gate. #4981 owns optional future sway; #5000 owns publication.

![Supported wreath, garland and decorated gate beside an existing fence](autumn-entrances-2026/day-0.png)

## Art and editable sources

Inspected first-party references: [FenceGate](../apps/www/public/assets/blocks/FenceGate.webp) for the exact wooden gate, [Fence](../apps/www/public/assets/blocks/Fence.webp) for connections and material continuity, [HarvestPumpkinSquatOrange](../apps/www/public/assets/blocks/HarvestPumpkinSquatOrange.webp) for the original ribbed fruit, and the previously reviewed autumn leaf pile for broad warm foliage. The wreath has its own grounded post and a twig ring with sixteen folded leaves. The garland has two grounded posts, a draped cord and ten broad leaves. Solid backs prevent disappearing foliage from reverse views.

Each asset has its own editable Blender source. Wreath/garland split into fixed `Support` and `Foliage` meshes, with named part vertex groups and sway empties. `Material.AutumnEntrance.Timber` and `.Leaves` use roughness 0.90/0.93 and vertex colours. They remain static on all quality levels and do not mutate cached geometry/materials.

The gate copies the original first-party `FenceGate_Posts` and hinge-relative `FenceGate_Leaf` geometry and materials. Two ribbed pumpkins sit on fixed post caps, improving visibility in all four rotations. The leaf carries no new decoration. Unit tests compare the original and decorated post/leaf vertex and index arrays exactly and check pumpkin clearance at nineteen points across the entire 90-degree hinge sweep.

| Asset | Runtime bounds, width × depth × height | Declared hitbox | Triangles | GLB bytes | Meshes / materials / base draws |
| --- | --- | --- | --- | --- | --- |
| AutumnWreathPost | 0.5634 × 0.32 × 1.0117 | 0.9 × 0.9 × 1.05 | 920 | 83,200 | 2 / 2 / 2 |
| AutumnGarland | 0.80 × 0.25 × 0.90 | 0.9 × 0.9 × 0.95 | 696 | 65,340 | 2 / 2 / 2 |
| AutumnFenceGate, closed | 1.0376 × 0.1788 × 0.7341 | 1.05 × 1.05 × 0.80 | 1,972 | 149,908 | 3 / 3 / 4 |

Gate primitives: 88 post triangles, 364 leaf/hardware and 1,520 pumpkins. The original wood/hardware materials retain their existing properties; the pumpkin palette is matte roughness 0.90. Three GLTF meshes become four runtime draws because the leaf has two materials. No textures, lights, particles, sound or new idle render leases are added. Counts describe structural cost, not device frame rate.

All footprints remain **1×1**, nonstackable and not placeable on water, with compatible ground/path/display support. The gate follows its existing hinge convention, at local X −0.43 and open rotation −π/2. Its open leaf extends to local Z 0.86, as the plain gate does; the open overall depth is 0.9494. The wider 1.05 closed hitbox contains the post-cap fruit. Wreath and garland retain ordinary 0.9 horizontal hitboxes.

## Runtime contracts

`AutumnFenceGate` uses `FenceGate`, `useBlockVariant`, deferred click handling and persisted variants 0/1. It is registered in the fence topology and avatar/animal movement families. Tests cover closed blocking/open passage and compare its connection shape to the plain gate for every orientation and neighboring fence family. Existing fence spans end at the gate posts; the gate does not add connecting rails through the opening.

The fixed pumpkin mesh ignores pointer rays. Its snow/rain overlays also ignore rays through an optional `raycast` prop added to the shared overlay components; default behavior for other consumers is unchanged. Browser tests assert zero decorative ray hits in dry, rainy and snowy views. Gate posts/leaf still receive normal input. The sandbox test uses the production variant hook, verifies animated opening/closing and remounts from persisted local storage to confirm reload behavior. No network writes are allowed in the review fixture.

Wreath sway root is `[0,0.73,-0.07]`; garland roots are `[-0.34,0.84,-0.07]` and `[0.34,0.84,-0.07]`, in base-centred Y-up coordinates. Exported empties match shared metadata. The `AutumnEntrance:foliage:<id>` group marks the approved future motion role; the fixed supports and gate are excluded. A tested 0.025-tile displacement reserve stays inside each ordinary tile. #4981 must use the shared clock/wind and respect quality, reduced motion, visibility and immutable cached materials. No sway is active here.

## Catalogue and reproduction

Proposed labels/prices: **Jesenski ulaz – vijenac na stupu** (45 sunflowers), **Jesenski ulaz – girlanda na nosačima** (55), **Jesenski ulaz – vrata s bundevama** (75). Shared metadata drives the picker, sandbox and offline draft importer. Copy distinguishes supported decoration from the interactive gate and grants no resources or rewards. Missing catalogue entries stay hidden.

The 4×4 scene places the three new entities beside an existing fence, mushrooms and stone in a 2×3 corner, preserving a connected approach to a real crop bed. Four closed day/night rotations, four open-gate rotations, cloudy/dusk/rain/snow, small low-quality view and four raised placements cover readability, supports, picking and crop access. All 17 scene images and catalogue cover/top-down views were visually reviewed.

Scene date: September 23, 2026 Europe/Zagreb, noon/22:30 or shared dusk 0.8; fixed animation time 12 seconds; camera `[-100,100,-100]`, zoom 90, 680×520/DPR 1. Small view: 390×440/zoom 57. Night snapshots allow 20 star pixels; precipitation receives visual review. Catalogue previews use October 22 noon.

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python assets/scripts/generate-autumn-entrances.py
pnpm generate:game-assets
pnpm --dir apps/garden exec playwright test --config playwright.autumn-entrances.config.ts
pnpm --filter @gredice/game test
pnpm --filter @gredice/storage exec tsx scripts/upsertAutumnEntrancesDraft.ts
```

Set model versions from the first twelve SHA-256 characters. Restore unrelated full-export rewrites before final model types and before rendering: regenerated legacy GLBs can temporarily use incompatible node names. Render the three names from shared metadata with `BLOCK_SNAPSHOT_FREEZE_TIME=2026-10-22T12:00:00+02:00`, copy top-down `_1.webp` to the unnumbered image and run `packages/game/scripts/build-autumn-entrances-release.ts` with game-package `tsx`.

The [release manifest](autumn-entrances-2026/release-manifest.json) records exact source/model/image hashes, versioned URLs, costs and unpublished metadata. The importer defaults offline; explicit writes only prepare drafts. #5000 requires matching-SHA Garden/WWW deployments, asset byte/price readback, draft creation/readback, publication, catalogue IDs and real purchase/place/rotate/reload acceptance. No live writes occurred.

## Validation

Source audits, full asset generation, all 24 final preview views, thirty-image transparency and release hashes pass. All **1,960 game unit tests** and **28 browser cases** pass. Game/JS/changed-app-file lint, game/Garden/WWW and scoped importer typechecks pass. Garden production build passes; WWW compiles/types but page-data collection requires unavailable `POSTGRES_URL`, so its full build remains unverified. Offline draft plan and diff checks pass. Deployment and authenticated purchase acceptance remain with #5000.
