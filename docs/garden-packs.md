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

## Persistence foundation (#4985)

The source schema is `packages/storage/src/schema/gardenPackSchema.ts`; `gardenPacksRepo.ts` stores commercial grants separately from existing block/box inventory. `garden_pack_product_versions` prevents reusing a revision ID with changed snapshots across purchases or accounts. Purchases retain their own immutable snapshot and original charge. Each unit has immutable `(purchaseId, lineId, unitOrdinal)` identity and paid/recycling allocations; mutable state is `available → placed → recycled` or `available → refunded`. Remaining quantities and unopened/partially-used/exhausted status are derived from unit state, so no independent counter can overdraw. Consumption/credit events are append-only.

Owner-scoped listing is bounded (default 50, maximum 100). Detail and audit reads require the authenticated account and omit foreign-account inventory. The existing deletion fence serializes account mutations before purchase/unit locks. Both write primitives require a caller-owned transaction; there is no free-grant route or independently committed consume/refund. Unit operation IDs are **account-scoped**, including across purchased packs; replay with a different purchase, unit, kind or placement destination conflicts. A purchase operation key and a unit operation key belong to separate namespaces. The future API must keep its own full command/response receipt, call these primitives in the same transaction as economic/placement work, and return prior responses before attempting another block creation or wallet credit.

There is no inventory-expiry job. Account deletion's existing hard-delete detaches nullable ownership foreign keys on purchases and events, leaving nonpersonal snapshots/history inaccessible. Garden/block IDs on unit/audit records are historical references without cascading FKs; garden deletion therefore cannot erase commercial history. The configured policy remains a requirement for future garden recycling integration.

### Maintainer migration and rollback prerequisite

Follow `RELIABILITY.md`: run `pnpm db-generate`, review generated SQL, journal and snapshot **locally**, and leave new migration artifacts out of shared PR version control. Maintainers must regenerate and order the actual migration against the merge base before schema release. The command can use `pnpm db-generate --env-mode=loose` to pass a generation-only `POSTGRES_URL` through Turbo; generation does not connect to that database. Never run `pnpm db-push` for this work.

Drizzle table checks cover product/snapshot identities, ownership FKs, positive bounded ordinals, nonnegative values, allowed states and nonnull placement provenance. PostgreSQL cannot express cross-row sums, immutable snapshots or audit correspondence as ordinary table checks. The source-owned `packages/storage/src/schema/gardenPackIntegrity.ts` exports `gardenPackIntegritySql` for those guards; it executes nothing on import. **The reviewed deployment migration must append that exact SQL after its generated tables/FKs/indexes, in the same deployment transaction.** It enforces immutable product/purchase/unit allocation and audit history, exact unit counts/allocations matching the snapshot and charge at commit, and state transitions with original credits and matching audit provenance. Schema release is incomplete without these guards; no sales endpoint may use the primitives until table+guard readback is verified.

Rollback before any writes can remove the four pack tables (events, units, purchases, versions), then the four `garden_pack_*` trigger functions, in dependency order. After grants exist, disable new pack flows and preserve all tables/history; restoring old application code is the safe rollback. Do not drop paid entitlements or weaken guards to make a rollback pass. Recovery/import/retention tooling needs a separately reviewed maintenance procedure; ordinary application writes cannot delete commercial history.

### Persistence verification

`pnpm --filter @gredice/storage exec node --import tsx --test --conditions=react-server tests/gardenPackContract.node.spec.ts tests/gardenPacksRepo.node.spec.ts` creates only an in-memory PGlite database. The repository tests derive DDL from the **current Drizzle source**, install the exact source-owned integrity guards, and check isolated reads, repeat/retried grants, immutable versions/allocations, paid-value refunds/recycling, malformed/null SQL inputs, deletion fencing/history, rollback, and competing unit consumption. They do not require committed migration artifacts or live credentials. PGlite serializes one connection: competing submissions prove no overdraw under that scheduler; independent PostgreSQL connection/row-lock scheduling still requires deployment-stage validation before enabling money flows.

## Atomic purchase and owned API (#4986)

Authenticated routes are mounted at `/api/accounts/current/garden-packs`. They derive the owner solely from the selected authenticated account, require user/admin authorization and return private/no-store responses. Neither request account IDs nor public garden access select another owner's inventory.

- `GET /`: `{ enabled, accountId, purchases, hasMore, nextCursor }`. Disabled storage returns `enabled: false`, null account/cursor and an empty list before touching any pack table. Enabled reads expose only the current owner's immutable name/description/previews, purchase/product/revision IDs, purchase time, total/remaining quantities, state and exact line/variant/available ordinal projections. `limit` defaults to 20, max 50; the opaque cursor preserves PostgreSQL timestamp microseconds plus purchase ID. A foreign/unknown detail returns 404 through `GET /:purchaseId`.
- `POST /purchase`: `{ operationId: UUID, productId, quote: { productVersionId, chargedSunflowers, currency: 'sunflower' } }`. This accepts no client content or owner override. New sales require a positive configured sunflower charge. Invalid requests and insufficient balance return 400; missing products/accounts return 404; changed quote, unavailable offer or reused operation with different product/quote returns 409; disabled rollout or unavailable catalogue returns 503.
- Successful response: `{ purchaseId, productId, productVersionId, chargedSunflowers, currency, purchasedAt, totalQuantity, replayed }`. These fields, and the complete accepted request, are derivable from the immutable owner/operation key, product snapshot and creation timestamp. No additional mutable response table or recalculated catalogue values are needed. Every exact retry returns that original receipt before reading sales config, model directory or the catalogue. A timed-out client can safely retry the same operation. Original timestamps/price/quantity are retained; current wallet balance is refreshed independently.

`gardenPackPurchaseService.ts` first performs an owner-scoped receipt lookup, then prepares bounded trusted catalogue/model reads only for misses, before acquiring economic locks. It then takes the existing wallet advisory lock and durable account-deletion fence. Inside the same transaction it rechecks the receipt first (including when preparation failed while another request completed), checks the new-sales switch, validates offer/quote/content, debits using `spendSunflowersBatch` with `gardenPack:purchase:<operationId>`, grants the immutable snapshot/units, and verifies the resulting receipt. Any failure rolls back wallet events, automation-enqueue effects and grant rows together. Preparing shared-pool catalogue/directory readers before the transaction avoids cold-cache pool starvation. Purchase has no garden, placement-cell or garden-box dependency. Distinct new operation IDs buy additional full sets; account wallet locking prevents concurrent overspend.

### Rollout and trusted offers

All configuration remains unset/default-off in this change. There are no live writes or seeded pilot prices.

1. Maintainers must install and verify the ordered #4985 tables **and exact source-owned integrity guards**. `isGardenPackStorageReady` probes PostgreSQL system catalogues only, including all four tables and nine enabled triggers with deferred constraints. It safely reports false for an absent schema. This prerequisite probe does not certify an end-to-end commercial rollout or replace source/function readback.
2. Explicit server `GREDICE_GARDEN_PACKS_ENABLED=true` enables owned inventory and receipt lookup after migration readiness. It is a storage rollout control: **do not disable it merely to withdraw products or stop sales**, because owned inventory and receipt access must remain available.
3. Explicit server `GREDICE_GARDEN_PACK_SALES_ENABLED=true` enables **new** purchases only. It is false by default; turning it off preserves owned reads and exact receipt replays.
4. `GREDICE_GARDEN_PACK_CATALOGUE_JSON` is trusted server deployment configuration: an array of `{ snapshot, sale: { enabled, availableFrom, availableUntil } }`. It is empty by default. Strictly validated snapshots use the #4984 immutable revision format. The separate sale controls may withdraw or reschedule offers without rewriting purchased/version snapshots. One current offer per product is allowed. Client quotes only detect changes; they never supply contents or authoritative price.

Before enabling actual sales, complete prepaid placement #4988, provenance-aware lifecycle/refund handling #4990 and their independent deployment/live checks. The foundational storage readiness probe alone does not make the pilot ready. Until lifecycle integration lands, pack-backed existing recycle/store/delete paths must fail closed rather than mint value or lose provenance. None of this change promotes, publishes or configures an actual pack.

Purchase eligibility is an explicit known decorative-model allowlist, unique matching directory `entityId` and model name, `entityType: block`, `attributes.type: decoration`, both `functions.raisedBed` and `functions.recycler` false, and an ordinary positive individual-item sunflower price. Structural, raised-bed/crop, economic-box/recycler and animal actors cannot enter a paid pack through arbitrary catalogue metadata. Night-only individual-item rules use the existing configured default location when buying without a garden; after purchase, owned prepaid units remain usable across daytime, sale withdrawal and season expiry. Placement still validates current model/codec support. The shared `@gredice/js/gardenPackAppearanceVariant` codec accepts static `variant: null`, or exact registered appearance `{ versionId: 'entity-appearance:v1', appearance: { id: registeredVariantId } }`; it never randomizes or substitutes a selected appearance.

The inferred authenticated `@gredice/client` helpers expose `getGardenPackInventory({ cursor, limit, signal })`, `purchaseGardenPack(command)` and shared inventory response/types/query keys. Inventory callers should include authenticated user/current-account IDs in query keys, compare the returned account ID and cancel stale-account requests. After a successful purchase or replay, invalidate owned-pack inventory and the existing account sunflower balance query; retries retain the same operation ID and quote until resolved.

### Purchase validation

`pnpm --filter @gredice/storage exec node --import tsx --test --conditions=react-server tests/gardenPackPurchase.node.spec.ts` creates in-memory PGlite from current source DDL plus guards and exercises the real wallet repository, exact receipts, insufficient funds, concurrent requests, rollback, availability/quotes, malformed directory identities, account-deletion fencing, readiness and cursor/owner isolation.

For independent PostgreSQL connection scheduling, set `GREDICE_PACK_TEST_ADMIN_URL` to a **local disposable** `packtest` cluster's `/postgres` database and run that same command. The harness validates local host/user, creates a random `gredice_pack_purchase_*` database, installs source-derived DDL/guards, uses an eight-connection pool, asserts concurrent calls use different backend PIDs, and drops only that database in teardown. It never targets an existing service database. Route regressions run with `pnpm --filter api exec node --import tsx --test --conditions=react-server lib/garden/gardenPackRoutes.node.spec.ts`; the codec has a focused JS unit test.
