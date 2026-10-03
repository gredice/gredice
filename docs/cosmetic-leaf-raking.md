# Cosmetic leaf-raking

Issue #4995 adds an optional activity to the main interactive 3D garden. When an
exposed `LeafRake`, `AutumnLeafPileMound`, or `AutumnLeafPileCrescent` is present,
the bottom HUD offers **Ukrasno jesensko lišće**. Its compact panel selects a
placed decoration and offers **Razgrni lišće**, with optional **Šuškanje**. Native
select, checkbox, button, and the shared Popper provide touch and keyboard access,
Escape dismissal, and focus restoration. No purchase or login is required.

The activity draws a brief sweep arc and eight leaves at the selected object's
existing authored rake anchor, using its current world transform. Only the top
block of a stack is eligible; an unloaded anchor or hidden ancestor refuses the
activity with a retry message. Ordinary canvas picking, dragging and crop action
handlers are unchanged. Active dragging disables this HUD action.

## Bounds and lifecycle

- One transient action per scene; 900 ms of animation and a 2.2-second cooldown
  measured from the initial gesture. Another decoration cannot bypass cooldown.
- The existing shared scene clock drives motion. One shared continuous-render
  lease requests 30 FPS only during the active animation; there is no private
  requestAnimationFrame loop or permanent render lease.
- A shared scheduler deadline ends the action and cooldown independently of the
  scene clock. Reduced motion and frozen clocks show a static 180 ms sweep
  acknowledgement and text, with no moving leaves or animation lease.
- Two small meshes: one eight-instance shared four-facet leaf geometry and a
  16-segment arc. Leaves remain within 0.28 world units horizontally and 0.195
  units vertically of the anchor. Idle leaves have count zero and the effect
  group is hidden. Instance buffers, geometries and materials are disposed on
  renderer unmount.
- Account/garden changes, target removal, dragging, scene invisibility and
  unmount discard transient activity. Reusing a block ID in another garden does
  not retain a previous action.
- Optional sound reuses the existing short `autumn-leaf-step-v1-1.wav` through
  the shared ambient mixer at 0.25 gain. It defaults off, follows master/channel
  volume and mute, does not queue late sounds, and aborts on cancellation,
  backgrounding or unmount. Sound loading failure remains silent.

Leaf piles and rake meshes retain their saved position, appearance and rotation.
The controller owns only ephemeral UI state. It does not issue garden, crop,
operation, wallet or reward requests; it does not grant progress or change any
saved farm state. Public/photo capture renderers do not mount the activity.

## Validation

Pure tests cover eligibility, stack immutability, bounded leaf transforms,
repeat cooldown, reduced motion and cleanup. `leaf-raking.spec.tsx` uses the real
scene, authored decorations and shared camera on Chromium WebGL: pointer and
keyboard triggering record rendered instance counts and changing poses at the
rotated selected anchor; touch/reduced motion cover drag, account/garden switches
and target removal; frozen clock and actual decoded one-shot audio cover mute and
unmount. The fixture asserts unchanged saved garden data and no non-GET requests.
The suite participates in the regular WebGL component-test discovery. Its local
isolated config uses port 5483 and one worker.

No Blender or GLB asset changes are required. Physical-device visual and audio
acceptance remains a separate release check; SwiftShader is diagnostic coverage.
