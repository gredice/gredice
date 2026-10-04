---
name: gredice-populate-plant
description: Create and fully populate brand-new Gredice plant directory entities as unpublished Croatian drafts, including sourced lifecycle content, agronomic attributes, calendars, relationships, operations, health coverage, commerce data, and a realistic transparent produce-focused cover. Use when onboarding a new crop or species to the plant catalogue or completing a newly created plant record before editorial review and eventual publication. Route established-plant changes through supported community edits or the appropriate admin review workflow instead.
---

# Gredice Populate Plant

## Overview

Build a complete, source-backed `plant` directory record without publishing it implicitly. Treat the active runtime attribute definitions as the schema and leave a verifiable draft for review.

Read [plant-field-checklist.md](references/plant-field-checklist.md) in full before creating or populating a record.

## Boundaries

- Confirm the target is a crop/species-level plant. Use `gredice-populate-plant-sort` for a named cultivar, hybrid, commercial line, or marketed sort of an existing plant.
- Use this workflow only to create or finish a brand-new entity. Propose changes to an established plant through community edits where supported; use the appropriate reviewable admin workflow for unsupported fields.
- Confirm the target environment, host, and authenticated admin account before any mutation. Never infer that the currently open session is the intended production account.
- Create through the authenticated admin directory workflow so revisions, cache invalidation, and search refreshes remain intact. Do not write production rows ad hoc unless the user explicitly requests a guarded script.
- Keep the entity in `draft`. Publishing is a separate, explicit user decision after complete readback and preview.
- Load current `plant` attribute definitions and address them by `category.name`. Never hardcode definition IDs or assume the checked-in generated type contains newer runtime fields.
- Use Croatian customer-facing copy and retain a source ledger with direct URLs. Do not add unsupported origin, health, resistance, yield, or cultivation claims.
- Finish research and a locally validated cover before creating the entity. Identify unresolved commercial/editorial inputs first; proceed with an incomplete draft only when the user accepts those explicit blockers. If an earlier attempt left a partial draft, reuse and report that ID instead of creating another blank record.
- Never run `pnpm db-push`, expose environment values, or log credentials.

## Workflow

1. **Define the record.** Resolve the accepted Croatian common name, botanical name, synonyms, edible product, reproduction method, and whether the target is truly new. Search both published and draft raw plant and plant-sort entities for case-, whitespace-, punctuation-, botanical-name-, and slug-normalized collisions before the first mutation. Stop on an ambiguous near match rather than creating a probable duplicate.
2. **Research the dossier.** Prefer botanical institutions, extension services, government/agricultural guidance, breeders, registries, and reputable seed suppliers. Reconcile conflicting values; keep region-dependent calendars appropriate for Croatian conditions and label uncertain values instead of averaging them.
3. **Inspect and preflight.** Load active `plant` definitions, required flags, visibility, data types, defaults, multiplicity, and reference targets. Produce a dry-run checklist covering every active required field and every field in the reference checklist. Prepare the per-field source ledger, generate and validate the local cover, and resolve or explicitly declare business/editorial blockers before mutation.
4. **Create the draft.** In `/admin/directories/plant`, add one blank record and capture its ID. Re-run the duplicate guard after creation. If a collision appears, stop without populating or deleting the new draft, report its ID, and request explicit cleanup direction. Populate through the detail form; avoid the generic JSON importer for complex JSON, repeated references, or fields whose names could collide. If an applicable field is hidden from the form, use an approved guarded server/repository path or report a blocker; do not confuse a formatted default with a persisted value.
5. **Populate all applicable data.** Fill identity, lifecycle copy, calendars, agronomic attributes, tips, relationships, operation applicability, price/store controls, delivery freshness, and the cover; prepare inverse health coverage proposals for the adjacent-change step. Use actual `false` and `0` values where meaningful; do not replace them with blanks. Never infer price, store availability, or editorial verification from horticultural sources; if a required business decision is unavailable, leave the entity in draft and report the blocker rather than claiming completion.
6. **Reuse operations and stage adjacent changes.** Inventory existing published operations before linking anything. Do not create crop-specific variants of a generic harvest operation when the existing operation can be expanded. Do not add redundant links for operations with `appliesToAllTargets = true`. If genuinely new behavior is required, propose the separate unpublished operation and plant association first; create that draft only with explicit authority. Likewise, treat inverse health coverage as reviewable changes to existing disease/pest records: stage or propose them unless the user explicitly authorized those adjacent mutations.
7. **Create the cover during preflight.** Load and follow the available image-generation skill (in Codex, `$imagegen`) to make a square, realistic, naturally imperfect image centered on the harvested edible product. Use only minimal leaves or stems needed for identification; for leafy crops, show a harvested head or bunch rather than a rooted whole plant. Use no text, labels, banners, logos, hands, packaging, props, soil bed, or CGI styling. Remove the background and export a transparent RGBA PNG.
8. **Validate and upload the cover.** Run `node scripts/validate-directory-cover.mjs <cover.png>`, visually confirm the produce focus and absence of text, then upload through the record's `image.cover` control, which attaches the returned URL immediately. Preserve the reported SHA-256. Fetch the CDN object with cache busting, validate the downloaded file again, and require matching content type, dimensions, alpha, and SHA-256 before accepting the attachment. If remote validation fails, clear `image.cover`, verify the raw value was removed, and report the orphaned CDN URL as a cleanup candidate. A guarded upload-only path may avoid immediate attachment, but use it only with explicit authority.
9. **Verify the draft.** Compare raw stored values and the authenticated draft-formatted admin preview against the dossier. Check required completeness, JSON shapes, enum values, numeric units, duplicate multiple rows, references to published targets, relationship conflicts, operation applicability, inverse health links, cover URL/bytes/hash/alpha, and the derived slug. Confirm `state = draft`, `publishedAt = null`, and absence from the public published collection; a public 404 is expected before publication.
10. **Hand off for review.** Preserve the source ledger in the durable task or review artifact and report the entity ID, draft state, slug, populated paths, intentionally inapplicable fields, unresolved decisions, cover dimensions/hash, and named visual-review result. Publish only when the user separately authorizes it; then verify the published list endpoint, public `/biljke/{slug}` page, search result, and CDN asset while accounting for public cache delay.

## Cover Prompt Template

Use this base and add species-specific phenotype details:

> Realistic and naturally imperfect studio image of the harvested edible product of [PLANT], showing [IDENTIFYING COLOR, SHAPE, SIZE, OR INTERIOR]. Centered isolated subject, square composition, plain white background for clean removal. Focus on the produce, with only minimal leaves or stems needed for identification. No text, labels, banners, logos, hands, packaging, garden props, decorative objects, or CGI look.

The white-background master is only an intermediate. The attached asset must pass the transparent-PNG validator.

## Repository Anchors

- Runtime definitions and values: `packages/storage/src/schema/cmsSchema.ts`
- Creation, revisions, and publication gate: `packages/storage/src/repositories/entitiesRepo.ts`
- Admin create/save/upload actions: `apps/app/app/(actions)/entityActions.ts`
- Public contract baseline: `packages/directory-types/src/v1.d.ts`
- Lifecycle order: `packages/js/src/plants/plantStages.ts`
- Relationships and inverse health assembly: `packages/storage/src/helpers/plantRelationships.ts`, `packages/storage/src/helpers/plantHealth.ts`
- Operation applicability: `packages/js/src/operations/index.ts`

## Validation

For skill-only changes, run the skill validator and `git diff --check`. When using the skill for a real plant, validation must include the cover validator, admin raw/formatted readback, draft preview, and runtime completeness. Run storage/API/client tests only when implementation code or contracts change.
