# Delivery driver mobile validation

## Purpose

Use this checklist to validate the irreversible current-stop actions on physical
phones. Responsive browser tests are useful regression evidence, but they do not
replace one-handed checks on real devices.

## Pass criteria

- Every visible driver action, completion action, override reason control, and
  handoff outcome control has a touch target of at least 44 by 44 CSS pixels.
- Adjacent actions keep at least 8 CSS pixels of separation and do not overflow
  horizontally at 320 CSS pixels.
- A reviewed single delivery completes with one action and no repeated dialog.
- A bulk delivery states the unique recipient count, harvest count, and expected,
  verified, unscanned, no-label, and exception counts before completion.
- Delivery without a recorded arrival or completed handoff review requires an
  explicit operational reason; QR scanning itself remains optional.
- Cancelling the completion dialog returns focus to its opener. Successful
  completion moves focus to the next current-stop heading.
- Two rapid taps or submit gestures create exactly one local delivery command.
- Loading, offline, failed-sync, keyboard-open, and reduced-motion states remain
  understandable and operable.
- Ten consecutive routine single deliveries and ten bulk/override attempts
  produce zero accidental duplicate completions and zero missed touch targets.

## Automated regression evidence

Run from the repository root:

```sh
pnpm --filter delivery test:unit
pnpm --filter delivery exec playwright test tests/driver-current-stop.spec.tsx tests/delivery-handoff-verification.spec.tsx --project=chromium
pnpm --filter delivery typecheck
pnpm --filter delivery build
```

The component suite covers the constrained 320 by 568 touch viewport and the
default desktop viewport, minimum target geometry, focus return, reduced motion,
single and bulk completion, scan/no-scan states, loading, explicit overrides,
and same-frame repeat submits. The physical-device matrix supplies the remaining
large-phone and browser-specific evidence.

## Physical-device matrix

Record observed results against the production delivery app. Do not mark a row
passed from browser emulation alone.

| Device class | Device / OS / browser | Hand | Routine single x10 | Bulk and override x10 | Offline / keyboard / reduced motion | Result | Tester / date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Small iPhone | Not run | Left and right | Pending | Pending | Pending | Pending | Unassigned |
| Current large iPhone | Not run | Left and right | Pending | Pending | Pending | Pending | Unassigned |
| Small Android | Not run | Left and right | Pending | Pending | Pending | Pending | Unassigned |
| Current large Android | Not run | Left and right | Pending | Pending | Pending | Pending | Unassigned |

For a failed row, record the exact control, screen state, viewport dimensions,
and reproduction sequence in the related GitHub issue before retrying.
