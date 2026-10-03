# Autumn starter-pack preparation (#4991)

This is an offline development preparation tool, not a published catalogue. It produces three immutable **draft** snapshots with **sales disabled**, using a supplied read-only export of the published block directory. It never queries a directory, connects to storage, changes an environment variable, creates a migration, deploys assets or publishes products. Existing catalogue and rollout defaults remain empty/off.

| Product ID | Croatian name | Exact reviewed arrangement | Included quantities |
| --- | --- | --- | --- |
| `autumn-harvest` | Jesenski kutak | harvest-corner | One each: HarvestPumpkinGroupOrange, HarvestPumpkinSquatCream, HarvestCrateOrchard, GardenScarecrow |
| `autumn-woodland` | Šumski kutak | woodland-path | One each: WoodlandMushrooms, StoneMedium, AutumnLeafPileCrescent, FallenLog |
| `autumn-evening` | Topla večer | evening-seat | One each: AutumnBlanketBench, GardenTeaTable, EnamelGardenLamp, AutumnAsterPotMauve |

Each pack contains four pieces. Grass, trees, pine and stone walkway shown in the examples are scenery and are excluded from the purchase. All appearances are exact static model identities with `variant: null`; the appearance codec must accept that selection. Named colours are not numeric appearance overrides. Components remain individually purchasable through the existing storefront.

## Input and command

Supply a local UTF-8 JSON **array** from the published `/api/directories/entities/block` response (not sandbox/internal fallback data). Export retrieval and later deployment verification are separate, authorized read-only steps. No IDs or prices are supplied by a seed or recipe. The input must be a regular file up to 10 MB, with at most 10,000 rows. IDs must be positive directory integers; identities and model names must be unique. All twelve included rows must resolve as eligible decorative blocks, with positive integer sunflower prices, no raised-bed/recycler functions, no night-only or water placement, and exact non-stackable reviewed footprints (FallenLog and AutumnBlanketBench 2×1, other included pieces 1×1).

Run from the repository root, using a **new** output directory:

```bash
pnpm --filter api prepare:autumn-packs /absolute/published-blocks.json /absolute/new-review-output
```

Success creates `draft-catalogue.json` and `report.json`. A blocked directory writes only `report.json`, lists every missing model and exits nonzero. Invalid JSON or changed reviewed inputs abort before output. Existing output directories are refused. The generated catalogue is a review artifact; the tool never installs it into `GREDICE_GARDEN_PACK_CATALOGUE_JSON`.

`report.json` includes the export SHA256, preparation time, snapshot versions and pinned preview/model/runtime evidence. The preparation timestamp and unrelated export timestamps are outside the immutable version digest. `ready` describes directory/evidence preflight only; it does not prove deployed runtime assets, public sale readiness or live purchase acceptance.

## Price, ownership and version identity

Charge is the sum of current positive individual prices times exact quantity, with no discount. Every unit freezes its full individual paid allocation and the same recycling value, matching ordinary full-price recycling. Allocations must sum to the charge; overflow or malformed quantities fail validation. Refunds use unused paid allocations, season expiry retains owned units, garden deletion recycles placed units once, and account deletion detaches the owner while retaining audit. These are existing shared-contract policies, not new economic mechanics.

A stable product ID identifies the recipe. Its version ID is that ID plus a full SHA256 of canonical JSON containing the entire immutable snapshot (except its own version ID) and reviewed evidence. Object keys are sorted by code-point order, arrays retain authored order/unit ordinals. Changing an entity ID, model, fixed appearance, quantity, allocation/price, policy, text, preview, snapshot publication/window or reviewed model bytes yields a new version. Promotion from draft to published therefore requires a new version; offer-level sales flags/windows can change separately. Existing version registry guards still reject altered snapshots under a reused ID.

## Reviewed-input boundary

`@gredice/js/autumnArrangements` owns the renderer-free placement/quantity manifests; the game preserves its existing export and runtime-name compile check. API preparation never imports game renderers or the client package.

The tracked `apps/api/lib/garden/autumnStarterPackEvidence.reviewed.json` was pinned from reviewed capture input commit `c48974bd2e21316ae5c3034b9d305350aa479cd4` and final capture-record commit `deca1575e69ddc52eb2f3ff89ca3333b714239fd`. These commits are provenance, not runtime Git dependencies. CLI/tests run in shallow checkouts or source archives using local files only. The API group-layout change was freshly recaptured from clean source `a78a73d11910690d511da631bf69ab35eec7d0b7`: three desktop/high tests regenerated 36 scene images and the three public previews. All public previews and every capture record excluding source identity are byte-identical to the original review; 35 of 36 ancillary images are byte-identical. Astra xhigh approved the sole ancillary change: six sky/background pixels from two tiny star specks, with garden, props, canopy, moon, framing and lighting unchanged. The original JSON records are retained under `docs/autumn-starter-pack-review-2026/original-c48974bd`, and the exact source/tree, before/after image hashes and command are in `docs/autumn-starter-pack-review-2026/group-placement-parent-recapture.json`. Low/static mobile captures retain their original source and were not relabelled as fresh.

The manifest keeps the original approval commits and records a separate `recapture.source` plus previous capture/preview hashes. The reader checks that the fresh capture JSON's source exactly matches that declared recapture, alongside all existing byte pins. Recapture evidence changes the immutable prepared product version; it never mutates an existing purchased snapshot.

The subsequent group-layout UI wrappers were independently recaptured from clean checkpoint `61fd90f03d0f738917acdc6ba20f75582ca9e95f`. All 36 desktop/high images, all three public previews and every non-source capture record field are byte-identical to the API refresh. Three existing runtime wrapper pins were regenerated from those inputs, and their new transitive `EntityPreviewContext.ts` dependency is explicitly pinned in all proofs. `docs/autumn-starter-pack-review-2026/group-layout-ui-recapture.json` records the exact comparison and command; `api-parent-a78a73d11/reviewed-evidence.json` preserves the preceding API review manifest. The original archived records and API recapture report remain intact. Later preview/HUD-only camera changes are not claimed as this capture's source; their listed input bytes must be compared before combining the evidence.

The reader compares current PNG/capture JSON, included and scenery GLB/Blender sources, renderer bindings, asset registry, direct model configuration/colour aliases and selected shared render/capture helpers to pinned SHA256s. The builder checks exact included/scenery quantities and every placement's identity, coordinates, rotation, role and width/depth against captured layout. New coordinates, quantities, geometry, aliases or colour settings cannot reuse the old approved PNG. Updated evidence requires a separately reviewed capture; there is no automatic regeneration/acceptance option. These selected-input checks do not replace a full browser recapture, physical-device QA or deployed-asset verification.

## Observed publication blocker and validation limits

The read-only public export observed **2026-10-02T18:28:09Z**, SHA256 `8c4fff1ebe0a5ac9f90f9ba52436d263c70b16f9cb5a85f1cc018b4674c88cde`, contained 144 rows. It was a CDN-cached public response (`X-Vercel-Cache: HIT`, `Age: 108`, `Cache-Control: public, max-age=3600`), not a direct database audit. Among the twelve included models, only StoneMedium (140, 5 sunflowers) and EnamelGardenLamp (758, 80 sunflowers) were present. Preparation is blocked for all three products by the other ten missing models. These observations are dated evidence, not configured production prices or IDs.

Tests use an explicitly synthetic directory and published fixture versions solely inside isolated PGlite service/repository tests and browser mocks. They cover all three derived products: four-unit grants, partial exact placement, readback, independent repeat purchases, placement after catalogue withdrawal without extra charge and original-value idempotent refund. Three actual storefront card reviews cover mobile/keyboard input, precise pieces, excluded scenery, individual prices without invented savings and no automatic purchase/placement.

Live publication/deployed line resolution and purchase/partial placement/reload/repeat/season-end acceptance remain outstanding under #4991. This preparation must not close that issue.
