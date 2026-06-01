---
name: gredice-public-docs-seo
description: Use for public Gredice content/SEO in apps/www or status: metadata, structured data, sitemap, Croatian copy, FAQ/legal/product pages, CMS routes.
---

# Gredice Public Docs SEO

## Overview

Protect public content quality, SEO, metadata, and structured data for Gredice public surfaces. Ground claims in existing data and nearby copy.

## Scope

Primary public docs/content surface:

- `apps/www`: marketing, commerce, CMS pages, plant pages, block pages, recipe pages, operation pages, legal pages, FAQ, delivery, pricing, sitemap, public tests.
- `apps/status`: public status page metadata when touched.

Read first:

- `SEO.md`.
- `PRODUCT_SENSE.md`.
- `DESIGN.md` for public page presentation.
- `apps/www/src/KnownPages.ts`.
- `apps/www/src/pageAliases.ts`.
- Nearby route files under `apps/www/app`.

## Public Page Workflow

When changing a public page:

1. Identify whether it is a static route, dynamic data page, or CMS-rendered route.
2. Preserve route ownership and `KnownPages` helpers.
3. Add or update `metadata` or `generateMetadata`.
4. Keep title and description specific to the rendered page.
5. Derive dynamic metadata from the same data source used to render the page.
6. Return the established not-found behavior when dynamic content is missing.
7. Check canonical path behavior for duplicate or alias routes.
8. Update structured data only when it exactly matches rendered content.
9. Keep copy consistent with existing public Croatian tone and product terminology.
10. Run the smallest public-page validation that covers the change.

## Metadata Patterns

Use Next.js App Router metadata:

- Static pages export `metadata`.
- Dynamic pages export `generateMetadata`.
- `apps/www/app/layout.tsx` owns `metadataBase` for `https://www.gredice.com`.
- CMS pages in `apps/www/app/[...slug]/page.tsx` derive metadata from public directory page data.
- Open Graph images should represent the actual page or item when available.

Do not use generic fallback metadata for missing plant, sort, operation, recipe, or CMS content when the page should be a 404.

## Structured Data

Use `apps/www/components/shared/seo/StructuredDataScript.tsx` for JSON-LD.

Existing public structured data includes products for plants, plant sorts, and operations. Preserve these constraints:

- Do not invent price, availability, reviews, ratings, legal terms, delivery promises, or plant facts.
- Use `apps/www/src/merchantReturnPolicy.ts` where product offers already include the merchant return policy.
- Use stable URLs from `KnownPages`.
- Ensure schema data is also visible or implied by rendered page content.

## Sitemap And Public Tests

`apps/www` runs `next-sitemap` in `postbuild`. CMS pages are added by `apps/www/next-sitemap.config.cjs` from the directories API, filtered to published pages with `publishedAt` and no `noIndex`.

Public tests use sitemap-generated cases:

- `apps/www/tests/populate-test-cases.ts`.
- `apps/www/tests/a11y.spec.ts`.
- `apps/www/tests/titlesPresent.spec.ts`.
- `apps/www/tests/visual.spec.ts`.

If a route should not be indexed, make it explicit through metadata or sitemap config.

## Copy Rules

Follow `PRODUCT_SENSE.md`:

- Do not invent facts about plants, delivery, pricing, legal terms, fiscalization, or availability.
- Keep domain language precise: gardens, raised beds, fields, plants, sorts, operations, carts, deliveries, invoices, accounts.
- Public pages should make the offer or content clear without explaining implementation internals.
- Headings should describe page content, not code concepts.
- Use actual product, plant, operation, or Gredice imagery where relevant.

## Validation

Use targeted `www` lint/test/build checks when metadata, routing, sitemap, rendering, or public behavior changes. Content-only docs may only need `git diff --check`. For visual layout changes, start `www`, inspect responsive behavior, and capture screenshots when first-view or structured visual content changed.
