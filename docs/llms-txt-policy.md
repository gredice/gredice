# [WWW] llms.txt canonical URL and content ownership decisions

_Last updated: May 12, 2026_

This note documents the implementation decisions for GRE-335 and should be referenced by implementation tasks in the `[WWW] Add llms.txt support` project.

## Canonical public URLs

Production should serve these canonical files on the public website domain:

- `https://www.gredice.com/llms.txt` (concise index file)
- `https://www.gredice.com/llms-full.txt` (expanded file)

The app already treats `https://www.gredice.com` as canonical for public metadata, so llms files should follow the same domain convention.

## Alias and redirect behavior

Support discovery alias:

- `https://www.gredice.com/.well-known/llms.txt`

Behavior:

- `/.well-known/llms.txt` should redirect (`308`) to `/llms.txt`.
- Non-canonical host variants (for example `https://gredice.com` when redirected to `www`) should inherit existing host canonicalization and end at `https://www.gredice.com/llms.txt`.

## Content ownership model

- **Primary owner:** `app › 🌐 www` maintainers.
- **Content authority:** public website content owners (marketing/public content maintainers) provide and approve included URLs.
- **Technical enforcement:** website/platform engineers keep file generation and routing aligned with canonical/SEO policy.

Update expectations:

- llms file updates are part of normal public content review.
- Add or remove resources only if the linked page is public, indexable, and intentionally owned by website content.

## Resource inclusion policy

### `llms.txt` (concise)

Include only top-level, high-signal canonical resources, such as:

- Primary product/landing pages.
- Core public knowledge hubs (for example plants, operations, recipes indexes).
- Policy/trust pages that clarify legal and data usage context.

Keep this file intentionally short and navigational.

### `llms-full.txt` (expanded)

Include broader public documentation/content URLs that are still safe for public ingestion, including deeper canonical pages that are already public and indexable.

Do not include:

- Private/authenticated app routes (`app`, `farm`, `garden`, admin, account-scoped pages).
- Internal docs, runbooks, or repository-only documentation.
- Staging, preview, localhost, or non-production domains.
- API endpoints that are not intended as public human-facing reference content.

## Canonical domain rule

For all entries in both files:

- Use absolute canonical URLs on `https://www.gredice.com/...`.
- Do not mix `www` and apex variants in listed links.
- Respect existing canonical URL and sitemap behavior in `apps/www`.

## Compatibility with crawler and SEO policy

These decisions are designed to remain compatible with the existing SEO and crawler direction (including robots/sitemap work tracked in GRE-267):

- llms files remain public, deterministic, and canonical.
- They do not expose internal documentation or private routes.
- They align with existing domain canonicalization used by public metadata.
