# Game scene manifests and resource lifetimes

The main garden scene loads the GLBs its garden actually renders and keeps
decoded GLTF resources inside explicit lifetimes. Code lives in
`packages/game/src/scene/resources/`.

## Scene manifest

`createGardenSceneManifest` turns block names into a versioned manifest
(`gardenSceneManifestVersion`):

- `assets`: exact GLBs with a load priority, sorted and deduplicated.
- `families`: specialized fauna renderers whose habitat blocks are present.
- `shaderVariants`: `water-surface` and `generated-plants` program families.
- `unknownBlockNames`: blocks without a renderer, for drift diagnostics.
- `key`: stable content key; equal keys describe identical load work.

`blockAssetRequirements` is typed against every `entityNameMap` key, so adding a
renderable block without declaring its GLBs fails typechecking.
`faunaFamilyRequirements` lists each family's habitat blocks and model. The
displayed garden's manifest is built from retained chunk `assetUsage` (see
[game-retained-chunks.md](./game-retained-chunks.md)), so placements reuse the
manifest unless the set of block types changes. The incoming garden's manifest
is built from its raw stacks while the switch fades.

Fauna and optional block states (for example the harvest basket) are `idle`.
Without details (`renderDetails` off or far zoom) the manifest has no fauna.
Cats, dogs, frogs, chickens, and piglets mount only when their manifest family
is present. The other families already return before fetching when their
habitat resolver finds nothing.

Instanced renderers that used to load their GLB before checking for
instances now mount behind `EntityBlockPresenceGate`. This covers ground,
raised bed, shade, fence, garden box, watering can, water well, bird house,
cat pillow, gift box, dead tree, tree canopy, and bush canopy instances, plus
the raised-bed mulch overlays.

`GameSceneWrapper` no longer preloads the ground and primary GLB buckets. An
empty garden fetches no game models, and a minimal garden fetches only the
terrain it renders. `PlantViewer` and `PlantEditor` still preload the ground
bucket for their fixed preview scenes.

## Load order

`mergeGardenSceneLoadPlan` merges the displayed (`current`) and incoming
(`transition-next`) manifests. `GameAssetLoadScheduler` runs that plan:

1. Current requests start first, up to four in parallel.
2. Transition-next requests wait until no current request is in flight.
3. Idle requests start one at a time from `requestIdleCallback` (2 s timeout,
   `setTimeout` fallback), only when no other request is in flight.

A new plan cancels queued requests that are no longer needed. In-flight loads
cannot be aborted, so their completions are counted as stale and the resource
cache decides how long they stay. Failed requests count as settled and are not
retried for that scheduler. Loading pauses on `pagehide`, while the document is
hidden, and while the WebGL context is lost.

Prefetching reads the same drei/suspense cache that `useGameGLTF` uses, so a
prefetch and a mounted renderer share one fetch and one decoded GLTF. Renderers
on screen still suspend and fetch their own GLBs right away, so the current
scene is never held back by the scheduler.

## Lifetimes

`GameResourceCache` is shared by every game root:

- Each mounted `useGameGLTF` consumer holds a reference. Referenced resources
  are never evicted.
- `GardenSceneResourceController` pins every required (non-idle) asset of the
  displayed and incoming manifests. Pinned resources are never evicted, so a
  garden switch never drops an asset either side needs.
- Unreferenced, unpinned resources stay for a 30 s grace period. After that,
  they are evicted least recently used first while idle bytes exceed the 24 MiB
  budget. Total memory therefore levels off at the referenced bytes plus the
  budget during repeated switching between different gardens.
- Eviction clears the drei loader cache entry and then disposes the GLTF's
  geometries, materials, and textures. The next consumer decodes a fresh copy.
- Eviction is deferred while the document is hidden or the context is lost.

Bytes are estimated from geometry attribute and index buffers, plus RGBA8
texture uploads with a mip chain where enabled. The retained-chunk mesh
compiler worker keeps its existing refcounted lease (`useCompiledChunk`).

## Context loss and lifecycle

On `webglcontextlost`, three.js keeps CPU copies of geometry and textures.
The controller pauses loading and eviction. On `webglcontextrestored`, it
resumes and requests a render. three.js then re-uploads geometry, textures,
and programs lazily on the next frame, without remounting the Canvas DOM node.

`GardenSceneLifecycle` reports one state per displayed garden:

- `loading`: current-priority assets are not resident yet.
- `first-nonblank-frame`: the first frame submitted after they became
  resident (never while the context is lost).
- `interaction-ready`: after that frame, once the switch transition has
  finished.

Each garden switch restarts the timing. The state is written to
`canvas.dataset.gardenSceneLifecycle`. Snapshots are published to
`window.__grediceGameProfile` as:

- `gardenSceneLifecycle`
- `gardenSceneManifest`
- `sceneAssetLoads`
- `sceneResourceCache`

## Adding an entity

Add the new block to `entityNameMap` and to `blockAssetRequirements`, using
the GLBs its renderer passes to `useGameGLTF`. If it spawns or attracts a
fauna family, add the block to that family's habitats in
`faunaFamilyRequirements`.
