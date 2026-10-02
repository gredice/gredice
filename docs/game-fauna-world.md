# Fauna world

`packages/game/src/entities/animals/faunaWorld.ts` owns fauna presence and
debug state for one game root. Each `GameStateStore` creates one `faunaWorld`
and disposes it with the store, so two Canvas roots never share actors.

## Presence

Actors still report presence at their existing cadence
(`animalPresenceUpdateIntervalSeconds`, or the beach ball's 0.2 s cadence).
The report now writes into slot-stable packed storage (`x`, `y`, `z`,
`updatedAt`), not into the zustand store. Removed slots go on a free list, so
mount/unmount churn reuses storage and capacity grows only with the live actor
count.

Readers use one of two queries:

- `getSpeciesPresences(species)` returns a cached, id-sorted snapshot that is
  rebuilt only after that species reports or loses an actor. Per-frame
  neighbor reads (cow herd spacing, sheep flocking) no longer allocate when
  nothing changed.
- `queryPresences({ species, behavior, center, radius, now, maxAgeSeconds })`
  resolves spatial queries through a four-unit X/Z grid, then applies the
  exact 3D distance check. Avatar petting and beach-ball kicks use it.

Both keep the previous id ordering and freshness rules
(`freshAnimalPresences`, 3.5 s petting and 0.6 s beach-ball windows), so the
seeded target choices stay the same.

Cats and dogs no longer subscribe to presence or debug arrays through React.
They read dog, cat, and ground-bird state from the world only when they choose
a target, so a report from another animal no longer re-renders every cat and
dog.

## Debug snapshots

`reportDebug` keeps the latest entry per actor. The world publishes
`animalDebugEntries` to the store in one sorted batch at most every
`faunaDebugPublishIntervalSeconds` (0.5 s), and only when an entry changed
semantically. A report that changes only the timestamp does not publish.
Removals during unmounts coalesce into one trailing write. Previously every
actor copied and sorted the shared array with its own store write.

`getDebugEntries()` exposes the live entries for in-scene consumers that must
not wait for the HUD batch.

## Instrumentation

`window.__grediceGameProfile.faunaWorld` receives coalesced counters after
membership changes and debug publications: actor count, presence capacity,
presence reports and queries, snapshot rebuilds, debug reports, and published
versus skipped debug batches.

## Offscreen actors

Species previously disabled frustum culling on actor meshes (or relied on
bounds computed lazily from whatever pose the first test saw). Every actor was
therefore drawn and re-skinned even when far outside the camera.

`configureFaunaActorCulling` (through `useFaunaActorCulling`) re-enables
renderer culling for every non-instanced actor mesh. Each mesh gets an
object-level bounding sphere: its bind-pose geometry bounds scaled by
`faunaCullingBoundsScale` (1.75), so walking, hopping, and flapping poses stay
inside the sphere. Shared geometry bounds stay exact for raycasting. Three
applies the test to every camera and render pass, including outline masks and
static-cache captures, so there is no second visibility model to keep in sync.
Actor meshes do not cast shadow-map shadows; projected grounding shadows are
registered separately and are unaffected.

The helper also chains `onBeforeRender` to record whether the actor was
submitted. Cows, farm animals, rabbits, dogs, and birds call the returned check
once per frame and skip their rig pose functions while the actor was not
rendered. Behavior, pathing, movement, presence, and debug reports keep
running on absolute scene time, so an actor that returns to view is where its
simulation says it is. It shows its last pose for at most one frame inside the
culling margin, then resumes posing. The pose functions skipped are pure rig
writes, with no sounds, random draws, or runtime mutations. Species whose pose
work is interleaved with behavior or animation-mixer events keep posing and get
the render culling only.

`actorPoseUpdateCount` and `actorPoseSkipCount` in the `faunaWorld` profile
stats show how much pose work slept.

Hidden documents and offscreen canvases are still suspended by the runtime
scheduler, which consumes the clock gap on resume. Fauna therefore never
fast-forwards after a hidden period.

## Remaining work

Behavior, path, and movement loops still run in each species component under
its existing ambient render lease. Moving those loops onto a world fixed-step
with interpolation needs per-species behavior-parity fixtures, and per-species
instanced skinning should wait for fauna-heavy profiles to show draw pressure
after the culling above.
