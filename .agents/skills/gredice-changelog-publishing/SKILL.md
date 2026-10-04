---
name: gredice-changelog-publishing
description: "Use for Gredice changelog publishing: auditing merged GitHub PRs, selecting user and farmer facing changes, drafting CMS changelog pages, creating and reviewing on-brand covers, validating metadata/content, and publishing through apps/app CMS and news surfaces."
---

# Gredice Changelog Publishing

## Overview

Create and publish Gredice changelog entries from merged work while keeping public copy accurate, user-facing, and compatible with the CMS/news pipeline.

Use this together with `github:github` when inspecting pull requests and `gredice-cms-page-authoring` when the CMS shape or section registry may have changed.

Whenever the task creates, replaces, reviews, or attaches a cover, first read
`.agents/skills/gredice-review-changelog-post/SKILL.md` in full and follow its
cover workflow. That skill's visual contract is authoritative over automation
memory, recent generated covers, or inferred changes in style.

## Scope

Include changes that are visible or meaningful to:

- Public visitors, customers, garden users, and game users.
- Farmers and farm operators using `apps/farm` or farm-facing notifications.
- Public/news/status pages, checkout, delivery, account, search, recommendations, surveys, notifications, and customer support flows.
- Shared packages only when the change directly affects one of those surfaces.

Exclude by default:

- Administration-only changes in `apps/app` unless they publish to a public/customer/farmer workflow.
- CI, test, debug, dependency, Renovate, build, and local development changes.
- Internal schema/storage/API refactors with no visible user or farmer outcome.
- Tiny fixes that should be folded into a larger feature entry.

## PR Audit Workflow

1. Determine the date range and base branch from the user request. Use concrete dates, and use `mergedAt` as the release date.
2. Query merged PRs on `main`, then inspect titles, bodies, labels, and changed files before deciding whether a PR is changelog-worthy.
3. Group related PRs into one feature entry when the public outcome is one user-facing change.
4. For grouped entries, use the latest related `mergedAt` date unless the user explicitly asks for each PR separately.
5. Keep an audit trail of PR numbers and merge dates in working notes, but do not expose implementation jargon in public CMS copy.

Useful GitHub starting points:

```bash
gh pr list --state merged --base main --search "merged:>=YYYY-MM-DD merged:<=YYYY-MM-DD" --json number,title,mergedAt,author,labels,url --limit 200
gh pr view PR_NUMBER --json number,title,body,mergedAt,files,labels,url
```

For large ranges, prefer GraphQL pagination through `gh api graphql` so the result is complete.

## Entry Shape

Every changelog item needs:

- `heading`: concise public feature name.
- `shortDescription`: one-sentence public summary.
- `releaseDate`: the merge date on `main`, used as the CMS `publishedAt` date.
- `markdown`: public, free-form Markdown summary of what changed and why it matters.
- `sources`: PR numbers or URLs for traceability.

Public copy should be Croatian unless the user asks otherwise. Avoid PR numbers, branch names, package names, administration-only details, and technical implementation terminology in the published content.

Recommended Markdown style:

```markdown
Kratak odlomak koji objasnjava sto je novo za korisnike ili farmere.

Po potrebi dodaj jos jedan odlomak s konkretnom koristi ili nacinom koristenja.
```

Do not add `Sto je novo`/`Što je novo`, `Kome je namijenjeno`, or `Datum izdanja` sections. Do not write the changelog body as bullets unless the user explicitly asks for a list.

## CMS Page Rules

Changelog entries are CMS pages:

- `contentKind: "changelog"`
- `state: "draft"` first, unless the user explicitly asks to publish.
- `slug: "novosti/sto-je-novo/<yyyy-mm-dd>-<normalized-feature-slug>"`
- `title`: same as the public heading.
- `metaTitle`: specific and human-readable.
- `metaDescription`: no more than 160 characters.
- `canonicalPath`: usually `"/novosti/sto-je-novo/<entry-slug>"`.
- `publishedAt`: set to the changelog release date while the page is still a draft.
- `tags`: audience/topic tags that help filtering, such as `Vrt`, `Farma`, `Dostava`, `Novosti`. Do not include date tags.

Use supported CMS sections from `packages/storage/src/cmsPageSections.ts`. The current changelog template uses `MediaBlock` plus `MarkdownBlock`; `PageHeader`, `TextBlock`, and `MarkdownBlock` are also safe for plain entries after checking the registry. Do not add a `TextBlock` only to show the release date.

Public changelog APIs and news pages order by `publishedAt`, so historical batches must preserve the release date there before publishing. Do not duplicate the release date in tags or visible content sections.

## Cover Workflow

Apply this workflow whenever a changelog entry needs a new or replacement
cover:

1. Open at least three accepted published covers that follow the canonical
   Gredice editorial template, including one from the same product area when
   possible. Do not treat recency or repeated automation output as evidence
   that the template changed.
2. Preserve the template's non-negotiable elements:
   - a full-bleed warm ivory-to-pale-sage or pale-blue background with a
     restrained oversized low-contrast arc;
   - a left editorial column with a short green rule, uppercase Croatian
     eyebrow, exact dark-forest Croatian headline, and a short muted-green
     benefit sentence;
   - one dominant white rounded product panel on the right with a soft shadow,
     grounded in verified product components, supported UI states, or exact
     assets;
   - the same landscape split, hierarchy, spacing, radius, and shadow language
     across the batch.
3. Reject text-free editorial art, photography, miniature scenes,
   free-floating objects, decorative garden scenery, standalone illustrations,
   and fictional UI as default covers. They remain out of contract even when
   several recent covers use them. The documented feature-specific full-frame
   screenshot exception in `gredice-review-changelog-post` is the only default
   exception unless the user explicitly requests another direction.
4. Verify all product states and labels against the implementation. Use neutral
   privacy-safe data. If generated text is not exact, compose the Croatian
   eyebrow, headline, benefit sentence, and product labels deterministically;
   never remove required copy to avoid fixing it.
5. Compare every finished cover side by side with the three accepted
   references and with the rest of the batch. Reject a cover that loses the
   canonical series identity, exact Croatian text, product grounding,
   full-bleed opaque bounds, or balanced left-right composition.

Upload covers below `cms/pages/<pageId>/cover/`, set `metaImageUrl` through
`updateCmsPage`, and preserve every other CMS field. Re-read the page and
download the public image to verify the stored URL, dimensions, opacity, and
checksum.

## Database Workflow

Use storage repository helpers instead of raw SQL for writes:

- `createCmsPage`
- `updateCmsPage`
- `updateCmsPageState`
- `getCmsPageBySlug`
- `normalizeCmsPageSlug`
- `normalizeCmsPageContent`

Run CMS scripts from the repo root with the storage package environment:

```bash
pnpm --dir packages/storage exec tsx --conditions=react-server --env-file=/Users/aleks/Documents/GitHub/gredice/packages/storage/.env path/to/script.ts
```

Prefer idempotent scripts:

- Normalize the slug first.
- If an active row with the slug exists, update only when the user asked for updates.
- Skip existing published rows unless the user explicitly requested republishing.
- Support `--dry-run` and print create/update/skip counts before applying.
- Always close storage connections when the script opens them.

Never print secrets from `.env`, and never run `pnpm db-push`.

## Validation

Before applying:

- Verify each entry has heading, description, release date, Markdown, and sources.
- Validate slugs with `normalizeCmsPageSlug` and CMS content with `normalizeCmsPageContent`.
- Check `metaDescription.length <= 160`.
- Confirm changelog tags contain only audience/topic labels, not date strings.
- Confirm Markdown is free-form user/farmer-facing copy with no `Sto je novo`, `Kome je namijenjeno`, or `Datum izdanja` sections.
- For every cover, confirm the canonical headline-and-product-panel template,
  exact Croatian text, privacy-safe verified product state, opaque landscape
  bounds, and side-by-side comparison against at least three accepted covers.
- Dry-run the create/update script and review counts.

After applying:

- Query `cms_pages` by `contentKind`, `state`, and `slug` prefix to confirm expected rows.
- Spot-check one content payload parses and uses supported section names.
- Download every uploaded cover and confirm its natural dimensions, opacity,
  and checksum match the reviewed local file.
- For published entries, check `/novosti/sto-je-novo`, one detail page, and `/api/news/changelog` when a dev or deployed target is available.
- For skill/docs-only edits, run `git diff --check`.

## Reporting

Summarize what changed with counts and exact CMS IDs/slugs when pages were created or updated. Report replacement-cover dimensions and verification results. If entries remain drafts, state that explicitly and point to the admin CMS edit pages when useful.
