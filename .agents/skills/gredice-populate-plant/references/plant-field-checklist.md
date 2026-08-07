# Plant field checklist

Use active runtime definitions as the source of truth. This checklist is the expected coverage baseline, not permission to invent values or bypass newly added required fields.

## Identity and editorial content

| Path | Rule |
| --- | --- |
| `information.name` | Canonical Croatian customer-facing name; duplicate-check normalized names and slugs. |
| `information.alternativeName` | One genuine Croatian regional/common synonym per multiple raw value row; the formatted/public value is an array. Do not repeat the canonical name. |
| `information.latinName` | Accepted botanical name with author only when useful; verify taxonomy. |
| `information.origin` | Concise domestication/geographic origin supported by strong sources. |
| `information.description` | Practical introduction: crop type, harvested part, habit, and notable use; avoid health claims. |
| `information.verified` | Set only according to the current editorial policy; do not infer it from confidence. |

## Lifecycle content

Cover the nine canonical stages in `packages/js/src/plants/plantStages.ts`:

- `soilPreparation`: soil structure, drainage, pH, and restrained fertility guidance.
- `sowing`: direct/indoor method, timing, depth context, emergence, and thinning.
- `planting`: transplant readiness, hardening, placement, and support where relevant.
- `growth`: habit, temperature/season response, maturity pattern, and space use.
- `maintenance`: weed, mulch, training, pruning, protection, and feeding practices that actually apply.
- `watering`: establishment and production-stage moisture needs; avoid rigid schedules independent of weather.
- `flowering`: pollination or bolting guidance only when meaningful to the harvested crop.
- `harvest`: observable readiness cues, careful picking method, and repeat-harvest behavior.
- `storage`: immediate cooling/curing, realistic short storage, and preservation where supported.

Do not fill a biologically inapplicable section with generic filler. Record it as intentionally inapplicable in the handoff. Add `information.tip` entries only for useful, distinct advice; persist each tip as a separate multiple JSON value with `header` and Markdown `content`, while the formatted/public value is an array.

## Calendar

Persist each calendar window as a separate multiple JSON value `{ "start": month, "end": month }`; the formatted/public value is an array. Fractional values such as `3.5` mean mid-month. Declare the climate baseline in the handoff: default to continental lowland Croatian outdoor production, and document coastal or protected-production alternatives separately instead of blending them into one range.

- `calendar.propagating`: indoor/protected propagation windows when used.
- `calendar.sowing`: direct outdoor sowing windows when used.
- `calendar.planting`: outdoor transplanting or planting windows when used.
- `calendar.harvest`: all realistic harvest windows; required in the current public contract.

Use Croatian growing conditions as the default context. Preserve multiple windows instead of stretching one interval across a summer pause.

## Agronomic attributes

| Path | Unit or allowed values | Validation rule |
| --- | --- | --- |
| `attributes.seedingDistance` | cm | Plant-to-plant spacing used by the 30×30 cm field calculation; values over 30 cm still resolve to one plant per field. |
| `attributes.seedingDepth` | cm | Use `0` only for true surface sowing. |
| `attributes.germinationType` | `Klijanje pod svijetlosti` or `Klijanje u mraku` | Preserve the current exact vocabulary. |
| `attributes.gernimationTemperature` | °C | The misspelling is the canonical key. Record a seed-germination optimum, not growing-season temperature. |
| `attributes.germinationWindowMin/Max` | days | Min must not exceed max; reflect normal viable seed under suitable conditions. |
| `attributes.light` | `0`, `0.5`, or `1` | Shade, partial shade, or sun. |
| `attributes.soil` | `Lagano (pješčano)`, `Srednje (ilovasto)`, or `Teško (glineno)` | Choose the closest supported category; explain nuance in prose. |
| `attributes.nutrients` | `Niske potrebe`, `Srednje potrebe`, or `Visoke potrebe` | Avoid equating high need with unrestricted nitrogen. |
| `attributes.growthWindowMin/Max` | days | Inspect current definition descriptions, catalogue examples, and consumers; define the same start/end event for both values before assigning them. |
| `attributes.water` | `Suho tlo`, `Vlažno tlo`, or `Mokro tlo` | Choose the supported moisture category; put stage nuance in watering prose. |
| `attributes.harvestWindowMin/Max` | days | Inspect current definition descriptions, catalogue examples, and consumers; use the application's established start/end events consistently. |
| `attributes.yieldMin/Max` | grams | Min must not exceed max and must match `yieldType`. |
| `attributes.yieldType` | `perPlant` or `perField` | `perField` means one 30×30 cm field. |
| `attributes.cleanHarvest` | boolean | True only when normal harvest leaves no plant-removal task. |
| `attributes.maxHarvestDaysBeforeDelivery` | whole days, `>= 0` | Freshness policy, not harvest duration; `0` means same-day harvest. |

## Commerce and cover

- `prices.perPlant`: current EUR price for one transplant or one 30×30 cm sowing unit. Do not invent pricing; obtain the commercial decision. `0` means explicitly confirmed free, never “unknown.”
- `store.availableInStore`: explicit boolean independent of publication state.
- `image.cover`: JSON `{ "url": "..." }` created by the admin upload. Validate the local PNG before upload and the CDN bytes after upload.

## Relationships, health, and operations

- Store `relationships.companions` and `relationships.antagonists` as separate multiple `ref:plant` rows; the formatted/public values are arrays. Relationships render reciprocally, so add each pair once. Skip disputed broad folklore and any companion/antagonist contradiction.
- Plant health is inverse-derived. Do not write a `health` attribute on the plant. Review published disease and pest records and propose adding the plant to their `relationships.affectedPlants` references only when supported; this changes existing records and requires its own authorization/readback. Keep source/review notes on the health record.
- Link only applicable published directory operations. A plant operation is relevant when `application = plant` and it is explicitly linked or globally enabled with `appliesToAllTargets = true`.
- Reuse existing harvest and maintenance operations. If behavior is genuinely absent, propose one unpublished operation draft with full information, stage/application/frequency/duration/delivery/condition/price/image fields and a proposed association. Create it only after explicit authorization.

## Final evidence

The handoff must state every checklist path as populated, intentionally inapplicable, awaiting a commercial/editorial decision, or blocked by missing evidence. Include source URLs, entity ID/state/slug, cover dimensions and SHA-256, preview result, unresolved references, and whether publication was requested.
