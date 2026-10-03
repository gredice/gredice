# Optional owned-pack group layouts

Issue #4992 adds an optional server-owned placement layout to the owned-pack flow.
It does not buy a pack, debit a wallet, reserve units/cells, or include free scenery.
The three supported pilot products map to the reviewed `harvest-corner`,
`woodland-path`, and `evening-seat` arrangements. Only their `included` placements
participate; ground, trees, paths and other scenery remain outside the command.
Missing or partly used quantities do not create substitute units. Every resulting
block remains individually movable, rotatable, storable and recyclable.

## Layout identity and geometry

The independent `autumn-layout:v1` registry binds exact immutable purchase lines,
positive directory entity IDs, model names, fixed variants and quantities to the
reviewed arrangement. Unsupported contents return no layout. Current pilot models
use their registered static appearance (`variant: null`). `FallenLog` and
`AutumnBlanketBench` occupy 2×1 cells; the other included objects occupy 1×1.
These dimensions are authored registry data, not client or mutable catalogue input.

A layout version is `layout:<sha256>` of canonical JSON containing the registry
revision, immutable purchased product version and complete placement descriptors.
Offsets, rotations, footprints, identity or variant changes produce a new version.
Available unit ordinals are a separate projection and do not change that version.
Publication, sale windows, current sale prices and discounts do not gate prepaid
placement. Missing/ambiguous current directory identities, changed footprints,
unsupported appearances or structural functions fail closed.

`@gredice/js/gardenPackLayouts` rotates every occupied cell about the layout origin
using the existing positive-Y model rotation convention. It then computes the
positive-axis anchor of the rotated rectangle. The ordinary placement resolver's
optional `requestedRotation` validates the candidate's span independently of
existing blocks' rotations. No same-model directory dimensions are rewritten.

## Authenticated API and recovery

Both routes live under `/api/accounts/current/garden-packs` and require a user or
admin session. Responses use `Cache-Control: private, no-store`.

- `GET /:purchaseId/layouts` returns `{ enabled, accountId, purchaseId, layouts }`.
  Each layout has `id`, `versionId`, localized `name`, exact `placements` and
  `availableUnits`. Disabled/incomplete storage returns an empty disabled shape
  before optional pack-table access. Foreign purchases return 404. Unsupported
  or unavailable directory data omits layouts while ownership remains visible.
- `POST /:purchaseId/layouts/:layoutId/place` requires `operationId` (UUID),
  `expectedAccountId`, `gardenId`, `layoutVersionId`, integer `anchor`, `rotation`
  (0–3), exact `{ slotId, lineId, unitOrdinal }` assignments and `expectedStacks`.
  Assertions contain **every** covered cell, including empty cells with `blocks: []`.
  Client-supplied offsets, variants, replacement models and ownership are rejected.

The authenticated current account supplies ownership authority. `expectedAccountId`
is only a precondition; a mismatch returns 409 before dependencies or storage.
The body preserves unit selection and cell assertions across retries. Cancelling a
preview does not send a mutation or reserve anything.

An exact completed command replays its durable response before consulting layout
availability, directory data or the current garden. Changing any command field,
including assertions or selected ordinals, with the same operation UUID returns 409.
A successful response reports `chargedSunflowers: 0` and every individual block ID,
model, runtime variant, rotation, position, line and unit ordinal.

The client validates response shape, command identity and unique unit/block/slot
membership. Network loss, invalid receipt, 401/403, 408/429, 5xx and expected-account
mismatch remain uncertain: retain the original command and UUID for recovery.
Definitive business failures such as collision or missing quantity can clear the
pending command. The game UI uses the recovery flow below.

## Transaction and receipt invariants

Directory preparation runs outside the economic transaction, after a preliminary
owner-scoped replay check. The authoritative replay check runs again under the
account economic lock and deletion fence, so a concurrently completed receipt wins
even if preparation failed. No wallet mutation occurs.

Lock order is account fence → owned purchase/units in stable line/ordinal order →
garden lock and rows. All candidate footprints validate against existing structures,
support, heights and one another before any writes. Every physical block, quarter
turn through the existing block-update event path, stack update, provenance location,
unit consumption and receipt commits in that one transaction or rolls back together.
Stale non-anchor cells, missing units, foreign/sandbox/deleted gardens, collisions
and unsupported catalogue entries cannot partially place a layout.

Existing immutable unit events provide the durable group receipt without a schema
change. The first unit uses the public operation UUID and a typed
`group-placement:v1` payload. Other units use deterministic internal IDs of 108
characters, longer than public unit/lifecycle operation-ID limits and below the DB
128-character limit. All root/member IDs are checked for existing unit-event and
lifecycle-receipt collisions before writes. Member payloads use `group-member:v1`;
ordinary placement replay rejects both group payload kinds. This namespace covers
unit placement/lifecycle mutations; purchase receipts retain their existing separate
purchase namespace.

Each unit response keeps its scalar `blockId`, `variant`, and `position`, with the
complete typed group response nested alongside it. The existing deferred physical
provenance guard therefore continues to match the immutable fixed variant. Later
individual lifecycle operations use the original per-unit paid/recycling allocations,
never today's item price. Original group replay remains available after those moves
or terminal lifecycle transitions.

## Rollout and validation

The existing default-off `GREDICE_GARDEN_PACKS_ENABLED` gate and complete purchase,
placement and lifecycle readiness probes apply. Maintainers must first deploy the
ordered existing pack DDL **and** source-owned integrity guards according to the pack
storage/lifecycle docs. This change needs no new tables, columns, generated migration,
live configuration, catalogue edits or sale enablement. Local tests are not deployment
or production acceptance.

Focused commands from the repository root:

```sh
pnpm --filter @gredice/js exec node --import tsx --test src/gardenPackLayouts/index.unit.ts src/gardenBlocks/index.unit.ts
pnpm --filter api exec node --import tsx --test --conditions=react-server lib/garden/gardenPackGroupPlacementRoutes.node.spec.ts lib/garden/gardenPackGroupPlacement.storage.node.spec.ts
pnpm --filter @gredice/client exec node --import tsx --test tests/garden-pack-layouts.node.spec.ts
```

The group integration wrapper runs nine cases by default in a fresh private PGlite
child process, with no new opt-in skips. It covers all twelve pilot/turn combinations,
rotated non-anchor collisions, foreign ownership, stale versions/cells, exact and
competing concurrent submissions, cross-kind/member-ID conflicts, directory failure,
write rollback, and actual rotation/stack-planner plus store/retrieve/recycle paths.
PGlite submissions share one connection; independent PostgreSQL connection scheduling
was additionally verified using the wrapper's disposable local PostgreSQL option.
Both providers use source-derived DDL and the same integrity SQL, and remove their
private database after the run. Four auth/schema route cases, four runtime client
recovery cases and three new geometry cases also pass (20 new cases total).

API typechecking passes. Direct storage/client typechecks reproduce exactly the clean
`fcbfadc62` baseline after normalizing worktree paths (52/39 diagnostic lines), with no
new-file errors. The direct JS typecheck likewise matches its existing 32-line baseline. The focused JS run also includes 17 existing placement cases (20 total).
Existing isolated placement and lifecycle suites pass 7 and 11 cases respectively.


## Owned-pack preview in the game

In the 3D inventory, an eligible owner opens a paid pack and selects **Postavi kao na slici**. The client fetches the current server-owned layout and available exact unit ordinals for that purchase; unsupported or withdrawn layout/model identities leave ordinary inventory visible. Owned placement does not require a current positive shop price, another purchase or additional sunflowers.

The optional panel shows total required/available quantities; its expandable item list uses Croatian labels with per-item counts. Its translucent model ghosts and footprint cells move together by a short canvas tap, the arrow controls/keys, and quarter-turn rotation (**R** or **Zakreni 90°**). The existing geometry resolver checks every rotated cell against ground/support, structures, multi-cell occupants and other proposed pieces. A collision or missing unit keeps every renderable ghost visible with red cells and disables confirmation; unsupported metadata gives a persistent reason. **Odustani** or **Escape** removes the preview without an API mutation. The panel receives keyboard focus and cancellation returns focus to the inventory trigger.

Cached asset geometry/materials stay untouched. The preview owns translucent material clones and disposes them on move/cancel/unmount; JSX-owned decoration materials also clean up. Preview scope suppresses rain/snow overlays, lamp registration/point lights and steam registration. Ghosts have no picking targets or spring animation leases. Model-load errors disable confirmation and instruct the owner to refresh the page before reopening, because the shared GLTF loader caches failed requests. No placement command is created for an unready preview.

Confirmation captures the exact reviewed UUID, owner, purchase/layout/version, selected unit ordinals, anchor/quarter turn and **all** footprint cell stack IDs. It writes this command to owner-and-garden-scoped session storage before submitting. There is no optimistic charge, grant, placement or inventory consumption. A verified receipt invalidates private garden/inventory reads; the resulting blocks retain their normal individual editing and lifecycle paths.

An uncertain response keeps **Provjeri isti zahtjev**, including after remount/reload and when a layout is subsequently unavailable. Movement, rotation, recycling and ordinary placement controls remain paused until that command resolves. A different account or garden hides the pending session and cannot submit or unlock it; returning to the original owner/garden restores exact recovery. A definitive business rejection clears the old UUID and refreshes private reads; a fresh review can use a new command. Garden changes before initial confirmation disable it and require a fresh preview. Switching to 2D/walking cancels an unsubmitted preview.

Frontend validation from the repository root:

```sh
pnpm --filter @gredice/game exec tsx --import ./scripts/register-test-assets.mjs --test src/packLayouts/packLayoutProjection.unit.ts src/gardenOverview2DBundleBoundary.unit.ts src/viewers/outletGardenBrowserBundleBoundary.unit.ts
pnpm --filter garden exec playwright test --config playwright.pack-layouts.config.ts
pnpm --filter @gredice/game exec tsc --noEmit --pretty false
pnpm --filter garden typecheck
pnpm --filter www typecheck
```

The focused browser fixture uses actual WebGL models, camera projection and the production inventory action, planner, HUD and request hook. It checks mobile/keyboard/touch movement, four turns and exact multi-cell footprints, complete invalid previews, cancellation without writes, stale garden/missing quantities, owner switching, an exact lost-response retry through remount, and definitive rejection followed by a new operation. API responses are private local fixtures; this is not deployed/live commerce acceptance.
