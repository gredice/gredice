# Garden packs: versioned purchase and ownership contract

## Summary and actors

A **collection / kolekcija** groups individually available decorations for browsing. A **pack / paket** is one account purchase granting exact finite quantities. A **layout / predložak** describes an arrangement and grants nothing. A purchased pack is separate from a garden box (six item-type stacks of ten); no box slot or appearance restriction applies to the pack entitlement.

Customers buy and place account-owned pieces in their own active, ordinary gardens. Sandbox gardens have no economy and cannot consume paid pack inventory. Account members act through the authenticated account; sharing/public viewing does not confer ownership. Admins configure products, and the server validates every item, variant, price and lifecycle policy. Ambient autumn effects remain available to everyone.

## Configuration and shared contract

`packages/storage/src/gardenPackContract.ts` is the version-1 shared, validated contract (also available via `@gredice/storage/gardenPackContract`). No sale, catalogue seed, route or money movement is enabled by this foundation.

- `productId` identifies a reusable product; `productVersionId` identifies an immutable revision. A revision must never be reused with changed contents, price, visuals, translations, variants or policy. `contractVersion` identifies the snapshot format.
- Each version has localized name/description, absolute preview URLs, publication state and optional UTC availability dates. The start is inclusive; the end is exclusive. All amounts are integer **sunflowers**, using the existing `sunflower` currency key. Final price is a configured decision; there is no new currency or assumed discount.
- A stable `lineId` identifies each exact directory block `entityId`, `modelName`, quantity and nullable versioned appearance variant. `variant: null` means the default appearance; a selected variant snapshots its exact appearance properties and version. Numeric directory IDs are represented as strings. Example model names below must be reconciled to actual catalogue IDs before publishing.
- Every unit has a one-based ordinal within its line. Two arrays record its exact paid and recycling values, including any integer rounding. Paid allocations sum **exactly** to the charged price; recycling values are configured nonnegative amounts no higher than their unit's paid value. No future catalogue price changes these values.
- Required policy version: unused units refund their allocated paid value; placed units cannot be refunded as unused. A placed piece may recycle once for its configured recycling value. A refund terminates that unit; recycling terminates that placed unit. No operation both returns inventory and credits its value. Different future policies require a new contract version rather than silent reinterpretation.

### Example: Jesenski kutak

The proposed product `jesenski-kutak` contains these exact five lines (nine pieces). It stays a draft until actual directory IDs, variants, previews, product/policy revision IDs, charge and every per-unit allocation are configured.

| Stable line | Decoration | Quantity | Appearance |
| --- | --- | ---: | --- |
| pumpkins | Pumpkins | 3 | Explicit configured pumpkin variant |
| hay-bales | Hay bales | 2 | Explicit configured hay variant |
| scarecrow | Garden scarecrow | 1 | Explicit configured scarecrow variant |
| lanterns | Lanterns | 2 | Explicit configured lantern variant |
| sign | Sign | 1 | Explicit configured sign variant |

Pricing remains a product decision. The contract intentionally provides no executable seeded product with invented entity IDs, allocations or price.

## Current entry points and future integration

Current `apps/api/lib/garden/purchaseGardenBlockService.ts` buys and immediately places one item; `apps/api/lib/garden/gardenBoxBlockPlacementService.ts` consumes box inventory. `packages/game/src/gardenBoxInventoryLimits.ts` limits box stacks, and `InventoryHud` renders that existing inventory. They do not read packs.

Future pack purchase must resolve a server-owned published revision, validate **ordinary individual-item availability** plus models/variants, and perform wallet debit + purchase snapshot + grant in one transaction. Client price/contents are never authoritative. Use a durable account-scoped operation key: the same request replays the existing purchase; the same key with a different snapshot conflicts. A repeat purchase with a new key grants another complete set, without subtracting already-owned decorations or granting unlimited copies.

Future prepaid placement must authorize the active ordinary garden, validate the current model/variant and legal placement, consume one specified available unit and create a block with pack provenance in **one** transaction. A failed placement leaves the unit available. Replayed operations must return the same block without another debit/consume. Placement must follow the global economic lock order (wallet/account fence before garden locks) and pass the same transaction through repositories.

`apps/api/lib/garden/gardenBlockMutationService.ts` (`recycleGardenBlockForAccount`), `gardenDeletionService.ts`, box storage and retrieval must preserve purchase/line/ordinal provenance and the original paid/recycling allocations. Existing block-paid refund paths must not also credit a pack piece. Storage in a box does not restore its entitlement or reset recycling; taking it back out retains its provenance. These services remain unchanged until their explicit integration work lands.

## Lifecycle and failures

| Event | Required behavior |
| --- | --- |
| Purchase | Save immutable version and exact charged allocations; all units start available (unopened). |
| Partial use | Each successful placement moves one unit to placed; remaining units persist (partially used). |
| Repeat purchase | New operation/purchase ID, independent units and allocations. |
| Promotion/season ends | Disable new purchase; owned unplaced pieces never expire or get repriced. |
| Catalogue/version changes | New revision for new purchases; old snapshot stays intact. |
| Model or appearance unavailable | Block new placement, retain the unit and surface retry/refund; no substitute, consume or charge. Refund remains possible under its original policy. |
| Refund | Available units only, exact allocated paid amount; atomic terminal state + wallet credit and audit receipt. Partial use does not forbid refunding unused pieces. |
| Recycling | Placed units only, configured value once; atomic removal + terminal state + wallet credit and provenance-aware audit. |
| Garden deletion | Unplaced inventory is account-owned and unaffected. Placed units follow the snapshotted once-only recycling policy; do not restore pack quantities. Retain original garden/block identities as audit references. |
| Account deletion | Fence new purchase/placement/refund work with the existing durable deletion lifecycle. Remove ownership/access, keep nonpersonal commercial snapshot and immutable audit history according to retention rules; no accessible orphan inventory. |

Catalogue preparation failures leave all economy/inventory state unchanged. Missing pricing, incomplete allocation or missing policy makes a product invalid, including drafts submitted as purchase snapshots. Authorized routes must always derive account ownership from the session and filter storage reads/mutations by it. No public garden route exposes pack inventory.

## Delivery stages and validation

This contract is #4984 of epic #4946. Persistence is #4985; atomic purchase, inventory API/UI, prepaid placement and lifecycle integration follow separately. These foundations do not claim that pack sales or refunds work through the current API.

Validate parsing and exact allocation with `pnpm --filter @gredice/storage exec node --import tsx --test tests/gardenPackContract.node.spec.ts`; run storage TypeScript and focused Biome checks, plus `git diff --check`.
