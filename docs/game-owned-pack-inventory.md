# Owned garden-pack inventory

Issue [#4987](https://github.com/gredice/gredice/issues/4987) adds **Paketi** beside
Ruksak and Kutije in the existing inventory modal. Each purchase is separate,
including repeat purchases of the same product. Its immutable snapshot supplies
the product name, exact model/appearance identities, original quantities and
remaining units. Purchase date and the full purchase identifier distinguish copies.

Unopened, partially used and exhausted purchases remain visible. The query reads
owned units, without filtering by current promotion dates, publication or prices.
Closing/reloading the view does not consume anything. Missing catalogue identities
or unsupported runtime models retain their quantities and show an unavailable
message; no replacement identity is selected. Current catalogue labels are only
display labels. A changed model/ID cannot change the purchased contents.

The client query is disabled and the tab hidden for anonymous, mock, local sandbox,
server sandbox and rollout-disabled sessions. Its cache key includes the current
user and active account; it waits for matching account identity and verifies the
response owner. Pagination preserves all purchases. Loading, empty, error/retry
and refresh states use the same modal and keyboard-reachable controls.

`GameScene` accepts `gardenPacksEnabled`, default false. Garden and WWW pass
`NEXT_PUBLIC_GREDICE_GARDEN_PACKS_ENABLED === 'true'`. This public flag only exposes
the UI; it provides no authority to purchase or place. The API's independent,
default-off `GREDICE_GARDEN_PACKS_ENABLED` remains authoritative. Neither flag nor
any live configuration is changed by this implementation.

`InventoryHud.packPlacement` is the integration boundary for #4988. Its `place`
callback receives purchase ID, line ID, available unit ordinal, exact entity ID,
model name and the immutable variant snapshot. It must use the dedicated prepaid
endpoint, never ordinary `useBlockPlace`. Without an adapter, placement is visibly
disabled. The inventory does not decrement counts optimistically. It closes only
after the adapter confirms success; errors retain the list and expose refresh/retry.
The #4988 `useGardenPackUnitPlace` adapter is wired through GameHud and owns operation replay and invalidation of owned inventory and
garden queries. Existing backpack and garden-box behavior remains independent.

Local validation uses the pure projection/gating tests and a focused browser
fixture for the actual InventoryHud, including repeat identities, saved counts,
mobile keyboard expansion, missing assets, error retry and request gating. This
is not verification of live rollout or deployed model availability.

```sh
pnpm --filter @gredice/game exec tsx --test src/hud/gardenPackInventory.unit.ts
pnpm --filter garden exec playwright test --config playwright.garden-pack-inventory.config.ts
pnpm typecheck --filter @gredice/game --filter garden --filter www --filter storybook
```

The browser configuration also covers the existing backpack/garden-box flows.
`packages/game/hud/GardenPackInventory` in Storybook covers unopened, partial,
exhausted, missing-model, unsupported-appearance and failed-placement purchases.
