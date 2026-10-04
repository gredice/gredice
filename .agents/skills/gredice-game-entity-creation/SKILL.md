---
name: gredice-game-entity-creation
description: Use for adding/updating Gredice game entities from Blender/GLB assets through runtime registration, shop rows, snapshots, and validation.
---

# Gredice Game Entity Creation

## Overview

Use this skill for the complete path from model asset to purchasable in-game
block. Read `docs/game-entity-creation.md` when you need the full checklist or
exact command details.

## Workflow

1. Confirm setup. If live DB/API writes are required, run `pnpm bootstrap` from
   the repo root to pull real env files and verify Blender/Playwright. Do not
   run `pnpm db-push`.
2. Add the source model as `assets/game-assets/<EntityName>.blend`. Inspect the
   Blender file, give objects stable `<EntityName>_*` names, assign useful
   materials, and add special meshes such as `<EntityName>_Water` directly in
   the source file.
3. Register the asset in `assets/game-assets.json`, including every exported
   object. Use `preload: "lazy"` for ordinary decorations/tools unless an
   existing nearby asset needs a different preload group.
4. Run `pnpm generate:game-assets`. Keep the new GLB under
   `apps/garden/public/assets/models` and the generated model registry/type
   updates. Avoid committing unrelated rewritten GLBs.
5. Create `packages/game/src/entities/<EntityName>.tsx`. Use `useGameGLTF`,
   `useStackHeight`, and `useAnimatedEntityRotation`; group meshes by material
   role; add `SnowOverlay`/`RainWetOverlay` for outdoor solid surfaces; render
   water with a transparent `MeshDistortMaterial`.
6. Register the runtime entity in `packages/game/src/entities/entityNameMap.ts`
   and expose it where users can place it, usually `packages/game/src/hud/ItemsHud.tsx`.
   Update `apps/garden/tests/ItemsHudStory.tsx` mocks so the picker can render.
7. Generate public block PNGs with the `apps/www` Playwright generator. For a
   new entity not yet in the production directories API, create a temporary
   ignored `apps/www/generate/test-cases.json` containing only that block and
   run:

```bash
pnpm --dir apps/www exec playwright test --config playwright-generate.config.ts generate/blocks-snapshots.specgen.tsx -g <EntityName>
```

8. Add or update the `block` directory entity for the shop. Prefer admin UI or
   storage repository helpers so revisions, cache busting, and search refreshes
   happen. If using an ad hoc script, preserve those side effects deliberately.
   For purchasable decorations/tools, set matching `information.name`,
   Croatian label/descriptions, `attributes.type = decoration`,
   `attributes.stackable = false`, `prices.sunflowers`, and publish the entity.
9. Verify the directories API or DB row returns the expected name, label, type,
   published state, and sunflower price.

## Important File Map

- Source assets: `assets/game-assets`
- Asset manifest: `assets/game-assets.json`
- Exported GLBs: `apps/garden/public/assets/models`
- Generated model data: `packages/game/src/data/gameAssetModels.generated.ts`
- Generated GLTF types: `packages/game/src/models/GameAssets.tsx`
- Runtime entities: `packages/game/src/entities`
- Entity registry: `packages/game/src/entities/entityNameMap.ts`
- Place-item HUD: `packages/game/src/hud/ItemsHud.tsx`
- Public block snapshots: `apps/www/generate/blocks-snapshots.specgen.tsx`
- Public block images: `apps/www/public/assets/blocks`
- Entity DB schema/repositories: `packages/storage/src/schema/cmsSchema.ts`,
  `packages/storage/src/repositories/entitiesRepo.ts`, and
  `packages/storage/src/repositories/attributeValuesRepo.ts`

## Validation

For `@gredice/game` entity work, validate the package plus `garden` and `www` typechecks. Run the focused snapshot generator and inspect the PNGs. Add app lint/build/Playwright or `www` tests only when the changed app surface, routing, static assets, production behavior, visual behavior, or public routes require them. Docs-only changes need `git diff --check`.
