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
membership changes, debug publications, and at most once per scene second of
reports: actor count, presence capacity, presence reports and queries,
snapshot rebuilds, debug reports, published versus skipped debug batches, and
actors whose last record was removed.

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

## Shared simulation and rendered poses

`FaunaRuntimeProvider` owns one retained dispatcher per Canvas. All current
species and the beach ball register their existing behavior/path/movement
callbacks with `useFaunaFrame`. Registration order stays stable across React
updates, and unmount removes the callback and its retained transform buffers.
No callback adds a render lease, timer, or worker: the existing semantic fauna
owners and SceneTime visibility policy admit frames.

Simulation uses the existing 30 Hz ambient cadence in every quality profile.
It has one stopped clock facade per root, exposing each fixed step's absolute
scene time without changing R3F's render clock. A dropped frame has bounded
movement work while absolute cooldowns and deadlines remain current. Resume
discards accumulated movement work; SceneTime already excludes hidden wall
clock gaps and bounds the first resumed frame.

Actor root position, quaternion, and scale have retained previous/current
simulation snapshots. Rendered frames interpolate them with at most one
simulation step of latency. Simulation restores its authoritative transform
before making the next decision, so interpolation never feeds back into
pathfinding, herd spacing, random choices, or collision physics. Placement and
external effect changes reset the snapshots; first mounts and large teleports
snap to their destination. The ball retains its motion and rolling-child
transforms separately.

`useFaunaAnimations` keeps lazy clip bindings and disposable mixers in a
central animation phase. The squirrel retained mixer joins this same phase.
Every registered mixer runs before every manual pose, including actors mounted
after the scene starts. `useFaunaRenderFrame` keeps rig posing, projected
grounding shadows, and visual/debug consumers on the actual rendered cadence,
including 60 Hz interaction. Simulation runs at R3F priority -100, the central
mixer/manual-pose phase at -25, and the grounding-shadow batch at -10. These
negative priorities preserve automatic rendering. Cow and farm gait distances
use the same interpolation fraction as their root transforms. Presence is
published from authoritative fixed-step transforms; debug and shadow views use
rendered transforms. Renderer culling and the existing pure-pose sleep checks stay
in place. Population deadlines, spawn functions, species counts, sounds,
weather policies, homes, and behavior helpers are unchanged.

The profiler exposes `faunaSimulation`: registered simulation/visual callback
counts, fixed-step count, and rendered-frame count. Reporting is coalesced to
one update per scene second.

## Validation contract

`faunaSimulation.unit.ts` verifies 30/60 cadence independence, smooth transform
interpolation, authoritative simulation inputs, semantic placement updates,
root isolation, registration cleanup, bounded dropped frames, and resume.
`faunaBehaviorParity.unit.ts` compares six-minute seeded decision/deadline
traces from the existing species behavior functions against direct legacy
30 Hz callbacks at both render cadences. The witnesses cover all animal
families, each farm species, day/night and bad-weather behavior, and avatar
attention/following. These domain traces do not substitute for real WebGL
movement/interaction/visual captures and the unchanged cross-tier performance
comparison. Existing species spawn, navigation, pose and lifecycle tests remain
required.

The Chromium WebGL `fauna-runtime.spec.tsx` witness uses a real moving clip,
then applies a manual bone pose and reads the grounding-shadow instance matrix
after the root submits a frame. It checks initial and late mounts, garden and
detail-toggle remounts, smooth gait/root samples, and suspension/resume of one
of two independent roots. The focused witness passed against the production
Scene providers. Local validation for this migration also passed the complete
2,038-test game suite, game and garden typechecks, and changed-file Biome checks.
The integrated production capture remains the evidence for performance and
real species trajectories; this fixture does not claim those measurements.

Per-species instanced skinning stays conditional on fauna-heavy profiles still
showing draw pressure after CPU centralization and actor culling. It changes
rendering architecture and needs its own measured justification.
