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

Actor root position, quaternion, scale, and exact Euler representation/order have retained previous/current
simulation snapshots. Rendered frames interpolate them with at most one
simulation step of latency. Simulation restores its authoritative transform
before making the next decision. Preserving Euler state keeps yaw-only species
updates correct through turns past 90 degrees. Interpolation never feeds back into
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
use the same interpolation fraction as their root transforms. Their manual
poses retain time, damping delta, behavior, locomotion and gait together; the
visual sample advances monotonically with the presented root, while decisions
and deadlines keep absolute scene time. Mounts, placement teleports and resume
snap root, gait and pose together with bounded deltas. A moving-path restart
keeps the old gait at the old presentation sample and blends the shortest cycle
phase toward the new path. Presence is
published from authoritative fixed-step transforms; debug and shadow views use
rendered transforms. Renderer culling and the existing pure-pose sleep checks stay
in place. Population deadlines, spawn functions, species counts, sounds,
weather policies, homes, and behavior helpers are unchanged.

The profiler exposes `faunaSimulation`: registered simulation/visual callback
counts, fixed-step count, and rendered-frame count. Reporting is coalesced to
one update per scene second. Each active Canvas owns a snapshot; profile
counts sum the active roots, expose `rootCount`, remove a root's counters on
unmount and clear the snapshot when the last root leaves.

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
The integrated production capture remains the evidence for performance; the
phase fixture does not claim those measurements.

`fauna-trajectory.spec.tsx` separately mounts the real production actor
components, habitats and model assets in day, night and autumn post-rain
scenarios. Its manual frame driver records each submitted WebGL frame over
24 seconds at 30 and 60 Hz, including actual model transforms, joint samples,
visible species counts, stable actor identities and mounted species debug
transitions. Model readiness requires the actual expected initial model
population. Every Bone/Pivot records local position, quaternion and scale;
there is no joint truncation. A ten-second hidden interval checks manual replay
gating, timer/store stability and no elapsed-time backlog on resume. This
manual driver suppresses automatic frames, so canonical production lifecycle
captures remain the authority for scheduler suspension and resume. The fixture releases
one fixed preparation interval for Canvas measurement and waits for the
post-rain slug population to mount before starting its replay.

Both baseline and candidate capture the complete three-scenario × 30/60 Hz
matrix using the identical fixture/driver SHA-256 and
record each checkout's source commit. The comparison requires unchanged
population and actor identity, exact root trajectory endpoints within numerical
precision, midpoint interpolation at 60 Hz, unchanged root orientation and
scale, and unchanged actual behavior, target and path transition sequences. Legacy root trajectories account for
the designed one-step presentation latency; mounts and large semantic
teleports snap immediately. The legacy 30 Hz trajectory is the authoritative
movement reference; candidate 60 Hz endpoints and quaternion/scale midpoints
must match its interpolated presentation. Each joint component is compared with
the same-cadence baseline within that component's local one-step motion.
Cross-cadence posing uses the exact signed legacy 30/60 component difference
at the matching presentation time to attribute inherited render-delta damping,
rather than allowing a difference on another axis or in the opposite direction.
Locally static
joint properties therefore remain exact even when a later phase moves quickly;
angular comparison treats antipodal
quaternions as the same orientation. These bounds come from the frozen
baseline trace rather than a tuned angle or scale allowance. World transforms
come from each authoritative actor group; Dog/Rabbit visual wrappers are
recorded separately as `@visual`, and all model roots as `@model` alongside
every bone/pivot's local position, quaternion and scale. This supplements the
domain traces and the moving-clip phase witness.
It does not alter canonical profiler thresholds or report production FPS.
The receipt freezes the initial checkout commit, tracked Game/JS source bytes,
all six witness files, browser configuration and asset-server environment,
then checks them again after capture. The candidate must be clean; an isolated
legacy reference permits only the named witness files and browser configuration
addition. Source edits during capture invalidate the report.

Run the same fixture files in isolated baseline and candidate checkouts with
an existing production asset server; keep the canonical profiling checkout
untouched:

```bash
GREDICE_GARDEN_BASE_URL=http://localhost:3917 GREDICE_PLAYWRIGHT_REUSE_SERVER=true FAUNA_TRAJECTORY_MODE=baseline FAUNA_TRAJECTORY_OUTPUT=/tmp/fauna-baseline.json pnpm --filter garden exec playwright test tests/fauna-trajectory.spec.tsx --project=chromium-webgl --workers=1
GREDICE_GARDEN_BASE_URL=http://localhost:3917 GREDICE_PLAYWRIGHT_REUSE_SERVER=true FAUNA_TRAJECTORY_REFERENCE=/tmp/fauna-baseline.json FAUNA_TRAJECTORY_OUTPUT=/tmp/fauna-candidate.json pnpm --filter garden exec playwright test tests/fauna-trajectory.spec.tsx --project=chromium-webgl --workers=1
node --test apps/garden/scripts/fauna-trajectory-contract.unit.mjs
```

The full trajectory replay is explicitly enabled by baseline mode or a matching
`FAUNA_TRAJECTORY_REFERENCE`. Ordinary CI skips those six supplemental captures,
because an unreferenced candidate cannot attribute inherited pose damping.
CI still runs the real mixer/pose/two-root lifecycle fixture and the negative
trajectory-contract cases through Garden's `test:profile` command.

The contract tests reject population loss, nonfinite transforms, missing GPU
receipts, incomplete scenario/cadence grids, fixture drift, changed targets,
stepped interactive movement, common wrong orientation/scale, nonfinite or
altered joints, and hidden elapsed-time replay.

Per-species instanced skinning stays conditional on fauna-heavy profiles still
showing draw pressure after CPU centralization and actor culling. It changes
rendering architecture and needs its own measured justification.
