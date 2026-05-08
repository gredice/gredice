# SEO Guide

Use this guide for public pages, metadata, structured data, canonical URLs, and sitemap behavior.

## Scope

SEO work primarily applies to:

- `apps/www`: public marketing, commerce, plant, block, recipe, legal, FAQ, contact, and content pages.
- `apps/status`: public status page metadata.

SEO usually does not apply to authenticated `garden`, `farm`, `app`, or API routes except for basic metadata and share previews where those apps already define them.

## Metadata

- Use Next.js `metadata` or `generateMetadata` in route files.
- Keep `metadataBase` aligned with the production domain already used by the app.
- Each indexable public page should have a specific title and description.
- Dynamic pages should derive metadata from the same data source used to render the page.
- Missing dynamic content should return the established not-found behavior instead of generic metadata.
- Keep Open Graph and Twitter metadata consistent with page intent.

## Canonical URLs and routing

- Preserve canonical path handling in `apps/www/proxy.ts`.
- Do not create duplicate public routes for the same content without a canonical strategy.
- Use stable slugs and aliases already present in directory/API data.
- Redirect outdated paths rather than rendering duplicate content when the app already has redirect/proxy conventions.

## Structured data

- Use structured data only when it accurately represents rendered page content.
- Existing product, operation, plant, sort, merchant return policy, and list pages should keep their schema.org data accurate.
- Inject JSON-LD through the existing structured data component pattern.
- Do not invent price, availability, review, or legal data for schema.

## Sitemaps and tests

- `apps/www` runs `next-sitemap` in `postbuild`.
- Sitemap-driven test cases are populated by `apps/www/tests/populate-test-cases.ts`.
- Public route changes may require checking:

```bash
pnpm build --filter www
pnpm test --filter www
```

- If a page should not be indexed, make that explicit through the app's metadata or sitemap config.

## Content quality

- Public copy should be useful, concrete, and consistent with nearby Croatian content.
- Headings should describe the page content, not internal implementation concepts.
- Images should represent the actual plant, block, product, recipe, operation, or Gredice concept when available.
- Avoid thin public pages that only wrap a component without meaningful metadata or content.
