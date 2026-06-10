# Game Rendering Architecture Optimization Plan

Date: 2026-06-01

This document tracks the next rendering and camera architecture optimization
work for the garden game. The goal is to preserve visual quality and reduce
unnecessary CPU, React, and WebGL work. These tasks should not use lower quality
fallbacks as the primary fix.

Related context:

- Performance analysis: `docs/game-scene-performance.md`
- Dense scene optimization PR: https://github.com/gredice/gredice/pull/3130
- Main scene root: `packages/game/src/GameScene.tsx`
- Canvas wrapper: `packages/game/src/scene/Scene.tsx`

## Project principles

- Do not use lower quality fallbacks as the main fix for larger scenes.
- Preserve active sway, cloud movement, weather, shadows, and dense garden
  richness unless a task explicitly replaces an effect with an equivalent
  cheaper implementation.
- Prefer moving repeated CPU and React work into shared uniforms, GPU shaders,
  chunk-level decisions, and explicit invalidation.
- Make the camera the source of truth for projection, input, and
  camera-dependent rendering decisions.
- Measure with production profiling and visual browser smoke before treating an
  optimization as complete.

## Tracking

Status values:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

## Milestone 1: Camera ownership

### [x] 1. Implement custom GameCameraRig to replace OrbitControls

Priority: High

Problem:

The game currently depends on Drei/three-stdlib `OrbitControls` and stores the
controls ref in Zustand. Camera behavior is split across `Controls`,
`CameraController`, `useFocusPlacedBlock`, and consumers that directly inspect
the controls target. This makes camera updates hard to coordinate and creates
extra frame-loop work.

Scope:

- Add a `GameCameraRig` component for the game scene.
- Own orthographic camera state directly: position, target, zoom, rotation, and
  animation state.
- Implement pan, wheel zoom, pinch zoom, 90-degree world rotation, close-up
  transitions, and focus-on-new-placement behavior.
- Emit a single camera-change signal/event for camera-facing systems.
- Keep behavior behind a feature flag until parity is verified.
- Remove `orbitControls` from game state only after all consumers migrate.

Dependencies:

- None.

Implementation notes:

- Preserve current input semantics from `Controls.tsx`: left drag pans, wheel
  zooms, one-finger touch pans, two-finger touch zoom/pans.
- Move close-up animation logic from `CameraController.ts` into the rig.
- Move focus animation logic from `useFocusPlacedBlock.ts` into the rig or a
  rig command API.
- Expose imperative methods through a small game-camera store or context:
  `focus(position)`, `setCloseup(target)`, `setWorldRotation(value)`,
  `getSnapshot()`.

Acceptance criteria:

- Normal pan/zoom feels equivalent to current OrbitControls behavior.
- Rotation keys still rotate the isometric world by 90-degree increments.
- Raised-bed close-up transitions match existing camera framing.
- Newly placed blocks still trigger camera focus and sunflower transfer effects.
- No direct dependency on Drei `OrbitControls` remains in the main game scene.

Validation:

- Manual browser smoke for desktop mouse, mobile touch emulation, close-up, and
  placement focus.
- `pnpm --filter @gredice/game typecheck`
- `pnpm --filter garden typecheck`
- `pnpm --filter garden build`

Progress:

- Replacing the Drei/three-stdlib `OrbitControls` path with an in-house
  `GameCameraRig` that owns target, position, zoom, keyboard pan/rotate, pointer
  pan, wheel zoom, pinch zoom, close-up animation, and placement focus.
- Removed the main game scene `OrbitControls`/`CameraController` path and
  replaced it with `GameCameraRig`.
- Added a `gameCamera` API and snapshot to game state for camera target reads,
  screen projection, placement focus, and future camera-change subscriptions.
- Migrated placement focus/sunflower screen projection and cloud focus tracking
  away from `orbitControls.target`.
- Verified dense camera-motion profiling records `pan-zoom-rotate` and a
  nonblank canvas with the custom rig.

## Milestone 2: Camera-change updates

### [x] 2. Move camera-facing scene systems to camera-change updates

Priority: High

Problem:

Several systems recompute camera-facing transforms every frame even when the
camera has not moved. This includes sun/moon billboards, stars, clouds, ground
decoration billboards, plant billboards, and some HUD/world projection work.

Scope:

- Introduce a camera-change subscription from `GameCameraRig`.
- Update camera-facing systems only when camera position, target, zoom, or
  viewport changes.
- Keep time-based animation as shared uniforms where needed.
- Avoid per-instance React state updates for camera-facing alignment.

Target files:

- `packages/game/src/scene/SunMoon.tsx`
- `packages/game/src/scene/Stars.tsx`
- `packages/game/src/scene/CloudLayer.tsx`
- `packages/game/src/entities/groundDecorations/GroundDecorationInstances.tsx`
- `packages/game/src/generators/plant/parts/PlantBillboard.tsx`

Dependencies:

- Task 1 for the cleanest camera-change signal. Some partial work can happen
  before Task 1 by comparing camera matrices.

Acceptance criteria:

- Camera-facing objects remain visually aligned during pan, zoom, rotate, and
  close-up transitions.
- Static camera scenes no longer run alignment work every frame for these
  systems.
- Any remaining per-frame work is limited to visual animation uniforms.

Validation:

- Browser screenshot/video smoke during pan, zoom, and close-up.
- Profile comparison showing fewer active `useFrame` callbacks or less CPU time
  during static-camera scenes.

Progress:

- Extended `GameCameraRig` with camera-change subscriptions.
- Moved sun/moon, stars, cloud camera bounds/facing, ground decoration
  billboard matrices, and plant LOD billboard facing to camera-change updates.
- Kept remaining per-frame work limited to time-based animation and weather
  movement uniforms for these systems.
- Coalesced camera-change subscriber notifications so camera input can mutate
  camera state immediately while expensive camera-facing listeners flush at most
  once per rendered frame.
- Validation passed: targeted Biome check, `pnpm --filter @gredice/game
  typecheck`, `pnpm --filter @gredice/game test`, `pnpm --filter garden
  typecheck`, and `pnpm --filter garden build`.
- Dense scene visual smoke passed after pan, zoom, and rotate:
  `apps/garden/test-results/game-profile/dense-camera-smoke.png`.
- Short headless dense profiles still fail absolute frame-time budgets in this
  local environment while draw call, triangle, heap, and long-task count budgets
  pass. Latest samples: static dense p95 `250.1 ms`, camera-motion p95
  `350.1 ms`. Continue optimizing with the next milestones; do not lower visual
  quality as the fix.

## Milestone 3: GPU weather particles

### [x] 3. Convert rain particles to GPU time/seed animation

Priority: High

Problem:

`Rain/Drops.tsx` updates every raindrop matrix on the CPU each frame using
`getMatrixAt`, `decompose`, and `setMatrixAt`. This scales poorly during heavy
rain.

Scope:

- Replace CPU matrix updates with instanced attributes:
  seed, spawn position, speed, angle, and phase.
- Animate fall/reset in the vertex shader using `uTime`, camera position, and
  rain field bounds.
- Keep current visual density and camera-relative rain field behavior.
- Keep rain intensity controlled by existing weather and quality profile values.

Dependencies:

- None.

Acceptance criteria:

- Heavy rain keeps equivalent visual coverage and motion.
- Per-frame CPU loop over all raindrops is removed.
- Rain still follows the camera enough that the visible field remains filled.

Validation:

- Browser smoke for light rain and heavy rain profile modes.
- Dense-scene profile comparison in rain mode.
- `pnpm --filter @gredice/game typecheck`

Progress:

- Replaced per-drop CPU matrix reads/decomposes/writes with static instanced
  seed attributes and shader-driven fall/wrap animation.
- Rain now updates only the field group position and `uTime` each frame; the
  instance matrix buffer is no longer uploaded every rain frame.
- Switched rain to a direct transparent `ShaderMaterial` so drop projection,
  wrapping, and alpha are controlled without CSM/raw-position ambiguity.
- Validation passed: targeted Biome check, `pnpm --filter @gredice/game
  typecheck`, `pnpm --filter @gredice/game test`, `pnpm --filter garden
  typecheck`, and `pnpm --filter garden build`.
- Dense rain browser smoke passed with 1400 reported rain particles and no
  shader compile errors. Screenshot:
  `apps/garden/test-results/game-profile/dense-rain-smoke-adjusted.png`.
- Short headless dense rain profile still fails absolute frame-time budget in
  this local environment (`p95 808.3 ms`) with repeated Chromium `ReadPixels`
  GPU-stall warnings, but script time, draw calls, triangles, heap, and
  long-task count remain within budget.

### [x] 4. Convert snow particles to GPU time/seed animation

Priority: High

Problem:

`Snow/Snow.tsx` mutates every snowflake position and matrix on the CPU each
frame. Snow can mount thousands of particles, so CPU and instance-buffer upload
cost become significant.

Scope:

- Replace per-flake CPU updates with instanced attributes:
  seed, base position, fall speed, drift, rotation speed, and phase.
- Animate fall, wrap, drift, and rotation in the vertex shader.
- Preserve wind direction and wind speed behavior.
- Keep snow density controlled by existing weather and quality profile values.

Dependencies:

- None.

Acceptance criteria:

- Snow coverage and wind drift look equivalent to current behavior.
- Per-frame CPU loop over snow particles is removed.
- Instance matrix buffer no longer uploads every snow frame.

Validation:

- Browser smoke for snow profile mode.
- Dense-scene profile comparison in snow mode.
- `pnpm --filter @gredice/game typecheck`

Progress:

- Replaced per-flake CPU position mutation, matrix composition, and
  `instanceMatrix` uploads with static instanced attributes and shader-driven
  fall, wrap, wind drift, and rotation.
- Snow now updates only the shared `uTime` uniform each frame.
- Validation passed: targeted Biome check, `pnpm --filter @gredice/game
  typecheck`, `pnpm --filter @gredice/game test`, `pnpm --filter garden
  typecheck`, and `pnpm --filter garden build`.
- Dense snow browser smoke passed with 2100 reported snow particles and no
  shader compile errors. Screenshot:
  `apps/garden/test-results/game-profile/dense-snow-smoke.png`.
- Short headless dense snow profile still fails absolute frame-time budget in
  this local environment (`p95 540.7 ms`) with repeated Chromium `ReadPixels`
  GPU-stall warnings, but script time, draw calls, triangles, heap, and
  long-task count remain within budget.

## Milestone 4: Interaction architecture

### [x] 5. Replace per-block instanced hit targets with InteractionGrid

Priority: High

Problem:

The dense-scene optimization reduced some control wrappers, but visible top
instanced blocks still use per-block invisible hit meshes and control wrappers.
This creates many objects in large gardens.

Scope:

- Add an `InteractionGrid` or `BlockInteractionLayer`.
- Raycast against one ground/interaction plane.
- Resolve pointer position to stack, top visible block, block index, and hit
  height from garden/block data.
- Route selection, pickup, drag preview, rotate, GardenBox click, and raised-bed
  close-up through the same interaction behavior currently handled by
  `PickableGroup`, `RotatableGroup`, and `SelectableGroup`.
- Keep non-instanced complex entities on existing interaction paths until parity
  is proven.

Dependencies:

- Task 1 is recommended because drag math and camera projection should use the
  same camera source of truth.

Acceptance criteria:

- Dense scenes no longer mount one hit mesh per visible instanced block.
- Drag, drop, blocked placement preview, recycle, GardenBox, and raised-bed
  click behavior match current behavior.
- Pickup outlines still appear for active drag/source/target states.
- Touch and mouse input both work.

Validation:

- Manual smoke for move, recycle, GardenBox store, raised-bed close-up, and
  blocked placement.
- Dense 25x25 profile comparison with controls enabled.
- `pnpm --filter @gredice/game test`

Progress:

- Added a shared `BlockInteractionLayer` and `BlockInteractionRegistry` for
  top visible instanced blocks.
- Removed the per-instanced-block hidden `InstancedEntityControlTarget` mesh
  from `EntityFactory`; top instanced block pickup/drag and double-tap rotate
  now route through one ground interaction plane.
- Replaced the temporary instanced interaction-box mesh with a single
  horizontal plane. Pointer events now resolve by intersecting the event ray
  against computed per-block data hitboxes and selecting the nearest top
  visible instanced block. This keeps one actual interaction mesh while avoiding
  incorrect selection when isometric block projections overlap on screen.
- Preserved the existing `PickableGroup` and `RotatableGroup` behavior by
  registering their handlers against the shared layer, so drag preview,
  blocked/recycler indicators, pickup outlines, haptics, sounds, and optimistic
  move/recycle/store code paths stay on the established logic.
- Registered instanced GardenBox, GiftBox, and raised-bed selection clicks
  against the shared layer so the removed hidden target does not drop close-up
  or inventory interactions.
- Kept non-instanced complex entity interactions on the existing path; parity
  coverage for GardenBox store, recycle, and blocked placement is now covered
  by deterministic placement resolver tests plus browser smokes for pointer
  routing.
- Validation passed: targeted Biome check, `pnpm --filter @gredice/game
  typecheck`, `pnpm --filter @gredice/game test`, `pnpm --filter garden
  typecheck`, `pnpm --filter garden build`, and `git diff --check`.
- Dense controls browser smoke loaded `profile=dense&controls=1`, accepted
  pan/zoom/rotate input, triggered the existing raised-bed close-up click path,
  and produced no page errors. Screenshot:
  `apps/garden/test-results/game-profile/dense-interaction-layer-smoke.png`.
- Plane resolver raised-bed click smoke loaded the default details profile,
  clicked a visible instanced raised bed, and navigated to
  `gredica=Raised Bed 2` without page errors. Screenshot:
  `apps/garden/test-results/game-profile/interaction-plane-raised-bed-click.png`.
- Local sandbox mouse drag/drop smoke moved a `Tree` from stack `(0, 0)` to
  `(1, 0)` and persisted it in `gredice.debug.sandbox.garden.v1` without page
  errors. Screenshot:
  `apps/garden/test-results/game-profile/interaction-plane-mouse-drag-ray-after.png`.
- Local sandbox touch drag/drop smoke dispatched touch pointer events against
  the shared layer, moved the same `Tree` flow, and persisted the result without
  page errors. Screenshot:
  `apps/garden/test-results/game-profile/interaction-plane-touch-drag.png`.
- Added deterministic resolver unit coverage for nearest data-hitbox selection,
  rotated non-square hitboxes, stack-height bounds, and ray misses:
  `packages/game/src/controls/BlockInteractionResolver.unit.ts`.
- Extracted pickup drop classification into
  `packages/game/src/controls/PickupPlacementResolver.ts`, preserving the
  existing `PickableGroup` pointer/session/mutation behavior while making the
  GardenBox, recycler, and blocked-placement decisions unit-testable.
- Added deterministic placement resolver unit coverage for non-sandbox
  GardenBox store eligibility, sandbox GardenBox blocking, recycler routing,
  and non-stackable blocked placement:
  `packages/game/src/controls/PickupPlacementResolver.unit.ts`.
- Split hook-free stack-height helpers into
  `packages/game/src/utils/stackHeightCore.ts` so pure interaction tests do
  not import the React/query `useBlockData` path.
- Dense controls profile completed with
  `GAME_PROFILE_BASE_URL=http://localhost:4171 node
  apps/garden/scripts/profile-game-scene.mjs --scenario-set
  game-dense-25x25-controls-desktop --warmup-ms 800 --sample-ms 1200`.
  Local headless timing budget still failed (`p95 58.4 ms`, `23` long tasks)
  with Chromium `ReadPixels` stalls, while render-size budgets stayed within
  target: `119` draw calls/frame, `64858` triangles/frame, `77.6 MB` heap, no
  page errors.
- Post-refactor dense controls production smoke completed against
  `http://localhost:4181` with
  `GAME_PROFILE_BASE_URL=http://localhost:4181 node
  apps/garden/scripts/profile-game-scene.mjs --scenario-set
  game-dense-25x25-controls-desktop --warmup-ms 800 --sample-ms 1200`.
  The local headless frame-time budget still failed (`p95 267 ms`, `max
  267 ms`) with Chromium `ReadPixels` stalls; the route still rendered the
  25x25 controls scene and produced fresh metadata (`914` decorations, `839`
  visible, `2` atlas pages, `106` chunks).

## Milestone 5: Plant and decoration culling

### [x] 6. Add chunk/field-level plant LOD and culling

Priority: Medium

Problem:

Generated raised-bed plants can build detailed geometry for many fields, and
current plant LOD can evaluate per plant every frame. Dense productive gardens
need chunk/field-level decisions instead of per-plant frame work.

Scope:

- Add field/chunk-level plant visibility and LOD resolution.
- Update LOD only on camera/viewport changes or garden data changes.
- Render detailed generated geometry only where screen occupancy warrants it.
- Render batched plant billboards or simplified instanced plant summaries for
  mid/far fields.
- Avoid rebuilding detailed plant geometry for far/offscreen fields.

Target files:

- `packages/game/src/entities/raisedBed/RaisedBedGeneratedPlantBatch.tsx`
- `packages/game/src/entities/raisedBed/RaisedBedPlantField.tsx`
- `packages/game/src/generators/plant/hooks/usePlantLod.ts`
- `packages/game/src/generators/plant/PlantGenerator.tsx`

Dependencies:

- Task 2 is recommended for camera-change-triggered LOD updates.

Acceptance criteria:

- Field-level LOD does not run per plant every frame.
- Offscreen/far fields do not build detailed plant geometry.
- Close-up plants preserve current detail.
- Normal/far views preserve a dense, readable planted-field appearance.

Validation:

- Plant-heavy garden/browser profile comparison.
- Visual smoke for close-up and normal view.
- `pnpm --filter @gredice/game test`

Progress:

- Added camera-change-driven plant LOD state with offscreen visibility checks.
- Raised-bed fields now measure at the field level and skip plant/seed content
  when outside the orthographic viewport margin.
- Generated raised-bed plant batches now receive the field LOD level and render
  mid/far billboard summaries instead of detailed merged stem/leaf/flower/
  produce geometry.
- Detailed plant sway/material uniforms only mount for near detailed batches.
- Mock/sandbox plant-heavy profiles now resolve generated-plant presets without
  depending on authorized plant sort API data.
- Fixed plant billboard initialization so mid/far impostors face the current
  game camera immediately, not only after the next camera-change event.
- Validation passed: targeted Biome check, `pnpm --filter @gredice/game
  typecheck`, `pnpm --filter @gredice/game test`, and `pnpm --filter garden
  typecheck`.
- Normal-view browser smoke kept detailed close plants visible:
  `apps/garden/test-results/game-profile/plant-default-lod-smoke.png`.
- Plant-heavy production-server profile completed with
  `GAME_PROFILE_BASE_URL=http://localhost:3101 node
  apps/garden/scripts/profile-game-scene.mjs --scenario-set
  game-plant-heavy-25x25-desktop --warmup-ms 800 --sample-ms 1200`. Headless
  frame-time budget still failed with Chromium `ReadPixels` stalls (`p95 382.6
  ms`, `max 382.6 ms`), while render-size budgets stayed within target:
  `216.3` draw calls/frame, `113500` triangles/frame, `87.5 MB` heap, no page
  errors.

### [x] 7. Add atlas-page batching and viewport culling for ground decorations

Priority: Medium

Problem:

Ground decorations are now instanced, but the current batching can still split
work by sprite/material and submit decoration chunks outside the effective
camera view. Large gardens need fewer atlas-level draws and camera-driven
visibility decisions.

Scope:

- Move toward one or a few atlas-page draws using per-instance UV rect, opacity,
  alpha cutoff, sway phase, and color/tint attributes.
- Partition decoration instances by world chunk.
- Skip chunks outside the orthographic viewport plus margin.
- Update visible chunk set on camera/viewport changes.
- Keep current visual density, flower variation, slope alignment, and wobble.
- Avoid React re-renders when only the camera-visible chunk set changes.

Dependencies:

- Task 2 is recommended for camera-change-triggered visibility updates.

Acceptance criteria:

- Draw calls reduce beyond the current per-sprite/material batching.
- Decorations outside the viewport margin do not submit draw calls.
- No visible popping during pan/zoom with the configured margin.
- Dense 25x25 and larger scenes keep current close-range visual richness.

Validation:

- Browser pan/zoom smoke.
- Dense garden profile comparison with medium/high detail.
- `pnpm --filter @gredice/game test`

Progress:

- Replaced per-sprite ground-decoration instanced batches with atlas-page
  batches that use per-instance UV rect, opacity, alpha cutoff, and wobble
  attributes. This keeps all decoration variants on the atlas page in one
  instanced mesh instead of one mesh per sprite/material combination.
- Added 4x4 world chunk partitioning for decoration instances. Camera-change
  updates now frustum-cull expanded chunks and compact only visible instances
  into the dynamic matrix/attribute buffers without React state updates.
- Preserved the existing sprite brightness, wind wobble, opacity variation,
  alpha cutoff behavior, and camera-facing billboards.
- Validation passed: targeted Biome check, `pnpm --filter @gredice/game test`,
  `pnpm --filter @gredice/game typecheck`, `pnpm --filter garden typecheck`,
  and `pnpm --filter garden build`.
- Added decoration-specific profile metadata for atlas page count, chunk count,
  and visible submitted decoration count. The profile report now records those
  values in the `Overlays/Decor` column so decoration culling is not inferred
  only from total scene draw calls.
- Dense browser smoke against `http://localhost:4172` loaded
  `profile=dense&mode=details&controls=0&quality=medium`, rendered 914
  decorations, and produced no page errors or shader/WebGLProgram errors.
  Screenshot:
  `apps/garden/test-results/game-profile/dense-decoration-atlas-culling-smoke.png`.
- Dense pan/zoom/rotate browser smoke with controls enabled kept the 914
  decoration scene visible and produced no page errors or shader/WebGLProgram
  errors. Screenshot:
  `apps/garden/test-results/game-profile/dense-decoration-atlas-culling-pan-zoom-smoke.png`.
- Longer production-server dense profile comparison completed with medium,
  high, and controls-enabled scenes. Medium rendered `914` decorations with
  `839` submitted after culling, `2` atlas pages, and `106` chunks. High
  rendered `1353` decorations with `1235` submitted after culling, `2` atlas
  pages, and `113` chunks. Controls-enabled medium kept the same `839/914`
  visible decoration count, `2` pages, and `106` chunks.
- 2026-06-09 local dev smoke against
  `/debug/profile/game?mode=details&profile=dense&quality=medium&debugHud=1`
  rendered `914` decorations with `845` submitted after culling, `2` atlas
  pages, `57` chunks, `126` renderer calls, and no shader/WebGLProgram errors.
- The longer profile recorded render-size budgets within target despite local
  headless frame-time budget failures from Chromium `ReadPixels`/GPU stalls:
  medium `88.9` draw calls/frame, `76862` triangles/frame, `35.6 MB` heap;
  high `88.5` draw calls/frame, `77408` triangles/frame, `40.1 MB` heap;
  controls medium `424.7` draw calls/frame, `77389` triangles/frame, `168.8
  MB` heap.

## Milestone 6: Shadows and clouds

### [x] 8. Rework cloud shadows as projected shader overlay

Priority: Medium

Problem:

Moving cloud meshes can cast real shadows, which can force shadow work to update
while clouds move. Freezing those shadows would reduce quality, so cloud shadows
need a cheaper moving representation.

Scope:

- Replace cloud mesh shadow casting with a projected ground/cloud-shadow shader
  or texture overlay.
- Drive the overlay with the same cloud definitions, wind direction, wind speed,
  cloudiness, fog, and daylight visibility.
- Keep cloud visuals moving normally.
- Remove or disable cloud `castShadow` once the projected shadow is in place.

Dependencies:

- None, but pairs naturally with Task 9.

Acceptance criteria:

- Moving cloud shadows remain visible in daylight/cloudy scenes.
- Cloud shadow movement no longer requires real shadow-casting cloud meshes.
- Shadow visual intensity still responds to weather and time of day.

Validation:

- Visual smoke for clear, partly cloudy, cloudy, and windy weather presets.
- Profile comparison with clouds enabled.

Progress:

- Added projected cloud-shadow overlay meshes that reuse the generated cloud
  alpha texture and are driven from the same cloud slot positions, scale,
  visibility, cloudiness, fog/daylight visibility, wind direction, and wind
  speed as the visual cloud layer.
- Removed cloud shadow-map participation by disabling real cloud `castShadow`
  and removing the cloud `customDepthMaterial` path. Moving cloud shadows now
  animate as transparent projected texture overlays instead of shadow-map
  casters.
- Added profile/debug metadata for cloud visual count, projected cloud-shadow
  count, and real cloud shadow-caster count. Cloudy dense smoke reported
  `8` projected shadows and `0` real cloud shadow casters.
- Validation passed: targeted Biome check, `pnpm --filter @gredice/game test`,
  `pnpm --filter @gredice/game typecheck`, `pnpm --filter garden typecheck`,
  and `pnpm --filter garden build`.
- Production browser smoke matrix passed for clear, partly cloudy, cloudy, and
  windy dense scenes. Clear reported `0 projected / 0 real`; partly cloudy
  reported `6 projected / 0 real`; cloudy reported `8 projected / 0 real`; and
  windy reported `7 projected / 0 real`. All rendered nonblank canvases and
  produced no page errors or shader/WebGLProgram errors. Screenshots:
  `apps/garden/test-results/game-profile/cloud-projected-shadow-clear-smoke.png`,
  `apps/garden/test-results/game-profile/cloud-projected-shadow-partly-cloudy-smoke.png`,
  `apps/garden/test-results/game-profile/cloud-projected-shadow-cloudy-smoke.png`,
  and
  `apps/garden/test-results/game-profile/cloud-projected-shadow-windy-smoke.png`.
- Longer production-server cloudy/windy profile comparison completed with
  projected cloud shadows and no real cloud casters. Cloudy: `2048px, cloud 8
  projected/0 real`, `177.1` draw calls/frame, `98433` triangles/frame, `37.8
  MB` heap. Windy: `2048px, cloud 7 projected/0 real`, `279.4` draw
  calls/frame, `105215` triangles/frame, `45.2 MB` heap. Local headless
  frame-time budgets still failed with Chromium `ReadPixels` stalls.

### [x] 9. Cache static shadow maps with explicit invalidation

Priority: Medium

Problem:

Static directional shadows likely update more often than necessary. The scene
can preserve quality by caching static shadow maps and invalidating them only
when shadow-casting static geometry or sun/light parameters change.

Scope:

- Set renderer shadow auto-update policy explicitly.
- Track invalidation triggers:
  - garden stack/block changes
  - block placement/drop animation start/end
  - time-of-day or sun position changes
  - shadow quality/profile changes
  - close-up/normal scene changes if shadow camera framing changes
- Call `gl.shadowMap.needsUpdate = true` only when needed.
- Do not cache dynamic cloud shadows until Task 8 removes real cloud shadow
  casting.

Dependencies:

- Task 8 should happen first if clouds continue to cast real shadows.

Acceptance criteria:

- Static scene with shadows enabled does not rebuild shadow maps every frame.
- Shadows update correctly after block placement/move, time changes, and quality
  changes.
- No visual stale-shadow artifacts in common workflows.

Validation:

- Browser smoke for placement/move/time/weather changes.
- Render stats/profile comparison with shadows enabled.

Progress:

- Added `ShadowMapController` to set `gl.shadowMap.autoUpdate = false` when
  shadows are enabled and to request shadow-map updates only through explicit
  invalidation. Each invalidation keeps `needsUpdate` active for a short settle
  window so deferred/Suspense scene details can mount before the cache becomes
  static.
- Wired shadow invalidation through the static and dynamic environment paths.
  The invalidation signature includes stack/block data, light position/color/
  intensity, time/date, shadow visibility, shadow map size, quality shadow
  enabled state, normal/close-up view, pickup state, drop-animation state, and
  winter mode.
- Updated environment weather precedence so live game-state weather overrides
  the static profile `weather` prop. Profile presets still provide defaults,
  while debug and sandbox weather controls now drive the rendered environment
  and shadow invalidation path.
- Added profile/debug metadata for shadow-map auto-update policy and
  invalidation count. The profile report now records this in the `Shadow`
  column.
- Validation passed: targeted Biome check, `pnpm --filter @gredice/game test`,
  `pnpm --filter @gredice/game typecheck`, `pnpm --filter garden typecheck`,
  and `pnpm --filter garden build`.
- Production browser smoke for
  `profile=dense&mode=details&controls=0&quality=medium` rendered a nonblank
  scene with visible cached shadows, reported
  `Shadow 2048px / cached / 1 invalidations`, and produced no page errors or
  shader/WebGLProgram errors. Screenshot:
  `apps/garden/test-results/game-profile/static-shadow-cache-smoke.png`.
- Time-change smoke moved the debug time slider and verified shadow metadata
  stayed cached while invalidations increased from `1` to `3`, covering
  time/sun-position invalidation.
- Short production-server dense profile completed with
  `2048px, cached, invalidations 1`, `56.8` draw calls/frame, `77143`
  triangles/frame, and `33.5 MB` heap. Local headless frame-time budget still
  failed with Chromium `ReadPixels` stalls (`p95 575 ms`).
- Sandbox weather-change smoke set the time to daytime, applied the rain
  preset, and verified cached shadows stayed enabled while invalidations
  increased from `2` to `10`. Rain particles increased to `420`, projected
  cloud shadows increased to `8`, and no page errors or shader/WebGLProgram
  errors were reported. Screenshot:
  `apps/garden/test-results/game-profile/static-shadow-cache-weather-change-smoke.png`.
- Sandbox placement/move smoke seeded a local tree at `(0,0)`, dragged it to
  `(1,-1)`, and verified cached shadows stayed enabled while invalidations
  increased from `1` to `3`. Screenshot:
  `apps/garden/test-results/game-profile/static-shadow-cache-placement-move-smoke.png`.

## Milestone 7: Animation frame consolidation

### [x] 10. Consolidate scene animation clocks and reduce useFrame callbacks

Priority: Medium

Problem:

Many systems register independent `useFrame` callbacks. Some are unavoidable,
but several only update material uniforms or small animation values. This makes
frame cost harder to reason about and keeps static-camera scenes busier than
necessary.

Scope:

- Inventory `useFrame` callbacks and classify them:
  - camera-dependent
  - time-uniform only
  - CPU simulation
  - React state update
  - postprocessing/manual render
- Introduce shared scene time uniforms where practical.
- Replace per-material/per-instance frame hooks with shared uniform updates for
  water, plant sway, rain/snow overlays, and decoration wobble where safe.
- Avoid React state updates inside `useFrame` except for short transitions.

Dependencies:

- Tasks 2, 3, 4, and 8 reduce the largest sources first.

Acceptance criteria:

- Fewer independent `useFrame` registrations in normal scenes.
- Static scenes with no active effects do minimal CPU work.
- Animated scenes preserve visual motion.

Validation:

- Source audit of remaining `useFrame` callbacks.
- Profile comparison for clear, rain, snow, and plant-heavy scenes.

Progress:

- Added `SceneTimeProvider`, a canvas-level shared elapsed-time uniform updated
  from one `useFrame` callback.
- Reused the shared `uTime` uniform for snow particles, water shader animation,
  generated plant sway, ground-decoration wobble, and rain particle animation.
  Rain no longer owns its own time-uniform write.
- Removed per-material/per-batch time-update callbacks from `Snow`,
  `BlockWater`, `usePlantSway`, and `GroundDecorationInstances`. Source audit
  reduced `useFrame` registrations from `22` to `19`, including the new shared
  `SceneTimeProvider` callback.
- Moved the rain field follow behavior from a per-frame callback to the custom
  camera rig's camera-change subscription. Rain still tracks pan/zoom/animated
  camera changes, but static rain scenes no longer run a rain placement
  callback each frame. Source audit now reports `18` remaining `useFrame`
  registrations.
- Moved star twinkle from a CPU-side per-frame color-buffer rewrite to a
  points shader driven by the shared scene time uniform. Camera-facing star
  placement still updates through the custom camera-change subscription.
  Source audit now reports `17` remaining `useFrame` registrations.
- Moved sprite-atlas billboard wind wobble from per-billboard CPU mesh rotation
  updates to a Lambert vertex shader driven by the shared scene time uniform.
  Source audit now reports `16` remaining `useFrame` registrations.
- Moved generated plant sway wind/reduced-motion uniform updates to
  effect-driven updates instead of per-frame writes.
- Kept ground-decoration wind uniforms effect-driven and the wobble time uniform
  shared, preserving existing atlas-page batching and chunk culling.
- Fixed debug weather ownership exposed by the smoke tests: `DebugHud` now
  writes game-state weather only while its Override checkbox is enabled. Live
  weather fetched for the panel no longer accidentally overrides static profile
  weather presets.
- Validation passed: `pnpm --filter @gredice/game typecheck`,
  `pnpm --filter @gredice/game test`, `pnpm --filter garden typecheck`, and
  `pnpm --filter garden build`.
- Production browser smoke matrix passed for clear dense, rain dense, snow
  dense, and plant-heavy scenes with no page errors or shader/WebGLProgram
  errors. Rain reported `1400` particles and animated canvas changes
  (`412685` differing screenshot bytes); snow reported `2100` particles,
  `672` snow overlays, and animated canvas changes (`237382` differing
  screenshot bytes). Screenshots:
  `apps/garden/test-results/game-profile/shared-time-clear-dense-smoke.png`,
  `apps/garden/test-results/game-profile/shared-time-rain-dense-smoke.png`,
  `apps/garden/test-results/game-profile/shared-time-snow-dense-smoke.png`,
  and
  `apps/garden/test-results/game-profile/shared-time-plant-heavy-smoke.png`.
- Production rain camera-change smoke passed with controls enabled: after
  pan/zoom input, rain remained active at `1400` particles, cached shadows
  stayed enabled, the canvas changed (`381095` differing screenshot bytes), and
  no page errors or shader/WebGLProgram errors were reported. Screenshot:
  `apps/garden/test-results/game-profile/shared-time-rain-camera-change-smoke.png`.
- Production night star-shader smoke passed with no page errors or
  shader/WebGLProgram errors. The night canvas changed over time (`287416`
  differing screenshot bytes), verifying shared-time shader twinkle remained
  active. Screenshot:
  `apps/garden/test-results/game-profile/shared-time-star-shader-night-smoke.png`.
- Production windy dense smoke passed after the sprite-atlas shader conversion
  with no shader or WebGLProgram errors. Local frame-time budget still failed
  with Chromium `ReadPixels` stalls (`p95 250.5 ms`), while the scene rendered
  `914` decorations, `839` visible decorations, `2` atlas pages, and `106`
  chunks at `98.1` draw calls/frame and `82307` triangles/frame.
- Short production-server profile comparison completed for clear dense, rain
  dense, snow dense, and plant-heavy scenes. Local frame-time budgets still
  failed with Chromium `ReadPixels`/headless GPU stalls, while render-size
  budgets stayed within target. Samples: clear dense `60.8` draw calls/frame,
  `84707` triangles/frame, `31.6 MB`; rain dense `100.4` draw calls/frame,
  `88144` triangles/frame, `28 MB`; snow dense `126.6` draw calls/frame,
  `141251` triangles/frame, `37.8 MB`; plant-heavy `60.8` draw calls/frame,
  `84707` triangles/frame, `61 MB`.
- Hover outline rendering moved off `useFrame`; it now subscribes to the
  after-render pass only while outline targets are active.
- Remaining callbacks are camera rig/render invalidation, active weather/cloud
  transitions, particle/animal simulations, and plant LOD/culling. Those are
  still tied to visible simulation, input, or render invalidation work rather
  than simple duplicated time-uniform writes.

## Milestone 8: Profiling and QA harness

### [x] 11. Expand dense-scene profiling and visual QA coverage

Priority: High

Problem:

Optimization work needs repeatable production measurements for dense scenes with
the effects that are active in real gardens. The current profile harness covers
baseline/detail/rain/snow modes, but it still needs stronger coverage for
controls-enabled interaction cost, dense 25x25 gardens, camera motion, clouds,
and no-quality-fallback medium/high runs.

Scope:

- Extend `apps/garden/scripts/profile-game-scene.mjs` with scenarios for:
  - dense 25x25 static scene with controls disabled
  - dense 25x25 scene with controls enabled
  - dense 25x25 rain, snow, cloudy, windy, and plant-heavy scenes
  - camera pan/zoom/rotate motion while sampling
- Record draw calls, triangles, heap, FPS, long tasks, canvas backing size,
  reported DPR, quality tier, weather mode, and controls mode.
- Keep production-build profiling as the default for budget decisions.
- Add a short reporting template to `docs/game-scene-performance.md` so each
  optimization can log before/after results consistently.
- Add visual smoke notes for desktop and mobile touch interactions.

Dependencies:

- None. This can start immediately and should be kept current as other tasks
  land.

Acceptance criteria:

- Each optimization task can be validated with one or more repeatable profile
  scenarios.
- Reports distinguish static camera cost from active camera/input cost.
- Medium/high-quality dense runs stay in the harness; low-quality fallback runs
  are optional comparison data only.
- Visual QA covers canvas rendering, drag/drop, rotate, close-up, GardenBox,
  raised beds, rain, snow, clouds, and windy sway.

Validation:

- `cd apps/garden && pnpm run profile:game`
- `cd apps/garden && pnpm run profile:game:dense`
- `cd apps/garden && GAME_PROFILE_BASE_URL=http://localhost:3001 pnpm run profile:game:existing`
- Manual production browser smoke for the dense scenarios added.

Progress:

- Added deterministic `dense` and `plant-heavy` mock garden profiles for the
  debug profile route.
- Added `core`, `dense`, and `all` profile scenario sets.
- Added dense 25x25 static, high-quality, controls-enabled, camera-motion,
  rain, snow, cloudy, windy, and plant-heavy scenarios.
- Added explicit mode/profile/controls/motion fields to JSON and Markdown
  reports.
- Smoke-tested `game-dense-25x25-desktop` against a local dev server with a
  shortened sample; the report recorded `profile=dense`, `mode=details`,
  `controls=0`, medium quality, and dense decoration counts.

## Suggested implementation order

Task 10 spans multiple phases: start the shared-clock work when converting
weather/overlay animation, then finish the cleanup after the larger render
architecture changes land.

1. Task 11: profiling harness coverage for repeatable before/after baselines.
2. Task 1: custom `GameCameraRig`.
3. Task 2: camera-change updates.
4. Task 3 and Task 4: GPU rain/snow particles.
5. Task 5: `InteractionGrid`.
6. Task 6 and Task 7: plant LOD/culling and decoration atlas/culling.
7. Task 8 and Task 9: projected cloud shadows and shadow cache.
8. Task 10: final frame callback consolidation.

## Open questions

- Should `GameCameraRig` ship behind a runtime feature flag for one release, or
  replace OrbitControls in one implementation PR after parity smoke passes?
- What visual tolerance is acceptable for projected cloud shadows compared with
  real shadow-casting cloud meshes?
- How closely must plant impostors match generated plant geometry in normal and
  far views?
- Should dense profile budgets target medium quality first, then high quality,
  or should every optimization PR report both?

## Global validation checklist

Run the narrowest relevant checks per task:

- `pnpm --filter @gredice/game typecheck`
- `pnpm --filter @gredice/game lint`
- `pnpm --filter @gredice/game test`
- `pnpm --filter garden typecheck`
- `pnpm --filter garden build`
- `git diff --check`

For visual/rendering tasks, also run a production browser smoke against:

- `/debug/profile/game?mode=baseline&quality=medium`
- `/debug/profile/game?mode=details&quality=medium`
- `/debug/profile/game?mode=rain&quality=medium`
- `/debug/profile/game?mode=snow&quality=medium`
- `/debug/profile/game?mode=details&controls=1&quality=medium`
- `/debug/sandbox` with a dense 25x25 local garden

Record any updated measurements in `docs/game-scene-performance.md`.
