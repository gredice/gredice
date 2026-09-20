# Sitemap policy (www)

Owner: SEO. Related issue: [#4783](https://github.com/gredice/gredice/issues/4783).

The `www` sitemap must describe canonical, indexable public pages and their real
update dates. This document records the rules, where they live in code and the
page-level reason behind every inclusion decision.

## Where the rules live

| File | Responsibility |
| --- | --- |
| `apps/www/lib/sitemap/sitemapPolicy.ts` | Exclusion patterns, path normalisation, `lastmod` parsing, de-duplication. Pure, no data access. |
| `apps/www/lib/sitemap/sitemapSourcePaths.ts` | Hub list, CMS/garden eligibility, source entry collection. Pure. |
| `apps/www/lib/sitemap/getSitemapSourcePaths.ts` | Reads CMS pages, public gardens and directory entities from `@gredice/storage`. |
| `apps/www/lib/sitemap/sitemapInventory.ts` | Route families and the inventory report. |
| `apps/www/app/sitemap.ts` | The `/sitemap.xml` route. |
| `apps/www/app/robots.ts` | The `/robots.txt` route. |

The sitemap is a Next.js route, not a generated file. `next-sitemap` used to
produce it in `postbuild`; it was last released in 2023, still pulled a Next.js
13 runtime package into a Next.js 16 app, and its route discovery silently
missed every hub that is not prerendered - which is how `/biljke` went missing.

Because nothing discovers routes for us, **the source model is the only source
of truth** and must list every public URL. `sitemapRouteCoverage.node.spec.ts`
walks `app/` and fails when a public page is neither a declared hub, nor covered
by a declared dynamic route family, nor excluded by policy.

A single `/sitemap.xml` stays valid to 50,000 URLs; past that the route needs
`generateSitemaps`. `/sitemap-0.xml` - the URL the old generator published and
Search Console still knows - redirects permanently to `/sitemap.xml`.

`changefreq` and `priority` are not emitted. Google ignores both, and the old
generator stamped identical values on every URL.

## Inclusion rules

- **Hubs** (`sitemapHubPaths`) are listed explicitly, every one of them.
- **Conditional hubs** (`conditionalHubPaths`) have a real route but are
  published only once their content is ready. `/kalendar-sjetve` waits for the
  five regional calendar reviews to be current; until then the page declares
  `robots: { index: false, follow: true }` itself, so the sitemap and the page
  agree. A CMS record with the same slug cannot open the gate early.
- **Catalogue detail pages** (plants, sorts, blocks, operations, diseases,
  pests, seeds, brands, occasions) are built from the directory entities, using
  the same route-alias helpers the pages use in `generateStaticParams` so the
  sitemap cannot advertise a 404.
- **CMS pages** are published when they are `published`, carry a `publishedAt`,
  are not `noIndex` and are canonical to themselves. A page whose
  `canonicalPath` points elsewhere stays crawlable but is not advertised.
- **Public gardens** are published unless the garden is still the starter
  garden `createDefaultGardenForAccount` builds: a 4x3 grass grid plus one
  raised bed, so `defaultGardenBlockCount` (13) blocks across
  `defaultGardenBlockNameCount` (2) block names, with no active planting. Those
  pages are near-identical to one another. Growing past either threshold counts
  as built, because a garden can be expanded a long way using only grass and
  raised beds. Every other public garden - including small ones - stays in.
- **Game content is not removed.** Block pages describe in-app items and remain
  indexable; `apps/www/lib/blocks/blockPagePresentation.ts` makes that explicit
  in the title and the opening paragraph, for example
  `Pijesak – ukrasni blok za virtualni vrt | Gredice`.

## Exclusion rules

`excludedSitemapRoutes` holds the patterns (`*` = one segment, `**` = any
depth), enforced by `isExcludedSitemapPath`. They cover:

| Group | Paths | Reason |
| --- | --- | --- |
| Icons and manifests | `/icon.png`, `/icon.svg`, `/apple-icon.png`, `/favicon.ico`, `/manifest.json`, `/opengraph-image`, `/**/opengraph-image` | Assets, not pages. |
| Machine-readable files | `/llms.txt`, `/llms-full.txt`, `/.well-known/**` | Crawlable resources, not indexable pages. |
| Endpoints | `/api/**` (includes CMS draft/preview) | Not pages; drafts must never be advertised. |
| Internal tooling | `/development`, `/development/**` | Internal only, already `noindex`. |
| Personal links | `/trag/*`, `/prijava/**` | Per-recipient tracking and sign-in round trips. |
| Raw exports | `/cjenik/cjenik.csv`, `/cjenik/preuzimanje`, `/cjenik/preuzimanje/*` | CSV files and their download index, duplicated by the price list page. |
| Search and filters | `/pretraga`, `/pretraga/*`, `/blokovi/biljke/generator`, any path with a query string | Permutations of a canonical hub. |
| Redirect-only | `/pozdrav`, `/pozdrav/*` | Redirects to `/`, no canonical content. |

A query string only survives when the exact path is listed in
`canonicalQuerySitemapPaths` (empty today).

**Removal from the sitemap is not a deindexing mechanism.** Pages dropped from
the sitemap stay crawlable, and `robots.txt` keeps disallowing only `/trag/`.
When a URL should leave the index, it declares `robots: { index: false, follow:
true }` in its metadata so crawlers can read the directive.

Dynamic route families are classified in `dynamicRouteSitemapPolicy`, which
records how each one reaches the sitemap - or why it does not.
`/korisnici/[publicId]` is currently `not-published`: public profiles were never
in the sitemap, and publishing them needs a per-profile opt-in signal.

## Timestamps

`lastModified` comes from the content source:

- CMS pages: `updatedAt`, falling back to `publishedAt`.
- Public gardens: the newest of the garden row, its blocks, its stacks, its
  raised beds and its plantings. Stacks matter because moving a block writes
  only `garden_stacks.blocks`, and that layout is what the public page renders.
  Raised beds matter because a soft delete writes only `raised_beds`: the bed's
  plantings leave the active count without their own row being touched, and the
  bed's block is not touched either.
  Visibility filters apply to the eligibility counts, not to the timestamps:
  removing a block or a planting is itself a change to the page, and every soft
  delete touches the row's `updated_at`, so excluding deleted rows from the
  aggregate would hide the removal and could move `lastmod` backwards.
- Catalogue pages: the directory entity's `updatedAt`.

Anything without a reliable timestamp - static marketing, legal and hub pages -
omits `lastModified` entirely. A page that did not change must not acquire a new
timestamp after a deployment.

## Caching

Building the sitemap must not put its queries on the database. All four sources
are cached in Redis, so a build normally costs cache reads only:

| Source | Cache | TTL |
| --- | --- | --- |
| CMS pages (`getCmsPages`) | `directoriesCached`, `cms:pages:list:published` | 5 min |
| Catalogue entities (`getEntitiesFormatted`, 9 types) | `directoriesCached`, per entity type | 1 hour |
| Public gardens (`getPublicGardenSitemapSources`) | `grediceCached`, `publicGardenSitemapSources` | 1 hour |
| Regional calendar (`getRegionalCalendarData`) | none of its own - derived from the cached plant and sort data | - |

The route itself revalidates every 12 hours, so the caches are not there to make
the steady state cheaper; they bound the burst. A deployment, several Vercel
regions warming their own ISR entry, a crawler arriving just after an entry
expires, or the inventory script would otherwise each pay full price. The public
garden entry is the expensive one: one query for the public gardens plus three
grouped aggregates over `garden_blocks`, `garden_stacks` and
`raised_bed_plantings`.

A miss falls through to the database rather than failing, and `redisCached`
de-duplicates concurrent misses for the same key within an instance. Garden
layouts change constantly, so the entry is TTL-only - no mutation busts it;
`bustGrediceCached(grediceCacheKeys.publicGardenSitemapSources)` clears it when
a sitemap has to reflect a change immediately.

`sitemapRouteCoverage.node.spec.ts` and `sitemapSources.node.spec.ts` pin this:
a source that stops going through its cache fails the suite.

## Inventory report

```bash
# Reads the source model directly, so no build is needed (a database is).
pnpm --filter www sitemap:inventory
# With live checks and Search Console data:
pnpm --filter www sitemap:inventory -- --probe --base-url=https://www.gredice.com \
  --impressions=./search-console.csv
# Audit a deployed sitemap instead of the source model:
pnpm --filter www sitemap:inventory -- --sitemap=./downloaded-sitemap.xml
```

The report groups every sitemap URL by route family and records URL counts,
`lastmod` coverage and - when probing - HTTP status, the rendered robots
directive, the rendered canonical and whether the page has body content. Output
goes to `sitemap-inventory.md` and `sitemap-inventory.json`.

## Tests

```bash
pnpm --filter www test:sitemap        # policy, source model and route coverage
pnpm --filter www test:static-data
pnpm --filter www test:block-routes
```
