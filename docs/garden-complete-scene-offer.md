# Ownership-aware scene offers

## Status and purpose

Design for #4993, a **Later** exploration under #4946. This specifies a future
offer; it adds no endpoint, schema, purchase control or production configuration.
The existing [pack contract](garden-packs.md) continues to sell complete finite
sets independently of possessions. [Manual examples](autumn-arrangements-2026.md)
remain manual; group placement is separate work in #4992.

The customer chooses which eligible pieces to reuse, reviews only the additional
pieces and their price, and buys those additions into account-owned inventory.
Buying additions never moves or consumes an existing possession. Placement is a
separate, explicit action after the purchase.

## Actors and eligibility

The authenticated current account owns inventory and the quote. A public viewer,
foreign account or sandbox cannot inspect private possessions or submit a paid
offer. A selected destination, when present, must be an active ordinary garden of
that account; buying additions does not require free space or garden-box slots.

The conservative first implementation admits only **available, unplaced exact
pack units**, selected explicitly by the customer. It does not automatically
count everything the account owns.

| Source | Counts toward this version? | Reason |
| --- | --- | --- |
| Available purchased unit | Yes, after selection | Exact purchase/line/ordinal identity and fixed appearance are known. |
| Placed decoration in any garden | No | Reusing it would require an explicit move and occupancy/placement contract. |
| Ordinary coalesced garden-box stack | No | An entity total does not prove an exact appearance or individual paid provenance. |
| Exact prepaid unit stored in a box | No | It is still `placed`, with a physical location and a distinct retrieval lifecycle. |
| Refunded, recycled or inaccessible unit | No | It cannot supply another placement. |
| Public/shared garden, preview or scenery | No | Visibility and a pictured object confer no entitlement. |

Unavailable sources remain visible only where the account can already inspect
them, with a reason; they must never be silently subtracted from the payable
quantity. Later support for moving placed items or retrieving boxed pieces needs
its own selection, locking and atomic placement design.

## Matching and quantity rules

The server loads a reviewed, immutable layout version and its included item
requirements. Surrounding scenery is excluded. An eligible match requires the
same published directory entity, runtime model and canonical appearance codec
version/value. Static `variant: null` matches only a static line; a differently
coloured or unsupported appearance is not a substitute. A changed asset or layout
requires a reviewed version and a fresh quote.

For each requirement: `additional = required - explicitly selected matching units`.
Selection cannot exceed required quantity. One `(purchaseId, lineId, unitOrdinal)`
may occur once across the entire offer. The server validates account ownership,
`available` state and current placement support for every selected unit; request
IDs never establish ownership. Different purchase revisions may supply matching
units, while each retains its own original paid/recycling values.

Suggestions use a stable purchase-time/purchase-ID/line/ordinal ordering, but are
unchecked by default. The customer may select fewer units or choose all new
copies. Changing selection replaces the displayed quote before confirmation.
Missing models, catalogue identities or exact appearance support block that
requirement; there is no automatic substitution or invented directory ID.

## Customer flow and quote

1. Open an example and inspect its complete included list, separate scenery and
   exact appearance. Offer **Dopuni ovaj prizor** only after this separate feature
   is implemented and its prerequisites are enabled.
2. Show eligible owned units with source purchase and appearance. The customer
   opts into **Upotrijebi nepostavljene komade** per line or individual unit.
3. Display a review table: required quantity, selected owned quantity, additional
   quantity, individual unit price and additional line total. Clearly identify
   the preview as the complete composition, not the contents of this new purchase.
4. Confirm using **Kupi dodatne komade · [total] suncokreta**. The receipt and
   inventory list contain only purchased additions. Existing selected units stay
   in their original purchases. If nothing is missing, show **Pregledaj svoje
   komade**; perform no debit, zero-price grant or purchase operation.
5. Place individual owned units through existing prepaid placement, or later
   select the separately implemented #4992 group preview. Cancellation of a
   placement keeps ownership intact; it does not reverse an already completed sale.

The future server stores a private quote with current account ID, quote ID,
layout/version, canonical selection, additions snapshot, price/policy revision,
created/expiry times and content fingerprint. A quote lasts five minutes,
evaluated with server UTC time. It is a proposal with **no reservations** and no
wallet, inventory or garden side effects. The UI states that selected pieces are
not held and placement space is checked later. Background refresh or account
switch invalidates the visible review rather than silently changing its amount.

New additions use validated positive integer sunflower prices from the trusted
current individual offers, summed without an assumed discount. Paid allocations
and recycling values are exact per-unit immutable arrays under the existing pack
policy. Old selected units keep their original allocations. The new server-owned
product revision identifies only the purchased additions and their exact preview,
copy, price and policy; it must change when any immutable field changes. A full-set
product ID/revision cannot be reused for a subset or account-specific price.

Use the existing contract limits (at most 100 lines and 1,000 total units), strict
input validation, bounded owner reads and rate limits. Never accept client price,
content, ownership or refund allocations as authoritative. No public route or
analytics payload exposes selected inventory IDs.

## Future transaction and retry contract

Implement this as a distinct authenticated purchase command, with durable typed
command/response receipts. The current simple pack service does not accept owned
selections or derived subsets, so it must not be invoked as an implicit substitute.
The request identifies the expected current account, quote and operation UUID;
the full canonical command is stored. Changed reuse of a successful operation
conflicts, including reuse through another purchase-command kind.

1. Assert the authenticated expected account and storage readiness. Read an
   owner-scoped completed receipt first; an exact uncertain-response retry returns
   that receipt even after quote expiry, sale withdrawal or directory removal.
2. On a miss, prepare bounded trusted catalogue/model dependencies outside the
   transaction. Recheck the receipt under the existing wallet lock and account
   deletion fence even when dependency preparation failed meanwhile.
3. Lock and revalidate selected purchase/unit identities in stable order compatible
   with existing consumption/refund locks. Revalidate unexpired quote, exact
   additions revision, current offer availability, account and wallet balance.
   A selected unit consumed or refunded elsewhere yields a conflict and a new
   inspectable quote; do not silently buy a replacement.
4. In one transaction, debit only the accepted additions price, grant only those
   units with their immutable allocations, and save the complete receipt. Any
   failure rolls back all three. Selected old units receive no state/location,
   paid-value or ownership change; no garden lock or placement mutation is needed.
5. Invalidate owned inventory and account balance after success/replay. Retain the
   same operation and accepted quote during an uncertain response. A new quote or
   changed selection uses a new operation only after the previous outcome is resolved.

After commit another action can still use an old selected unit because there is
no reservation. The UI must not promise a guaranteed complete placement. #4992
must revalidate and atomically consume the exact selected units and create all
blocks; a missing unit, collision or stale garden state places nothing. It must
never compensate by buying additional copies automatically.

## Edge cases and acceptance before implementation

| Case | Required result |
| --- | --- |
| Same unit selected for two requirements | Reject before purchase; grant/charge nothing. |
| Different appearance, moved/stored/refunded unit or foreign identity | Reject reuse; show a corrected review, never add an automatic charge. |
| Price, policy, layout or included-model change | Invalidate quote and request a new explicit confirmation. |
| Insufficient balance, expired quote, unavailable dependency or deletion fence | No debit/grant or changes to old possessions. |
| Concurrent confirm/retry or lost response | One additions grant/debit, original receipt; changed command conflicts. |
| Concurrent refund/placement of a selected old unit | Serialize exact-unit revalidation; conflict if it is no longer available at purchase. |
| Successful sale followed by failed group placement | Purchased units remain owned; fresh preview or ordinary placement remains possible. |
| Offer withdrawn or season ends | Prevent new sales; preserve receipts, unused refunds and owned placement. |
| Only eligible old units, no additions | No purchase command or economic write. |
| Account changes while confirming/retrying | Keep the original pending identity; reject submitting it as the new account. |

Test canonical quantity/appearance matching, complete vs subset previews, explicit
unchecked reuse, zero-addition reviews and private owner isolation. Future service
tests need real concurrent PostgreSQL connections for confirm vs refund/placement,
rollback injection and exact receipt replay. Browser tests must cover keyboard/
touch review, account switches, changed quotes and uncertain responses. Profile
and collision checks belong to #4992 when group placement is implemented.

## Dependencies and source map

- #4991 publishes verified exact products; #4984–#4990 supply immutable contracts,
  ownership, receipts, purchase and lifecycle handling. #4992 supplies optional
  atomic group placement. This design does not enable either feature in pack v1.
- Requirements/scenery: `packages/js/src/autumnArrangements/index.ts`.
- Appearance matching: `packages/js/src/gardenPackAppearanceVariant/index.ts`.
- Current inventory projection: `packages/storage/src/repositories/gardenPackReadRepo.ts`
  and `packages/game/src/hud/ownedGardenPackInventory.ts`.
- Economic transaction/receipt patterns: `apps/api/lib/garden/gardenPackPurchaseService.ts`,
  `gardenPackPlacementService.ts` and `gardenPackLifecycleService.ts`.
- Exact locations and immutable values: `packages/storage/src/schema/gardenPackSchema.ts`
  and `gardenPackIntegrity.ts`; new quote/typed-receipt storage would require a
  separately reviewed schema/guard change under `RELIABILITY.md`.
- Ordinary box restrictions: `packages/game/src/gardenBoxInventoryLimits.ts` and
  `apps/api/lib/garden/gardenBoxBlockPlacementService.ts`.

Quote IDs, sale controls and new command storage are proposed contracts, not
existing configuration. Keep this offer unavailable until a dedicated implementation,
security/economy review and deployment acceptance pass. Docs-only validation:
`git diff --check`, source-link readback and independent contract review.
