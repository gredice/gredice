# Camera updates in owned frames

`GameCameraRig` applies rotation, focus interpolation, its exact final pose and
keyboard pan before the current root submission. Those `useFrame` paths call
`applyCamera(false)` (or forward `false` through `panByWorldVector`): they update
the view/projection matrices and publish the camera snapshot without requesting
another urgent frame. The `camera-interaction` lease keeps animation, drag and
keyboard motion alive until their owner stops.

Wheel, pointer drag, immediate focus/restore and initial-view replacement occur
outside the frame. They retain the default `applyCamera()` request so an idle
scene wakes. Animated focus and restore acquire the interaction lease and release
it after completion. The fix shipped in PR #5118; issue #5125 completes its
dedicated regression coverage and current-source validation.

## Regression checks

`GameRuntimeScheduler.unit.ts` runs the actual scheduler twice with identical
30 Hz display opportunities, 4 ms timer lateness and 2 ms receipt work. Only the
redundant in-frame `camera-change` request differs. Its 30 Hz case witnesses the
cadence loss; its 60 Hz case records the current scheduler's behavior under the
same effects. This is a deterministic model, not a reconstruction or causal
explanation of the historical native failure.

`cursor-anchored-zoom.spec.tsx` mounts the actual `GameCameraRig`, `Scene`, root
runtime and scheduler in WebGL. Its draw observer checks the published snapshot
and world, inverse-world and projection matrices at submission. A real caster
also checks those values during the shadow pass. Rotation and animated/keyboard
updates must not introduce `camera-change` demand. Focus interpolation, exact
final focus/restore poses, urgent idle wheel/drag/immediate actions, and the
return to idle are covered. A mutation restoring the old in-frame requests must
fail the integration tests.

Run from the repository root:

```sh
pnpm --filter @gredice/game run test
pnpm --filter garden exec playwright test tests/cursor-anchored-zoom.spec.tsx \
  --project chromium-webgl --workers=1 --retries=0
pnpm typecheck --filter @gredice/game --filter garden --filter www
```

## Native validation

Use the existing [production profiling and comparison contract](./game-scene-performance.md),
including its complete symmetric 2×2 `cross-tier,fauna,garden-switch,lifecycle`
manifest. Capture two independent current-main baseline bundles and two final
candidate bundles. Both contain the already-shipped camera fix: this validates
current behavior and regression gates, and makes no before/after timing claim
for the old urgent-request implementation. The only candidate changes are
regression tests and this documentation.

Keep all three independent repeats for Low, Medium, High, Auto standard and
Auto constrained, their steady controls, content/outline checks and the existing
28–32 FPS and GPU comparison limits. Do not alter the scheduler, profiling
clocks, scene inputs, quality policies or numerical gates to obtain acceptance.
Record exact source/build/dependency guards and the complete result in the PR
and private task evidence, retaining failed attempts as failed evidence. Earlier
native failures remain unsuccessful; this does not clear physical devices or
epic #4715. Physical-device clearance is tracked separately in #4344.
