# Plant-sort field checklist

Use active runtime definitions as the source of truth. A sort should contain the complete commercial identity and only source-backed cultivar-specific editorial differences; its parent supplies general crop guidance.

## Core record

| Path | Rule |
| --- | --- |
| `information.plant` | Numeric `ref:plant` pointing to the correct published parent plant. Never use `entities.parentId`. |
| `information.name` | Canonical marketed cultivar/sort name in Gredice naming style. Preserve registered capitalization and hybrid notation. |
| `information.shortDescription` | One concise Croatian sentence distinguishing the product phenotype or use. |
| `attributes.reproductionType` | Exact current value `seed` or `bulb`. |
| `store.availableInStore` | Explicit commercial boolean; do not derive it from publication. |
| `image.cover` | Admin-uploaded JSON `{ "url": "..." }` for the exact cultivar phenotype. |

All six are present on the current published catalogue and should be treated as the normal minimum even if runtime required flags later change.

## Cultivar-specific editorial fields

| Path | Rule |
| --- | --- |
| `information.latinName` | Botanical name plus cultivar/group notation when the identity is certain; do not force a cultivar epithet onto generic trade labels. |
| `information.origin` | Breeding, selection, or geographic origin only when directly documented for this cultivar. |
| `information.description` | Croatian description of stable distinguishing traits: phenotype, habit, maturity, culinary/production use, and documented resistance where relevant. |
| `information.soilPreparation` | Only a cultivar-specific soil difference; otherwise inherit the parent. |
| `information.sowing` | Cultivar-specific sowing timing, seed treatment, or emergence behavior. |
| `information.planting` | Cultivar-specific spacing, support, or transplant behavior. |
| `information.growth` | Habit, vigor, height/spread, determinacy, maturity class, or climate response. |
| `information.maintenance` | Cultivar-specific training, pruning, feeding, or protection. |
| `information.watering` | A documented cultivar-specific moisture sensitivity. |
| `information.flowering` | Flowering/pollination trait meaningful to production. |
| `information.harvest` | Produce-specific maturity cues, size/color, picking stage, and repeat-harvest behavior. |
| `information.storage` | Cultivar-specific curing, shelf life, or storage behavior. |

Do not copy the parent plant prose into empty sort fields. Empty means “use the parent baseline,” while a populated field should add a meaningful override or supplement. Generic/type records must disclose that they are not a uniquely identified cultivar and avoid invented Latin names or origins.

## Relationships and operations

- Sorts inherit the parent plant's companions and antagonists. Add direct sort relationship rows only for a reliable cultivar-specific difference, and never duplicate the inherited set.
- Operation applicability comes from the parent plant and global operation rules. Do not create or link a sort-specific harvest operation merely because the produce looks different. Expand/reuse the generic harvest operation unless the work itself is genuinely different.

## Cover acceptance

- Show the exact harvested product phenotype: cultivar-accurate color, shape, size, striping, head form, pod form, bulb form, root form, or leaf habit.
- Focus on produce rather than foliage or a whole plant. Minimal identifying stems/leaves are acceptable. For leafy cultivars, show the harvested head or bunch because the leaves are the product.
- Use a square PNG at least 1000×1000, RGBA, with genuinely transparent background and corners, natural imperfections, and no text, banners, logos, hands, packaging, props, or CGI look.
- Run `node scripts/validate-directory-cover.mjs <cover.png>` before upload; visually inspect what automation cannot detect. After upload, compare CDN bytes/hash, dimensions, alpha, and the attached URL.

## Final evidence

The handoff must include sort ID/state/slug, parent ID/slug, source URLs, every core field, populated cultivar-specific paths, intentionally inherited paths, store decision, reproduction type, cover dimensions/SHA-256/CDN URL, preview result, unresolved decisions, and whether publication was explicitly requested.
