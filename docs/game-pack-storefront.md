# Ponuda paketa za vrt

`GardenPackStorefrontHud` is an authenticated, ordinary-garden entry next to the inventory. Croatian offer cards show exact snapshot quantities, fixed variants, server quote, optional current individual-price comparison, and a purchase review. Individual decorations remain available through the existing item controls. Purchase stores units; the storefront never automatically places or consumes them.

## Deployment prerequisites

The default catalogue is empty. This change contains no production products, prices, seed, publication or live configuration changes. A reviewed server deployment may provide bounded `GREDICE_GARDEN_PACK_CATALOGUE_JSON` snapshots. The server independently requires both `GREDICE_GARDEN_PACKS_ENABLED=true` and `GREDICE_GARDEN_PACK_SALES_ENABLED=true`, the manual pack tables, and all nine enabled integrity triggers checked by storage readiness. Missing guards or either disabled gate returns an empty disabled catalogue before reading offers. See [purchase and storage prerequisites](garden-packs.md). Do not enable sales before the reviewed schema and integrity installation is complete.

`NEXT_PUBLIC_GREDICE_GARDEN_PACKS_ENABLED=true` only shows UI; it grants no authority. Anonymous, sandbox, local and mock scenes do not query offers. GET `/api/accounts/current/garden-pack-catalogue` authenticates the current owner and uses `private, no-store`; queries are keyed by current user and account, and reject mismatched response ownership. Owned inventory is separate and survives promotion expiry or sales being switched off.

## Review and recovery

The server supplies the exact current version, sunflower charge and fixed included lines. It revalidates availability and funds when confirming the purchase. Only exact unique catalogue IDs/model names with positive integral prices produce an individual-price total. The UI states a positive price difference only when the returned arithmetic supports it; it never invents discounts.

The reviewed scene is shown only when all included model names and quantities exactly match an authored manifest, all variants are null, and the configured preview points at the reviewed `https://vrt.gredice.com/assets/arrangements/...` file. Pixels are loaded through the game's existing asset base. A separate caption derives and lists all scenery omitted from the purchase. Unsupported artwork is omitted rather than presented as the purchased contents.

Confirmation captures one UUID and one original quote. Network failures, malformed successful responses and HTTP 5xx or pre-receipt authentication/rate-limit rejections (401/403/408/429) retain that same command for retry, including after closing the modal or remounting the screen. A schema-validated pending command is kept in browser `sessionStorage` per user/account; the server remains authoritative. A local owner preflight failure cannot resolve an earlier uncertain purchase. Returning to the original owner recovers its command and original charged amount. A server-definitive rejection permits an explicit refreshed review; success/replay clears recovery, refreshes balance and owned inventory, and opens the pack inventory. A repeat purchase requires the explicit “Kupiti još jedan primjerak” action and a new review/UUID. No optimistic money or unit decrement occurs.

## Local verification

- `pnpm --filter api exec node --import tsx --test --conditions=react-server lib/garden/gardenPackCatalogueRoutes.node.spec.ts lib/garden/gardenPackCatalogueRead.node.spec.ts`
- `pnpm --filter @gredice/game exec tsx --import ./scripts/register-test-assets.mjs --test src/hud/gardenPackStorefrontProjection.unit.ts`
- `pnpm --filter garden exec playwright test --config playwright.garden-pack-storefront.config.ts`

The browser fixture uses the actual catalogue/purchase hooks and client helpers with intercepted local responses. Test quotes are explicitly fixtures, never runtime offers. Coverage includes mobile/keyboard review, exact quantities/scenery, comparison omission, normal confirmation, refreshed balance/inventory, explicit repeats, insufficient funds, stale quotes, catalogue retry, expiry, default-empty catalogue, rollout/auth/sandbox gating, and original-command recovery across closure/remount/account switching. These checks do not prove live rollout, database installation or configured product publication.
