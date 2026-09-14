# Anchor prices and downloadable service price lists

The reference for newly covered goods and services is 10 September 2026.
[NN 101/2026-1212](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1212.html)
applies from 1 October 2026 and retains 2 May 2025 for the previously covered
retail categories, including food. The accompanying
[government announcement](https://mingo.gov.hr/vijesti/vlada-rh-usvojila-11-paket-mjera-energetske-mjere-vrijedne-170-14-milijuna-eura-sidrena-cijena-prosiruje-se-na-sve-proizvode-i-usluge/10430)
also describes machine-readable price lists and the 08:00 publication deadline.

## Scope and reference evidence

The public Gredice catalog contains cultivation per planted plant, garden
operations, delivery per kilometre and prepaid sunflower packages. These use
the service reference date. This classification does not cover a future
separate retail offering of harvested food, which must explicitly use
`foodAnchorDate` and include the required retail product metadata.

`getEntityAnchorPrices` reconstructs prices from CMS attribute revisions and
publication-state history. The reference instant is the end of the reference
day in Europe/Zagreb. It supports both statutory reference dates and is
independent of the rolling 30-day minimum. A current attribute can establish
an unchanged reference only when its creation and last update both predate
the reference cutoff. Drafts, newly introduced offerings, deleted values,
ambiguous multiple values and missing evidence do not receive a fabricated
historical price. No baseline is backfilled into production by this change.
Legacy entities without `publishedAt` can establish publication through a
dated unchanged entity state or a state-bearing revision. An undated current
`published` state alone is insufficient.

Directory price attributes are the regular price source; outlet reductions
remain separate checkout discounts. Reference prices never use those
discounts. The public delivery calculator has a separate fixed rate; its
€0.20/km baseline is recorded independently from the current rate, with the
source Git commit beside the constant.

## Display

`AnchorPrice` is shared by WWW and Garden. It compares EUR amounts as formatted
to cents. Equal amounts appear once with `Ista cijena kao 10. 9. 2026.`; changed
amounts get a dated reference amount. This is the requested presentation of
equal prices, not an exemption from displaying the reference date. Unknown
history adds no claim. A matching reference price also suppresses an older
30-day minimum. For changed or unknown references, the public catalog retains
a separate 30-day minimum only when it differs from the current amount.

WWW covers the price list, plant/sort/operation price cards, sunflower package
cards, delivery pricing and delivery quote. Garden covers plant and operation
selection, operation scheduling, sunflower package offers and unpaid cart
items, including the checkout view of those items. Paid history and inventory
redemptions are excluded. The public `GET /api/pricing` feed and
`GET /api/docs/pricing` contract expose only published catalog entries;
`anchorPrice: null` means evidence is unavailable.

## CSV publication and retention

- `/cjenik/cjenik.csv`: latest published CSV, with no browser/CDN caching.
- `/cjenik/preuzimanje`: links to versions from the last 30 days.
- `/cjenik/preuzimanje/{id}`: immutable CSV download. Older links continue to work.
- `/api/internal/cron/publish-price-list` on API: authenticated with the existing
  `CRON_SECRET`, scheduled at 05:00 UTC daily (06:00/07:00 Zagreb, before 08:00).

Published versions are immutable `pricing.catalog.published` events. A short
transaction and advisory lock deduplicate equal same-day exports and reject
an older observation arriving after a newer publisher. The filename includes
the web sales channel, HQ address, outlet identifier, storage sequence and UTC
timestamp. The CSV includes service identity, unit, current price, currency,
special-sale fields, reference amount/date and availability. Equal reference
amounts remain present in machine-readable data; missing evidence stays blank.
Names are CSV-escaped and spreadsheet formulas are neutralized.

Admin directory saves/imports/publication/deletion use the existing public
revalidation hook to publish changes to these catalog types, including HQ
locations. Failed publication is logged; the committed directory save remains
successful, the previous CSV stays available and the daily publisher retries.
Scripts writing directly to storage must call `publishPublicPriceList()` after
completing a public price change. New retail product lines, external adverts,
and provider-hosted checkout copy need their own coverage when introduced.

The first CSV becomes available after the first successful scheduled or
authenticated publication. Until then the latest-download route returns 503
and the archive explains that no version has been published. Deployment does
not establish that the first scheduled run succeeded or that all historical
prices are available; inspect publication logs and the CSV after rollout.

## Validation

```sh
pnpm --filter @gredice/js exec node --import tsx --test src/pricing/anchorPrice.unit.ts
pnpm --filter @gredice/storage test:node tests/entityPriceHistoryRepo.node.spec.ts tests/entityAnchorPrice.node.spec.ts tests/priceListCsv.node.spec.ts tests/publishedPriceListsRepo.node.spec.ts
pnpm --filter www test:pricing
pnpm typecheck --filter www --filter garden --filter @gredice/game --filter @gredice/ui
pnpm --filter api exec next typegen
pnpm --filter api exec tsc --noEmit --pretty false
```
