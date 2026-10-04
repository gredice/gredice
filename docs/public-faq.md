# Public FAQ content and reuse

Published `faq` directory entries are the source for `/cesta-pitanja`, related
questions on public pages, and referenced CMS FAQ sections. Edit an answer in
the directory to update every placement. Keep the `information.name` stable:
it determines the public slug used by references.

The main FAQ orders eight categories by the customer journey: service, pricing,
planting, maintenance, harvest, delivery, safety, and account/support. Category
anchors use stable directory names. `apps/www/components/faq/faqPlacements.ts`
selects three to five entries for each page context. Missing or unpublished
entries are omitted; an empty selection renders no section.

CMS `Faq1` sections can set `faqSlugs` to ordered slugs separated by whitespace
or commas. WWW, news rendering and admin previews resolve those references from
published directory entries. References take precedence over inline `features`,
including when a reference becomes unavailable. Inline questions remain
supported for content specific to one page. The CMS editor displays the shared
answers without saving resolved copies into the page.

The initial linking script retains legacy `features` in existing published CMS
rows so the previous deployment continues to render those sections until this
change deploys. Those copies are ignored by the new resolver and are not an
additional source to maintain. The source-backed safety and companion-planting
pages use references directly.

## Content rules

- Address the reader as **ti** and avoid gendered wording about the reader.
- Answer directly, explain only what is needed, and link to the next useful step.
- Distinguish customer planning from physical work on the OPG, requested work
  from completed work, reserved balance from charges, and crop estimates from
  guaranteed quantities.
- Verify operational and payment claims against current behavior and public
  terms. Do not invent certification, automatic care, refunds or harvest dates.
- Leave current numeric prices on the pricing/delivery pages instead of copying
  them into each answer. Zagreb's boundary, not a free-distance radius, governs
  the public delivery calculator's free zone.
- Keep essential buying and delivery information visible in the page body too.

## Initial data rollout

The reviewed seed is `packages/storage/src/data/publicFaq.ts`: 52 questions and
8 categories. It updates the 13 existing FAQ identities, creates 39 FAQ entries
(including previously bundled safety answers) and 4 categories, and preserves
other directory records and revision history. One legacy singleton content
attribute had duplicate active values; the script updates both through the
repository rather than deleting history.

From the repo root, after `pnpm bootstrap`, run the default dry runs:

```sh
pnpm --dir packages/storage exec tsx --conditions=react-server --env-file=../../apps/www/.env scripts/upsertPublicFaq.ts
pnpm --dir packages/storage exec tsx --conditions=react-server --env-file=../../apps/www/.env scripts/linkPublicFaqSections.ts
```

Review each plan, then repeat that command with `--apply --expect=<hash>` using
its printed SHA-256 fingerprint. An intervening change rejects the apply. Use
the WWW environment for the database **and directory cache credentials**; the
storage-only environment may not contain Redis credentials. The seed verifies
raw values and formatted public reads. The CMS script verifies exact content
readback. For production, pull the production WWW environment explicitly and
pass that environment file; bootstrap normally pulls development settings. A second dry run should report no changes.

These are initial content migrations, not recurring sync jobs: after editorial
changes, do not reapply the original seed over newer answers without review.

Admin FAQ/category mutations now trigger WWW layout revalidation because any
CMS route can reference an answer. News articles containing shared FAQ references
render those sections at request time because news has a separate deployment.
Repository writes invalidate directory cache entries. A standalone script does
not invalidate an already-deployed Next.js page cache; deploying the PR refreshes
page rendering. The public CMS API also has a one-hour HTTP cache, so existing
URLs may keep their previous CMS content until it expires.

## Validation

```sh
pnpm --filter www test:cms-pages
pnpm --filter www test:faq
pnpm typecheck --filter www
pnpm --filter www test:seo
pnpm --filter www test:sitemap
```

The FAQ component browser tests cover keyboard expansion, Markdown links,
category links, empty selections, horizontal overflow and axe accessibility at
390, 768 and 1280 pixels. Storybook includes related questions and existing
category artwork examples. Verify the live-data FAQ hub, related page sections,
and a referenced CMS section in the local browser before delivery.
