# Autumn item collections

Issue [#4982](https://github.com/gredice/gredice/issues/4982) adds **Jesen** to
the garden item bar. It uses the existing picker, item information, sunflower
price, purchase and drag-placement flows. These are collections of separately
purchasable decorations; selecting a collection grants no items and changes
neither ownership nor customer crop dates.

The curation lives in
`packages/game/src/hud/autumnItemCollections.ts`. Existing category entries,
including **Ljeto**, remain available.

| Stable ID | Label | Curation |
| --- | --- | --- |
| `harvest` | Jesenska berba | Decorative pumpkins, scarecrow, crates, wheelbarrow, hay, sign, lantern and path |
| `woodland` | Šumski kutak | Mushrooms, fallen log, leaf piles, acorns/conkers, grasses, deciduous trees, evergreen contrast, feeder/shelter, stones and paths |
| `evening` | Topla večer | Blanket bench, tea table, firewood, brazier, existing seats/tables and warm lights |
| `garden` | Jesenski vrt | Asters, shrub/maple, rake, drying rack, entrances, grasses, leaf piles, existing pots, signs, fence/gate and path |
| `chestnuts` | Kestenijada | Chestnut cart, harvest crates, seating, tea table, lanterns and sign |
| `pumpkin-night` | Noć bundeva | Carved pumpkin lights, friendly ghost/cobweb, decorative pumpkins, hay, lantern and sign |

## Availability

- Curation uses exact runtime entity identities already included in this model
  stack. Public discovery intersects those identities with public directory
  rows and a finite positive sunflower price. Missing rows, scene-only rendering
  fallbacks and non-sale entries are omitted. An empty collection is omitted;
  Jesen itself is omitted when all collections are empty.
- Kestenijada appears only when its chestnut cart is offered. Noć bundeva appears
  only when a pumpkin light or friendly ghost/cobweb is offered. Generic lanterns
  and signs alone cannot activate either event collection.
- Picker images come from the first visible member, so an unpublished pumpkin
  variant cannot become the collection's thumbnail.
- Published night-only items retain their usual **Noću** restriction. A low
  balance retains the ordinary **Nedovoljno suncokreta.** state; neither condition
  changes the catalogue price or creates an alternate purchase path.
- Multi-cell items display their catalogue footprint. Local sandbox data may
  preview non-sale models without charging; internal rendering fallbacks remain
  excluded.

Catalogue presence is a discovery gate, not proof that production model/image
URLs resolve. Runtime deployment, live catalogue publication, asset-byte
readback and authorized purchase acceptance remain part of
[#5000](https://github.com/gredice/gredice/issues/5000). This change publishes no
catalogue data.

## Validation

Focused checks from the repo root:

```sh
pnpm --filter @gredice/game exec tsx --import ./scripts/register-test-assets.mjs --test src/hud/autumnItemCollections.unit.ts src/hud/itemPlacementAvailability.unit.ts
pnpm typecheck --filter @gredice/game --filter garden --filter www
pnpm --filter garden exec playwright test --config playwright.autumn-collections.config.ts
```

Unit coverage checks empty/loading catalogue data, model identities, duplicate
members, partial publication, missing/non-sale rows, rendering fallbacks,
optional collection activation, exact variants, unchanged inputs, sandbox
previews and ordinary night/balance restrictions. Browser coverage exercises
the actual ItemsHud at a 390px mobile width with keyboard navigation, category
labels/images, item details, ordinary individual prices, unpublished-event
filtering, preserved Ljeto discovery, drag identity and insufficient balance.
It uses fixture catalogue data; it does not prove live commerce or physical
device performance.
