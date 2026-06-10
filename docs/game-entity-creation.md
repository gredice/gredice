# Game Entity Creation

Use this guide when adding a new placeable garden game entity from a model file,
especially a purchasable decoration or tool that must appear in the game,
public block pages, generated block images, and the directories database.

## Scope

A complete entity add usually spans these surfaces:

- Source model: `assets/game-assets/<EntityName>.blend`
- Asset manifest: `assets/game-assets.json`
- Generated GLB: `apps/garden/public/assets/models/<EntityName>.glb`
- Generated model registry and types:
  `packages/game/src/data/gameAssetModels.generated.ts` and
  `packages/game/src/models/GameAssets.tsx`
- Runtime component: `packages/game/src/entities/<EntityName>.tsx`
- Entity registry: `packages/game/src/entities/entityNameMap.ts`
- In-game picker: `packages/game/src/hud/ItemsHud.tsx`
- Garden picker test fixture: `apps/garden/tests/ItemsHudStory.tsx`
- Public block PNGs: `apps/www/public/assets/blocks/<EntityName>*.png`
- Directory CMS entity row and attributes in `packages/storage`

## Setup

Use real secrets only when the task requires live database or API writes.

```bash
pnpm bootstrap
```

`pnpm bootstrap` links apps, pulls env files, and verifies local tools such as
Blender and Playwright. Do not run `pnpm db-push`; entity rows use the existing
CMS schema and do not require schema changes.

## Source Model

1. Download the model from the task source, for example a Linear attachment.
2. Save it as `assets/game-assets/<EntityName>.blend`.
3. Inspect object names in Blender and rename them to stable, entity-prefixed
   names such as `WateringCan_Body` and `WateringCan_Handle`.
4. Assign real materials in Blender when possible. Keep runtime materials in the
   React component when weather overlays, seasonal variants, or animated
   surfaces need code control.
5. Add special meshes directly to the source file. For water, create a simple
   flat surface inside the container and name it `<EntityName>_Water`.

For a water surface, follow the bucket/watering-can pattern: render the water
mesh separately in the entity component with `MeshDistortMaterial`,
`transparent`, `depthWrite={false}`, and a low `distort` value.

## Asset Export

Add the asset to `assets/game-assets.json` with every exported object name:

```json
{
    "name": "WateringCan",
    "source": "WateringCan.blend",
    "output": "WateringCan.glb",
    "preload": "lazy",
    "objects": [
        "WateringCan_Body",
        "WateringCan_Handle",
        "WateringCan_Water"
    ]
}
```

Run the generator from the repo root:

```bash
pnpm generate:game-assets
```

Review the generated diff. Keep the new GLB and generated TypeScript outputs.
If Blender rewrites unrelated existing GLBs with no intended source change, do
not include those unrelated binary changes.

## Runtime Entity

Create `packages/game/src/entities/<EntityName>.tsx`.

Recommended component shape:

- Load the GLB with `useGameGLTF('<EntityName>')`.
- Type node name arrays with `Extract<keyof GLTFResult['nodes'], '<EntityName>_${string}'>`.
- Position with `useStackHeight(stack, block)` and preserve
  `useAnimatedEntityRotation(rotation)`.
- Group meshes by material role, for example body, trim, dark details, and
  water.
- Add `SnowOverlay` and `RainWetOverlay` to solid meshes when the item is
  visible outdoors.
- Keep a stable scale and shadow behavior that matches neighboring assets.

Then register the component in:

- `packages/game/src/entities/entityNameMap.ts`
- `packages/game/src/hud/ItemsHud.tsx`
- `apps/garden/tests/ItemsHudStory.tsx`

The name used in code, the asset manifest, generated model registry, and the
database `information.name` attribute must match exactly.

## Public Block Images

Public block cards use 640x640 WebP images in `apps/www/public/assets/blocks`.
Generate all four rotations plus the unsuffixed base image.

For an entity that is not available from the production directories API yet,
create a temporary ignored `apps/www/generate/test-cases.json` with just that
entity shape. Include at least:

- `information.name`
- `information.label`
- `attributes.height`
- `attributes.type`
- `attributes.stackable`
- `prices.sunflowers`

Run the focused generator from `apps/www`:

```bash
pnpm exec playwright test --config playwright-generate.config.ts generate/blocks-snapshots.specgen.tsx -g <EntityName>
```

`apps/www/generate/blocks-snapshots.specgen.tsx` routes
`https://vrt.gredice.com/assets/models/*.glb` to the local
`apps/garden/public/assets/models` directory, so new assets can render before
they are deployed. The temporary `generate/test-cases.json` file is an input
only and should not be committed.

Check the generated PNGs visually. If a transparent snapshot includes sky,
sun, moon, or other environment artifacts, fix the viewer or environment
behavior before committing the images.

## Database Entity

Directory entities use the existing CMS tables:

- `entities`
- `attribute_values`
- `entity_revisions`
- `attribute_definitions`

Prefer the admin UI or repository helpers when practical:

- `createEntity(entityTypeName, actor)`
- `upsertAttributeValue(attributeValue, actor)`
- `updateEntity(entity, actor)`

These helpers create revision rows, bust directory caches, and refresh search
documents. If an ad hoc script is necessary, preserve those side effects
explicitly. Some repository helpers import `server-only`, so standalone scripts
may need to run through an app/runtime path or use lower-level `storage` and
schema imports with deliberate cache/search handling.

For a purchasable decoration/tool block, create a published `block` entity with
these attributes:

| Attribute path | Notes |
| --- | --- |
| `information.name` | Stable code/model id, for example `WateringCan`. |
| `information.label` | Croatian user-facing name. |
| `information.shortDescription` | Short public summary. |
| `information.fullDescription` | Longer public block-page copy. |
| `attributes.height` | Numeric height used by public snapshot framing. |
| `attributes.stackable` | Usually `false` for standalone decorations. |
| `attributes.type` | Usually `decoration` for purchasable garden props. |
| `prices.sunflowers` | Sunflower price, for example `80`. |
| `functions.recycler` | Usually `false`. |
| `functions.raisedBed` | Usually `false`. |

Publish by setting `state = 'published'` and `publishedAt = now`. Verify through
the directories API or a direct DB query that the row appears in
`/entities/block` with the expected `information.name`, label, type, and price.

## Validation

Use the narrowest reliable checks, then include consumer typechecks because
`@gredice/game` is shared by `garden` and `www`:

```bash
pnpm lint --filter @gredice/game
pnpm typecheck --filter @gredice/game
pnpm test --filter @gredice/game
pnpm typecheck --filter garden
pnpm typecheck --filter www
git diff --check
```

Run app lint when app files changed. Run `pnpm build --filter garden`,
`pnpm build --filter www`, or the app Playwright suites only when routing,
static assets, bundling, production-only code paths, visual behavior, or user
flows changed. Run `pnpm test --filter www` when public route behavior changed
or when there is time for the broader suite. It may depend on local API services
and can emit proxy noise if `api` is not running; record the exact failure if it
does not pass.
