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
| `apps/www/next-sitemap.config.ts` | Wires the policy into `next-sitemap`. |

`next-sitemap` discovers prerendered routes from the build output and appends
`additionalPaths` on top of them. Its `exclude` globs only filter the discovered
set, so every URL - discovered or added - is gated through `transform`, which
applies `isExcludedSitemapPath` and publishes each normalised path once.

## Inclusion rules

- **Hubs** (`sitemapHubPaths`) are listed explicitly. A hub that reads
  `searchParams` or opts into `force-dynamic` is never prerendered, so it cannot
  be discovered from the build output; `/biljke` was missing for exactly this
  reason.
- **Catalogue detail pages** (plants, sorts, blocks, operations, diseases,
  pests, seeds, brands, occasions) are prerendered, so the build output lists
  them. They contribute their `updatedAt` to the `lastmod` index only.
- **CMS pages** are published when they are `published`, carry a `publishedAt`,
  are not `noIndex` and are canonical to themselves. A page whose
  `canonicalPath` points elsewhere stays crawlable but is not advertised.
- **Public gardens** are published unless the garden is still the starter
  garden: a new garden ships a grass grid plus one empty raised bed, so
  "at most `defaultGardenBlockNameCount` distinct block names and no active
  planting" means nothing has been built yet. Those pages are near-identical to
  one another. Every other public garden - including small ones - stays in.
- **Game content is not removed.** Block pages describe in-app items and remain
  indexable; `apps/www/lib/blocks/blockPagePresentation.ts` makes that explicit
  in the title and the opening paragraph, for example
  `Pijesak – ukrasni blok za virtualni vrt | Gredice`.

## Exclusion rules

`excludedSitemapRoutes` holds the patterns (`*` = one segment, `**` = any
depth). They cover:

| Group | Paths | Reason |
| --- | --- | --- |
| Icons and manifests | `/icon.png`, `/icon.svg`, `/apple-icon.png`, `/favicon.ico`, `/manifest.json`, `/opengraph-image`, `/**/opengraph-image` | Assets, not pages. |
| Machine-readable files | `/llms.txt`, `/llms-full.txt`, `/.well-known/**` | Crawlable resources, not indexable pages. |
| Endpoints | `/api/**` (includes CMS draft/preview) | Not pages; drafts must never be advertised. |
| Internal tooling | `/development`, `/development/**` | Internal only, already `noindex`. |
| Personal links | `/trag/*`, `/prijava/**` | Per-recipient tracking and sign-in round trips. |
| Raw exports | `/cjenik/cjenik.csv`, `/cjenik/preuzimanje/*` | CSV files, duplicated by the price list page. |
| Search and filters | `/pretraga`, `/pretraga/*`, `/blokovi/biljke/generator`, any path with a query string | Permutations of a canonical hub. |
| Redirect-only | `/pozdrav`, `/pozdrav/*` | Redirects to `/`, no canonical content. |

A query string only survives when the exact path is listed in
`canonicalQuerySitemapPaths` (empty today).

**Removal from the sitemap is not a deindexing mechanism.** Pages dropped from
the sitemap stay crawlable, and `robots.txt` keeps disallowing only `/trag/`.
When a URL should leave the index, it declares `robots: { index: false, follow:
true }` in its metadata so crawlers can read the directive.

## Timestamps

`autoLastmod` is `false`. `lastmod` comes from the content source:

- CMS pages: `updatedAt`, falling back to `publishedAt`.
- Public gardens: the newest of the garden row, its blocks and its plantings.
- Catalogue pages: the directory entity's `updatedAt`.

Anything without a reliable timestamp - static marketing, legal and hub pages -
omits `lastmod` entirely. A page that did not change must not acquire a new
`lastmod` after a build.

## Inventory report

```bash
pnpm --filter www build
pnpm --filter www sitemap:inventory
# with live checks and Search Console data:
pnpm --filter www sitemap:inventory -- --probe --base-url=https://www.gredice.com \
  --impressions=./search-console.csv
```

The report groups every sitemap URL by route family and records URL counts,
`lastmod` coverage and - when probing - HTTP status, the rendered robots
directive, the rendered canonical and whether the page has body content. Output
goes to `sitemap-inventory.md` and `sitemap-inventory.json`.

## Tests

```bash
pnpm --filter www test:sitemap
pnpm --filter www test:static-data
pnpm --filter www test:block-routes
```
