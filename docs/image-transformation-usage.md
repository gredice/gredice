# Public image transformation usage

Issue: #5086, part of #5089.

## Attribution baseline

Vercel Observability was queried on 2 October 2026 for the fixed window
**29 September 00:38:54 UTC–2 October 00:38:54 UTC**. This is a rolling
72-hour production window, distinct from the audit's three closed billing periods.
The metric is `vercel.image_transformation.count`, summed by project, source
hostname, source ETag hash, optimized width and quality.

| Production project | Transformations |
| --- | ---: |
| WWW | 7,440 |
| News | 346 |
| Total | 7,786 |

The hostname/width/quality grouping returned 68 groups covering all 7,786
transformations. `cdn.gredice.com` accounted for 3,797 and `www.gredice.com`
for 3,602. Requests above 640 pixels accounted for 873 and 1,260 respectively;
these totals include sources whose native dimensions have not been established.
They are an attribution baseline, not a claim that every large variant is waste.
Quality was 75 for the dominant groups.

The WWW source-hash query returned its maximum 500 groups, accounting for 6,568
of WWW's 7,440 transformations. Vercel exposes source ETag hashes, not source
URLs. Public HTML from `/`, `/biljke`, `/blokovi` and `/sjeme` supplied 376
source URLs for header inspection. Direct header requests matched 169 ETags.
Direct requests for 184 CDN sources returned 403; authorized read-only R2
`HeadObject` metadata resolved all 184 without downloading images. One complete
R2 metadata listing returned 425 objects. Local static-image content MD5s
resolved the remaining 52 WWW hashes; the matched Snow source's MD5 also agrees
with its live HTTP ETag.

Together these identify **438 of 500** hostname/ETag groups and **6,441 of 6,568**
transformations in the top-500 sample (98.1%). All 252 CDN and 185 WWW groups in
that sample are attributed. Of these, 421 groups have one known candidate and
17 have duplicate ETag candidates, accounting for 409 transformations. A hash
can represent identical bytes at multiple URLs; count its transformations once.
The remaining 62 groups contain 127 transformations from local/Blob sources.
The top-500 sample still omits 872 of WWW's 7,440 transformations; it is not a
complete source-cardinality measurement.

| Attributed source path | Transformations |
| --- | ---: |
| CDN `entity-attributes/{51d215da-929e-4d88-a1d0-ba9e01373a2d,b56944bb-08c6-4b46-8a6c-5d9a4ac6ec44}-MulchHey_1.png` (two identical candidates) | 81 total |
| CDN `entity-attributes/da0310d6-4245-41be-bce5-adfde24f1b67-kadulja.png` | 44 |
| WWW `/assets/operation-icons/raisedBedFullPhoto.webp` | 44 |
| CDN `entity-attributes/14d28d60-aad4-44e4-9a67-b519a1e8eee0-spinach-realistic-340.png` | 43 |
| WWW `/assets/operation-icons/plantPhoto.webp` | 42 |
| CDN `entity-attributes/94441e3a-ac27-4d0c-ab08-1becba600e96-turnip-realistic-340.png` | 41 |
| CDN `entity-attributes/e4b97d0b-d97d-4317-bde4-5402e3c4e4d1-kohlrabi-realistic-340.png` | 41 |

A fully attributed generated source is:

`/assets/blocks/Block_Snow_Falling.webp?v=07e7774754828298`

Its ETag was `"3fab8592ff4d46c5301e47abd021b304"`. The exact-source query
returned **27 transformations at 14 widths**, all quality 75:
32, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048 and 3840.
The same source/version appeared across those variants. All **806** checked-in
public block WebPs have native width **640**, matching `SNAPSHOT_SIZE` in
`apps/www/generate/blocks-snapshots.specgen.tsx`.

## Bounded generated block variants

WWW's `PublicBlockImage` uses the existing Next optimizer, retaining small
image choices and capping requested widths at the source's 640 pixels. It uses
quality 75, the current optimizer allowlist. The attributed sample's 14 distinct
width keys collapse to seven; repeated descriptors above 640 share the same
optimizer URL. This is a variant-count reduction, not an observed billing saving.
No extra generated objects, storage allocation or processing pipeline is added.

Catalogue cards use lazy loading instead of preloading every item. Their `sizes`
match the existing 2/3/4/6-column responsive grid. The old desktop condition was
unreachable after an earlier `min-width: 768px` condition and overstated widths.
Plant photos retain the normal optimizer and needed high-resolution variants.

Block source URLs retain the existing content hash. The hash is derived from
asset contents rather than a deployment ID, so unrelated deployments retain
source keys and changed assets receive a new key. Existing source cache headers
remain unchanged: block assets use browser `max-age=86400` and CDN
`s-maxage=31536000`; static imports are immutable. The observed Blob garden
preview used a content-addressed path and a one-year source cache lifetime.
No global optimizer TTL increase is justified by this source sample.

## Validation and comparable follow-up

- Image-variant tests verify bounded keys, mobile choices, allowed quality,
  changed-content freshness and every checked-in block source's width.
- WWW type generation and TypeScript checking pass.
- Local Chromium checks at 390 and 1280 pixels with 2x density verify decoded
  lazy-loaded thumbnails, bounded optimizer URLs, no horizontal overflow and no
  page/hydration errors. Screenshots were inspected; an optimized Tree source
  returned HTTP 200, while nonallowlisted quality 60 correctly returned HTTP 400.
- Production cost acceptance remains open until a comparable 72-hour window
  follows deployment. Record transformations and image-cache write units by
  project and repeat the exact-source query. Include Vercel billed costs and
  any extra storage/processing costs in the net saving; this change adds none.

The audit measured $0.480 transformation cost over three closed billing days
(about $4.80 per 30 days at that pace). A subset of source variants is affected,
so that entire amount must not be counted as this change's saving. Traffic,
deployments and catalogue changes must accompany the follow-up figures.
