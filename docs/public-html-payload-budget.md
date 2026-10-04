# Public HTML payload budget

Issue: [#4782](https://github.com/gredice/gredice/issues/4782).

The homepage and plant archive retain their content while limiting the data
serialized into the initial HTML. The warning budget is **1,000,000 bytes**;
the hard budget is **1,800,000 bytes**, measured as uncompressed UTF-8 HTML,
including inline scripts. A warning does not fail the check; exceeding the
hard budget does.

## Server/client boundaries

- `plantCatalogue.ts` projects names, alternative names, cover URL, price,
  yield inputs, sowing recommendation, all calendar ranges and variety names.
  It excludes detail-page descriptions, operations and relationship graphs.
  `PlantsCatalogue` receives this array once for both interactive views.
- `PlantsShowcase` uses the same compact card projection for its existing
  cards and images. Its selection and content are unchanged.
- `getLandingFeaturedGardens` retains the ten most popular gardens, their
  names, public owner information and day/night preview URLs. The ranked-ID
  route and bounded detail lookups recheck visibility and current members;
  only compact summaries cross into the homepage HTML. Full scenes are not
  serialized into the page.
- `LandingFeaturedGardenScene` fetches the displayed public garden through
  the existing public API and caches it with React Query. An existing preview
  image remains in the fixed-size frame until the scene is ready. Missing
  previews retain the named placeholder; failed requests expose a retry and
  keep the garden/profile links. Owned gardens retain their authenticated flow.
- The archive no longer wraps the complete catalogue in a streaming Suspense
  fallback. Cards and calendar rows are visible with JavaScript disabled.
  Search, variety matching and the sowing filter remain active across tab links.

## Reproduce

Use Node 24 and the pinned pnpm version. Configure the existing read-only
catalogue environment, then run from the repository root:

```sh
GREDICE_API_HOST=https://api.gredice.com pnpm build --filter www
pnpm --filter www test:plant-catalogue
pnpm --filter www test:landing-featured-gardens
pnpm --filter www test:public-html
```

`test:public-html` starts a production server using the app registry. For an
already running production server, set `GREDICE_WWW_BASE_URL` and
`GREDICE_PLAYWRIGHT_REUSE_SERVER=true`. It checks anonymous desktop and Pixel 7
responses for `/`, `/biljke` and `/biljke?pregled=kalendar`, recording total
bytes, inline-script bytes and byte offsets of title, canonical, H1, main and
the first React payload in Playwright attachments. It also verifies every
archive ItemList link without JavaScript and exercises search, variety
matching, the sowing filter, tab switching and empty results.

The same spec participates in the normal `test:run` suite. The focused config
uses the browser test runner without building the component-test bundle.

### Growth fixture

Start a **separate local production server**:

```sh
GREDICE_PLAYWRIGHT_CATALOGUE_GROWTH_FIXTURE=true \
GREDICE_WWW_START_PORT=4785 pnpm --filter www start
```

Then target it with:

```sh
GREDICE_WWW_BASE_URL=http://localhost:4785 \
GREDICE_PLAYWRIGHT_REUSE_SERVER=true \
pnpm --filter www test:public-html --grep 'preserves crawlable content'
```

`tests/publicHtmlGrowthFixture.ts` triples every archive card, all variety and
alternative-name data and all calendar rows, using distinct plant IDs and
names. On the measured catalogue this grows 49 plants to 147. No cards are
paginated, hidden or removed to satisfy the budget. The homepage retains its
existing bounded showcase and ten-garden carousel; scene complexity no longer
enters its HTML. The loader unit test also supplies a large unused scene graph
and proves that it is excluded from the serialized summary.

## Measurements, 2026-09-22

The initial anonymous production audit returned identical desktop/mobile
sizes: `/` **2,234,030 bytes** (2,057,760 inline-script bytes) and `/biljke`
**5,352,764 bytes** (4,982,964 inline-script bytes). No cookies or login were
used. The title, canonical, H1 and main already preceded the large payload;
this audit does not establish an indexing loss.

Local before/after checks used production builds, the same published
catalogue and public gardens, Node 24.15.0 and pnpm 11.5.2. The baseline was
commit `db3d4cebb`; these measurements predate integration with the newer
ranked-ID featured route on `main` (which retains bounded server detail
lookups before projecting summaries). Both
builds used the production public API for browser requests.

| Route | Before, bytes | After, bytes | Reduction |
| --- | ---: | ---: | ---: |
| `/` | 2,226,915 | 303,844 | 86.4% |
| `/biljke` | 5,346,164 | 499,264 | 90.7% |

The 3x fixture returned **1,018,531 bytes** for the list and **1,322,018 bytes**
for the calendar on both devices. These emit the intended warning while
remaining below the hard budget.

Byte offsets in the normal desktop response (the mobile response has the
same positions):

| Route/build | Title | Canonical | H1 | Main | First React payload |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` before | 11,729 | 12,325 | 39,570 | 37,448 | 176,895 |
| `/` after | 13,332 | 13,928 | 43,980 | 39,051 | 179,283 |
| `/biljke` before | 107,462 | 107,929 | 147,008 | 132,724 | 386,012 |
| `/biljke` after | 107,462 | 107,929 | 147,008 | 132,724 | 385,712 |

Parsing the saved HTML before and after, excluding script/style text, found
**zero missing text fragments or anchor href occurrences**: the homepage
preserved 137 text fragments and 66 links; the archive preserved 382 text
fragments and 105 links, including all 49 plant-card links. The browser tests
separately verify that the main content is visible without application
JavaScript. No page copy or sections were deleted.

### Mobile lab observations

Chromium with Pixel 7 emulation, a fresh anonymous browser/context per route,
reduced motion, no CPU/network throttling, five seconds before interacting and
one second afterward. LCP and CLS were read from buffered PerformanceObservers;
the interaction sample uses Event Timing durations for one carousel-next or
sowing-filter click. The table gives medians of three runs. This is a short lab
sample, **not field INP or a CrUX percentile**. The event sample is insufficient
to claim a sustained INP gain.

| Route | LCP before/after | Interaction before/after | CLS before/after |
| --- | ---: | ---: | ---: |
| `/` | 1,580 / 700 ms | 272 / 152 ms | 0 / 0 |
| `/biljke` | 240 / 196 ms | 40 / 40 ms | 0 / 0 |

Timing depends strongly on the scenario. An earlier three-run sequence that
opened the archive after the WebGL homepage in the same browser context gave
archive LCP medians of **268 / 1,704 ms**, with the same 40 ms interaction sample
and zero CLS. The isolated archive runs above did not reproduce that slowdown.
The LCP element was the same first plant image in both builds. This does not
establish the cause of the sequential-run slowdown; keep that scenario in
post-deployment performance review. One baseline homepage run also had CLS
0.0324, although the median was zero.

The byte budgets and content checks are regression gates; these timings are
diagnostic. No general field-performance improvement is claimed.

## Validation

Passed the production build, www typecheck, targeted Biome checks, catalogue
projection/search tests, featured-garden loading and carousel tests, static-data
tests, regional-calendar tests, SEO contracts and sitemap contracts. Browser
coverage passed all seven normal HTML/content/filter checks, six growth checks,
eight garden/profile/lazy-loading/retry checks, and the existing mobile landing
WebGL/layout/pixel test. The component suite uses a separate cache for its
stubbed renderer so a prior real-WebGL build cannot invalidate the scene tests.

## Deployment follow-up

This is local production-build verification, not deployment proof. After
deployment, rerun the response check against the deployed URL. Attach Google
Search Console live inspection when account access is available, and compare
available field LCP/INP/CLS data over a suitable reporting window. Neither
Search Console nor field data was available for this local verification, and
no ranking improvement is claimed.
