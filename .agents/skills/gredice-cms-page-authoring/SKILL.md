---
name: gredice-cms-page-authoring
description: Author, review, or implement Gredice CMS page content and CMS page tooling. Use for SectionData JSON, supported CMS page sections, admin CMS page forms, public CMS rendering, slug validation, publish readiness, preview behavior, meta title, meta description, canonical path, noIndex, and CMS page routes in apps/app, apps/www, apps/api, or packages/storage.
---

# Gredice CMS Page Authoring

## Overview

Create CMS page content and tooling that passes repository validation, renders in preview and public routes, and is safe to publish.

## Current CMS Page Flow

Primary files:

- Section definitions: `packages/storage/src/cmsPageSections.ts`.
- CMS page repository: `packages/storage/src/repositories/cmsPagesRepo.ts`.
- CMS schema: `packages/storage/src/schema/cmsSchema.ts`.
- Admin CMS UI: `apps/app/app/admin/cms/pages`.
- Admin section registry: `apps/app/components/shared/sectionsComponentRegistry.tsx`.
- Public section registry: `apps/www/components/shared/sectionsComponentRegistry.tsx`.
- Public catch-all CMS route: `apps/www/app/[...slug]/page.tsx`.
- Public route utilities and tests: `apps/www/app/[...slug]/cmsPageRouteUtils.ts`.
- Public API docs for pages: `apps/api/lib/docs/openApiDocs.ts`.

CMS content is stored as a JSON array of SectionData blocks in `cms_pages.content`.

## Supported Sections

The supported section components currently are:

- `Heading1`: required `header`, required `description`.
- `Feature1`: required `header`, required `description`.
- `Faq1`: required `header`, required `description`.
- `Footer1`: optional `header`, optional `description`.
- `PageHeader`: custom section, optional `header`, optional `description`.

A minimal content array:

```json
[
  {
    "component": "PageHeader",
    "header": "Page title",
    "description": "Short page introduction."
  },
  {
    "component": "Heading1",
    "header": "Section title",
    "description": "Section body."
  }
]
```

Do not use unsupported component names. Add new components only by updating `cmsPageSectionComponents` and both section registries.

## Slug And Publish Rules

`packages/storage/src/repositories/cmsPagesRepo.ts` enforces:

- Slugs are normalized with `slugify` per segment.
- Empty slugs are invalid.
- Reserved first segments cannot be used.
- Existing active page slugs must be unique.
- Published pages require content, meta title, and meta description.
- Meta description is capped at 160 characters.
- Content must parse as a JSON array of objects with a string `component`.

Check both reserved route lists when touching behavior:

- `reservedCmsPageFirstSegments` in `cmsPagesRepo.ts`.
- `reservedFirstSegments` in `apps/www/app/[...slug]/cmsPageRouteUtils.ts`.

## Authoring Checklist

For a publish-ready CMS page, provide:

- `slug`: non-reserved public path, without leading slash.
- `title`: admin/internal page title.
- `content`: valid SectionData JSON array using supported components.
- `metaTitle`: specific public page title.
- `metaDescription`: concise, no more than 160 characters.
- `canonicalPath`: only when the canonical URL differs from `/{slug}`.
- `metaImageUrl`: only when a safe, representative image exists.
- `noIndex`: true only for pages that should be excluded from search.

Keep public copy concrete and consistent with nearby Croatian pages. Do not invent plant, delivery, pricing, legal, or availability facts.

## Rendering And Preview

The admin app previews CMS pages through `apps/app/app/admin/cms/pages/[pageId]/preview/page.tsx`.

The public app renders published pages through `apps/www/app/[...slug]/page.tsx`. Draft preview uses Next draft mode plus `CMS_PAGES_PREVIEW_SECRET`.

Public metadata uses:

- `page.metaTitle || page.title`.
- `page.metaDescription`.
- `page.canonicalPath || /{page.slug}`.
- `page.noIndex`.
- `page.metaImageUrl` for Open Graph.

## Validation

For repository logic changes:

```bash
pnpm test --filter @gredice/storage
pnpm test --filter www
pnpm build --filter www
pnpm build --filter app
```

For CMS content JSON only, validate it parses as an array and uses supported components. If editing docs or sample JSON only, run:

```bash
git diff --check
```

Query the database only when asked to inspect or modify existing CMS page rows. Prefer source-defined validation for authoring guidance.
