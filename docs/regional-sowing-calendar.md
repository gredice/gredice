# Regional sowing calendar

Issue: [#4790](https://github.com/gredice/gredice/issues/4790).

## Sources and publication

`/kalendar-sjetve` belongs to `apps/www`. Croatian explanations, GET filters,
crop links, the shared `RegionalCalendarTable` and review evidence render on
the server and work without JavaScript. The wide table is keyboard scrollable.

The only date source is the published directory `plant.calendar`, also used by
`/biljke?pregled=kalendar` and crop `PlantYearCalendar` graphics.
`calendarRangePosition` supplies month membership for both representations.
Fractional boundaries retain their precision as a percentage of the month;
they are not converted to invented days. Wrapped winter ranges are supported.
Missing or invalid boundaries stay unspecified.

| Directory activity | Regional meaning |
| --- | --- |
| `propagating` | Sjetva u zaštićenom prostoru |
| `sowing` | Izravna sjetva; for garlic, sadnja češnjeva |
| `planting` | Presađivanje |
| `harvest` | Berba |

Only salata, špinat, matovilac, češnjak and rajčica are in the pilot. The source
audit on 2026-09-20 found their calendar ranges, but **no attributable regional
grower reviews**. This audit date is not an agronomic review date. Accordingly,
`regionalCalendarReviews.ts` contains no reviews: the hub explains the gap,
renders unspecified periods, uses `noindex, follow`, and stays out of the
sitemap until all five crops have usable current reviews. Issue #4790 remains
incomplete until this editorial work is done. Never derive review metadata
from `information.verified`, `updatedAt`, a deployment, an AI review or this
document's date.

The three autumn articles and `/planovi-sadnje` were not published at the time
of the audit. `getRegionalCalendarRelatedGuides` includes their original URLs
once their CMS records are published, dated, indexable and canonical. There
are no duplicate articles or empty monthly routes.

## Recording a real grower review

Before each growing season, the content owner and grower must:

1. Review the current directory calendar, local conditions in continental
   Croatia, seed/variety information, and protected versus outdoor cultivation.
   Correct source dates through the existing directory editing workflow.
2. Record the grower's actual name, relevant role, review date (`YYYY-MM-DD`),
   and next seasonal review deadline (`reviewBefore`, exclusive). Record only
   evidence intended for public attribution. Set `region` to
   `Kontinentalna Hrvatska`.
3. Calculate `getRegionalCalendarDigest(plant.calendar)` from the reviewed
   published source. Store this digest and plant ID in
   `apps/www/lib/plants/regionalCalendarReviews.ts`, together with public HTTPS
   sources and labels. The registry stores evidence, not a second set of dates.
4. For each activity, select reviewed `rangeIndexes` from the directory and
   record `environment` and variety exceptions in `varietyNotes`. Use `null`
   for unknown/unsupported activities. Garlic's `sowing` field is clove
   planting, never seed sowing. Add remaining crops only after review.
5. Validate dates, crop/guide links, mobile scrolling and keyboard operation.
   Run `pnpm --filter www test:regional-calendar`,
   `pnpm --filter www test:seo`, `pnpm typecheck --filter www`, and
   `pnpm --filter www exec playwright test tests/regional-calendar.spec.ts --project=chromium`
   after building `www`.

Changed calendar data, missing evidence, invalid ranges, future review dates
or reached review deadlines withdraw recommendations. Each of the five crops
needs a valid review and at least one reviewed period for indexing to activate.

The issue's [University of Minnesota reference](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/planting-vegetables-in-midsummer-for-fall-harvest)
provides context for local frost, maturity and succession planning. Its
Minnesota dates are not reviewed Croatian recommendations.

## Availability and freshness

“Moguće vrijeme uzgoja” and “Dostupno za narudžbu u Gredicama” are separate.
Availability reads published varieties related to each plant, requires
`sort.store.availableInStore === true`, and resolves a finite nonnegative
price through the existing sort/plant price fallback. Missing varieties or
prices yield an unconfirmed state. A recommendation cannot enable ordering.

The hub is request-rendered because it reads query parameters. Plant and sort
changes also include it in directory revalidation. Review deadlines use
`Europe/Zagreb`. No production data mutations, schema or separate calendar
database are needed. The sitemap refreshes on the normal build/postbuild
cycle and can lag an expired review until the next build; runtime robots
metadata immediately switches to noindex.

## Canonical and filtered URLs

- `/kalendar-sjetve` is the single evergreen canonical URL, including while
  awaiting grower reviews. Every query variant, including
  `?mjesec=9&radnja=sowing`, is `noindex, follow` and canonicalizes here.
- `/biljke?pregled=kalendar` stays usable. Catalogue variants retain `/biljke`
  as canonical, and `pregled=popis` retains its existing normalization
  redirect. This change does not redefine catalogue indexing policy.
- Both CMS editing and the public catch-all reserve `kalendar-sjetve`.
  A CMS record cannot shadow the route or bypass the sitemap review gate.
