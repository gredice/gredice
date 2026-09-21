# FAQ category artwork

`FaqCategoryVisual` accepts the category's `information.name` and optional
`image.cover.url`. Use it beside a visible label at 24–64px, or as a larger
illustration. It is decorative (`alt=""`); the heading supplies the accessible
name. `FaqCategorySection` uses the same component on `/cesta-pitanja`.

An editor-selected cover takes precedence. Known categories fall back to the
registry in `faqCategoryArtwork.ts`, keyed by directory name rather than display
label. New categories without artwork and failed image requests use the shared
game information icon. The bundled quality-and-harvest-safety FAQ uses the same
registry without creating a duplicate database category.

The transparent WebP files and generation prompts are in
`public/assets/faq-categories/`. Harvest and maintenance reuse existing Gredice
artwork; the other three were generated with those assets as style references.
The images are served directly because they are already small WebP files; this
also supports editor-uploaded covers without a new image-host allowlist.

## Directory setup

Run from the repository root after `pnpm bootstrap`:

```sh
# Inspect the plan. Existing covers are always preserved.
pnpm --filter www faq-categories:sync-images
# Add the optional image attribute before the assets have been deployed.
pnpm --filter www faq-categories:sync-images --definition-only --apply
pnpm --filter @gredice/directory-types regenerate
# After deployment, assign covers to the four published directory categories.
pnpm --filter www faq-categories:sync-images --apply
```

The final command checks that the public assets are available before writing
URLs and verifies the saved values. Re-running it makes no changes. Unknown
category names are reported as unmapped; no URLs are guessed. This is directory
metadata and does not require a database schema migration.

Storybook: `apps/www/FAQ/Categories` includes light, dark, mobile, reusable sizes,
and missing/custom image examples, with local question fixtures.
