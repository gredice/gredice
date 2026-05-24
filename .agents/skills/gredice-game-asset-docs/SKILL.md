---
name: gredice-game-asset-docs
description: Document Gredice garden game, 3D scene, generated assets, model exports, sprite atlases, performance profiling, quality tiers, canvas behavior, game asset source files, and verification workflows in apps/garden, packages/game, packages/cdn, assets, or docs/game-scene-performance.md.
---

# Gredice Game Asset Docs

## Overview

Keep game and asset documentation accurate to the actual source, generated outputs, and profiling commands. Distinguish source assets from generated artifacts.

## Ownership Map

Primary files and directories:

- Garden app: `apps/garden`.
- Game runtime package: `packages/game`.
- Game scene root: `packages/game/src/GameScene.tsx`.
- Game quality policy: `packages/game/src/scene/gameQuality.ts`.
- Source Blender assets: one file per asset under `assets/game-assets`.
- Game asset manifest: `assets/game-assets.json`.
- Blender version marker: `assets/BLENDER_VERSION`.
- Source brand/game texture examples: `assets/GredicePixPal_BaseColor.png`, `assets/brand/gredice-logotype.svg`.
- Export scripts: `assets/export.sh`, `assets/export.ps1`.
- Blender split/export helpers: `assets/split-game-assets.py`, `assets/export-game-assets.py`.
- Generated GLBs: one file per asset under `apps/garden/public/assets/models`.
- Generated runtime asset manifest: `packages/game/src/data/gameAssetModels.generated.ts`.
- Generated model types: `packages/game/src/models/GameAssets.tsx`.
- CDN asset scripts: `packages/cdn/scripts`.
- Performance doc: `docs/game-scene-performance.md`.

## Asset Pipeline

Document this pipeline exactly when it is relevant:

1. Edit source assets under `assets/game-assets` and update `assets/game-assets.json` when adding, removing, or reprioritizing assets.
2. Run:

```bash
pnpm generate:game-assets
```

3. The script exports split GLBs to `apps/garden/public/assets/models`.
4. The script runs model metadata/type generation for `packages/game/src/data/gameAssetModels.generated.ts` and `packages/game/src/models/GameAssets.tsx`.
5. Review generated output and only commit generated artifacts when the source change requires them and they are established tracked outputs.

If the steps need to run separately:

```bash
cd assets
./export.sh
cd ..
pnpm generate:models-types
```

On Windows, use `assets/export.ps1`. Blender must be installed where `WORKSPACE.md` documents it. To recreate the split Blender sources from an older monolithic source, run Blender with `assets/split-game-assets.py` and pass `-- --source /path/to/GameAssets.blend`.

## Decoration Sprite Atlas

The decoration atlas pipeline lives in `packages/cdn/scripts` and writes runtime sprite assets under `apps/garden/public/assets/sprites/decorations`.

Document this command when atlas assets change:

```bash
pnpm --filter @gredice/cdn run regenerate-cdn:decoration-atlas
```

Keep sprite names stable. The manifest uses relative input paths as sprite IDs.

## Performance Documentation

Use `docs/game-scene-performance.md` as the current performance narrative. When updating it:

- Date new measurements.
- State whether numbers come from dev, production build, headless Playwright, or a real device.
- Prefer repeated production profiling for budget decisions.
- Record canvas backing size, reported DPR, quality tier, draw calls, triangles, FPS, long tasks, and budget pass/fail when available.
- Separate source asset complexity from runtime render policy.
- Identify whether changes affect shadows, DPR caps, particles, overlays, decorations, plant LOD, frame loops, or app-level providers.

Relevant profiling commands currently documented by the garden app:

```bash
cd apps/garden
pnpm run profile:game
pnpm run profile:game:ci
pnpm run profile:game:existing
pnpm run profile:game:start
```

Useful overrides:

```bash
GAME_PROFILE_BASE_URL=http://localhost:3001 pnpm run profile:game:existing
GAME_PROFILE_WARMUP_MS=8000 GAME_PROFILE_SAMPLE_MS=10000 pnpm run profile:game
GAME_PROFILE_FAIL_ON_BUDGET=1 pnpm run profile:game
```

## Visual Verification

When docs claim visual behavior, verify with a browser or screenshots:

- Garden app: `https://vrt.gredice.test`.
- Debug/profile routes when available under `apps/garden/app/debug`.
- Check desktop and mobile viewports when layout, canvas framing, or touch interaction is involved.
- Confirm the canvas is nonblank and the referenced assets render.

## Validation

Use targeted checks:

```bash
pnpm build --filter garden
pnpm test --filter garden
pnpm lint --filter @gredice/game
pnpm generate:game-assets
pnpm --filter @gredice/cdn run regenerate-cdn:decoration-atlas
git diff --check
```

Do not hand-edit generated model output unless the generator is broken and the temporary nature of the change is explicitly documented.
