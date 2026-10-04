---
name: gredice-populate-plant-sort
description: Create and fully populate brand-new Gredice plant-sort directory entities as unpublished Croatian drafts, including the published parent-plant reference, cultivar-specific sourced content, reproduction and store controls, and a realistic transparent produce-focused cover. Use when onboarding a new cultivar, hybrid, commercial line, bulb selection, or other plant sort before review and eventual publication. Route established-sort changes through supported community edits or the appropriate admin review workflow instead.
---

# Gredice Populate Plant Sort

## Overview

Build a complete, source-backed `plantSort` record that adds cultivar-specific value without copying the parent plant's generic content. Keep the result as a verifiable draft until publication is explicitly authorized.

Read [plant-sort-field-checklist.md](references/plant-sort-field-checklist.md) in full before creating or populating a record.

## Boundaries

- Confirm a published parent `plant` exists. If the crop/species itself is missing, use `gredice-populate-plant` first.
- Use this workflow only for a brand-new sort. Propose changes to an established sort through community edits where supported; use the appropriate reviewable admin workflow for unsupported core fields.
- Confirm the target environment, host, and authenticated admin account before any mutation. Never infer that the currently open session is the intended production account.
- Link the parent with `information.plant` (`ref:plant`). Never use `entities.parentId`; that field is only for same-entity-type hierarchy.
- The admin reference picker exposes published plants. When a plant and its first sort are both new, complete and review the plant first; do not work around the draft-parent limitation unless the user explicitly authorizes a guarded repository-helper flow.
- Create and populate through the authenticated admin directory workflow. Community edits cannot create a sort or set its parent, cover, store flag, reproduction type, or publication state.
- Keep the new sort in `draft`. Publishing is a separate, explicit user decision after complete readback and preview.
- Load active `plantSort` definitions at runtime and map them by `category.name`; never hardcode definition IDs.
- Write Croatian copy, keep direct source URLs, and leave unsupported cultivar-level facts unset. Do not turn parent-species facts into apparently cultivar-specific claims.
- Finish research and a locally validated cover before creating the entity. Identify unresolved commercial inputs first; proceed with an incomplete draft only when the user accepts those explicit blockers. If an earlier attempt left a partial draft, reuse and report that ID instead of creating another blank record.

## Workflow

1. **Resolve identity.** Establish the canonical marketed cultivar name, aliases, breeder/maintainer where known, cultivar-group or hybrid notation, exact parent plant, and reproduction type. Search both published and draft raw sort entities for case-, whitespace-, punctuation-, synonym-, vendor-spelling-, and slug-normalized collisions. Stop on an ambiguous near match rather than creating a probable duplicate. Keep aliases or breeder facts that lack a schema field in the source ledger and review handoff.
2. **Research cultivar evidence.** Prefer variety registries, breeders, conservation bodies, extension services, trial results, and reputable seed suppliers. Separate stable cultivar traits from vendor marketing and region-dependent performance.
3. **Inspect and preflight.** Load active definitions, required flags, visibility, data types, defaults, multiplicity, and reference targets. The runtime schema—not a remembered list—is the publication gate. Prepare the per-field source ledger, corroborate the exact produce phenotype where sources permit, generate and validate the local cover, and resolve or explicitly declare business blockers before mutation.
4. **Create the draft.** Add one blank record in `/admin/directories/plantSort`, capture its ID, and immediately re-run the duplicate guard. If a collision appears, stop without populating or deleting the new draft, report its ID, and request explicit cleanup direction. Otherwise set the published parent through `information.plant`. If the parent is still a draft, stop at this boundary and report the dependency instead of linking the wrong plant. If an applicable field is hidden from the form, use an approved guarded server/repository path or report a blocker; do not confuse a formatted default with a persisted value.
5. **Populate core controls.** Fill the exact name, concise Croatian short description, parent reference, `attributes.reproductionType` (`seed` or `bulb`), explicit `store.availableInStore`, and `image.cover`. Store availability is a commercial decision and must not be inferred from publication; if it is unresolved, leave the entity in draft and report the blocker rather than claiming completion. If reliable evidence does not fit the current reproduction enum, report a schema gap instead of forcing the closest value.
6. **Add cultivar-specific content.** Fill Latin/cultivar notation, origin, full description, and only the lifecycle sections for which the sort differs meaningfully from its parent. Prefer concrete phenotype, growth habit, maturity, use, harvest cue, storage behavior, or resistance evidence. Leave generic parent guidance to the parent page.
7. **Handle relationships conservatively.** Plant sorts inherit the parent plant's relationship baseline. Add a direct sort override only when reliable evidence shows a cultivar-specific difference; avoid duplicating inherited companions or antagonists.
8. **Create the cover during preflight.** Load and follow the available image-generation skill (in Codex, `$imagegen`) to make a square, realistic, naturally imperfect image of the exact marketed produce phenotype. Emphasize the harvested product rather than the whole plant: fruit, root, bulb, head, flower head, pod, seed head, or harvested leaf bunch as appropriate. Use no text, labels, banners, logos, hands, packaging, props, soil bed, or CGI styling. Remove the background and export a transparent RGBA PNG.
9. **Validate and upload the cover.** Run `node scripts/validate-directory-cover.mjs <cover.png>`, visually compare color/shape/size with the cultivar sources, then upload through `image.cover`, which attaches the returned URL immediately. Preserve the SHA-256. Fetch the CDN object with cache busting, validate the downloaded file again, and require matching content type, dimensions, alpha, and SHA-256 before accepting the attachment. If remote validation fails, clear `image.cover`, verify the raw value was removed, and report the orphaned CDN URL as a cleanup candidate. A guarded upload-only path may avoid immediate attachment, but use it only with explicit authority.
10. **Verify and hand off.** Check raw values and the authenticated draft-formatted preview, parent linkage, required completeness, enum/control values, derived slug, absence of copied parent prose, cover URL/bytes/hash/alpha, `state = draft`, `publishedAt = null`, and absence from the public published collection. A public 404 is expected before publication. Preserve the source ledger in the durable task or review artifact and report the sort ID, state, parent ID, populated and intentionally empty fields, store decision, reproduction type, image evidence, named visual-review result, and unresolved items.
11. **Publish only on request.** After explicit authorization, publish and verify the sort in the published list, `/biljke/{parentSlug}/sorte/{sortSlug}`, commerce/search surfaces when store-enabled, and the CDN. Account for public cache delay rather than treating it as a failed write.

## Cover Prompt Template

Use this base and add source-backed cultivar traits:

> Realistic and naturally imperfect studio image of [CULTIVAR] [HARVESTED PRODUCT], accurately showing [CULTIVAR-SPECIFIC COLOR, SHAPE, SIZE, PATTERN, OR INTERIOR]. Centered isolated subject, square composition, plain white background for clean removal. Focus on the produce, with only minimal leaves or stems needed for identification. No text, labels, banners, logos, hands, packaging, garden props, decorative objects, or CGI look.

For a leafy cultivar, the leaves are the product: show the harvested head or bunch, not a generic rooted plant. The attached asset must be a transparent PNG, not the white-background master.

## Repository Anchors

- Runtime definitions and draft entities: `packages/storage/src/schema/cmsSchema.ts`
- Create/update/publish behavior: `packages/storage/src/repositories/entitiesRepo.ts`
- Admin image upload: `apps/app/components/shared/attributes/typed/ImageInput.tsx`, `apps/app/app/(actions)/entityActions.ts`
- Public sort contract: `packages/directory-types/src/v1.d.ts`
- Parent and inherited relationship behavior: `packages/storage/src/helpers/plantRelationships.ts`
- Editable-field boundary: `packages/storage/src/helpers/communityEditableFields.ts`

## Validation

For skill-only changes, run the skill validator and `git diff --check`. When using the skill for a real sort, validation must include the cover validator, parent-reference readback, admin raw/formatted readback, draft preview, and runtime completeness. Run storage/API/client tests only when implementation code or contracts change.
