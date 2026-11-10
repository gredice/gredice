# Autumn pilot preparation — 10 November 2026

**Source-ready; release-blocked.** This checkpoint advances #4991, #4999 and
#5000. It records production CMS draft creation, independent public asset reads
and fresh local qualification. It does not certify a commercial launch.

The tested source is clean `2e02348ca21c18518ebade352d34eebb28e6fe4a`, tree
`7190f41240b8e3b7db5ceb10df3426e76b7cd9eb`. API, Garden and WWW production
deployment records all identified that commit. The selected fingerprint is
`86ee0ed2e40594b53955a6c535225b830d70836ff30a9a376435f3178a5cb7b8`.
The [receipt](readiness-receipt.json) separates source, deployment, CMS, storage,
browser, profiling and outstanding acceptance.

## Catalogue preparation

The initial read-only repeatable-read CMS export found no selected entities.
The existing family specifications and `upsertDraftBlockEntities` helper then
created exactly the 24 A/B items as **unpublished drafts**, IDs **851–874**.
Croatian content, dimensions, covers, functions and proposed individual prices
come from the existing source specifications. A subsequent export generated the
[publication plan](publication-plan.json); another database comparison found
zero pending attribute changes. No existing published item was edited.

The complete plan digest is
`39b291dcc891359e3e44f36c2b5882e16b6f6a0fe1163ee12af4fe84b1cf25c5`.
Its [report](publication-plan-report.json) lists actual IDs and prices. Any CMS
edit requires a fresh export and plan. Historical family manifests retain their
original unpublished/null-ID evidence; this checkpoint records the new CMS IDs
without rewriting those approvals.

All **283** selected deployed asset URLs, totaling **3,716,133 bytes**, passed
the existing bounded exact-size/SHA256 verifier at the canonical Garden/WWW
origins. [Byte observations](deployed-byte-verification.json) are dated evidence;
actual apply must obtain its own fresh private verification and compare the
locked current CMS state.

The [public directory observation](public-directory-observation.json) still
contains 144 rows and no selected new items. StoneMedium `140` and
EnamelGardenLamp `758` remain the two published recipe dependencies. The
[public-input preflight](preflight-public-report.json) therefore remains blocked;
it is not a direct CMS audit or a claim that draft creation publishes products.

| Pack | Draft-price sum, sunflowers | Contents |
| --- | ---: | --- |
| Jesenski kutak | 230 | Orange pumpkin group, cream pumpkin, orchard crate, scarecrow |
| Šumski kutak | 125 | Mushrooms, medium stone, crescent leaf pile, fallen log |
| Topla večer | 275 | Blanket bench, tea table, enamel lamp, mauve asters |

These are [review sums](draft-pack-price-review.json), without a discount or
scenery charge. They are not immutable product candidates or configured offers.
Generate actual candidates only from the subsequently published directory and an
explicit reviewed availability-window input. No product version, configuration,
sale window or release announcement was installed.

## Pack storage

The [production read-only probes](storage-readiness.json) found none of the six
pack tables; base, placement and lifecycle readiness are false. The pulled
production environment had no enabled pack/sales flags or catalogue. This is an
environment observation, not authenticated runtime commerce acceptance.

A fresh-install SQL review artifact contains 21 Drizzle statements, the exact
source-owned nine functions and 17 triggers. Its SHA256 is
`961f57ef8add194c839c7d08b95c0dd227aa97451f640869ea22476ec57beb10`.
It is retained outside version control as
`/Users/aleks/.codex/artifacts/gredice/autumn-release-2026-11-10/pack-schema-fresh-install.review.sql`,
following the repository rule for generated migration files. It was not applied
to production and is unsuitable for a partial installation.

The artifact compiled in disposable PGlite and then in an independent disposable
PostgreSQL **15.19** cluster. All three real repository readiness probes returned
true after the PostgreSQL installation; see the
[validation](pack-schema-postgres-validation.json) and
[generation inventory](pack-schema-review.json). Maintainers must still review
and order the normal deployment migration, verify the actual source-owned
function/trigger bodies and rollout, and retain both gates off until acceptance.
Do not run `pnpm db-push` or substitute an ad hoc production SQL application for
the normal release process.

## Qualification

| Check | Result | Boundary |
| --- | --- | --- |
| Game / JS units | 2,401 / 201 passed, zero failures or skips | Local Node 26.13.0 with pinned pnpm 12.17.0 |
| Preflight, publication and starter preparation | 27 parent cases plus eight isolated publication child cases passed | Offline authority, malformed inputs, source/evidence pins and disposable transaction behavior |
| Independent PostgreSQL commerce/publication | Publication 8, purchase 11, placement 7, lifecycle 11 passed | Disposable independent connections, including active CMS-writer fencing; no production wallet use |
| Collections / storefront / inventory browser checks | 8 / 19 / 22 passed | Existing Chromium component fixtures, exact contents, retries, account changes and prepaid ownership |
| Seasonal WebGL browser checks | 71 passed | Existing early/late/winter, weather, tiers, leaf surfaces, lids, rotations and suspension fixtures |
| Garden production build / profile | Build passed; 18/18 profile cases passed existing budgets and comparability | Clean served build and harness; native Metal on Apple M4 Pro |
| Hosted CI at the selected main commit | Aggregate passed; 22 checks skipped | Garden/API/storage/Game suites were skipped by change detection; this is not full release-suite CI |

The [production profile](production-profile.json) and
[rendered report](production-profile.md) retain the exact source/build/runtime,
metrics, warnings and synthetic auth/data/analytics denials. Measurements use
five-second warmups and five-second samples, with no sustained soak. The normal
camera shows a visible subset; total garden population is not simultaneous
on-screen coverage of all 24 identities or worst-case visible density.

Representative small/constrained, medium/cloud/constrained and dense/wind/high
screenshots were inspected and are committed under [screenshots](screenshots/).
All 18 original screenshots and raw reports are also retained in the external
artifact directory above. Emulated mobile capabilities on this desktop do not
establish physical touch, listening or thermal readiness. Audio, controls and HUD
are off in the isolated profile.

Rejected setup attempts are preserved in the receipt: the temporary component
configuration initially resolved its template/public directory incorrectly and
polluted a shared cache; a clean default-config rerun passed all 120 cases. The
first profile overlapped browser work; a later attempt recorded an untracked
temporary runner as dirty. Both were rejected. The final build/harness are clean
and the final 18-case measurements ran after browser checks finished. No baseline,
budget, provenance assertion or asset approval was relaxed.

## Next release steps

The [remaining acceptance checklist](remaining-acceptance.md) records the actual
open work: full hosted candidate CI, normal storage migration rollout, combined
interaction/2D/audio disposition, a real phone, catalogue publication/readback,
immutable product configuration and authorized live commerce acceptance. The
existing [Croatian release copy](../draft-release-copy.hr.md) remains a draft.
Optional C/Later work stays outside this A/B pilot.

Re-export current CMS state and regenerate the plan before an eventual apply:

```sh
pnpm plan:autumn-publication /absolute/new-export --mode export-cms --scope autumn-ab-pilot
pnpm plan:autumn-publication /absolute/new-plan --cms /absolute/new-export/cms-export.json
```

Supply the authorized storage environment securely; the command does not load
environment files. Apply requires its explicit actor, scope, full reviewed plan
digest, a clean committed checkout and fresh exact deployed-byte verification as
documented in [publication preparation](../../autumn-publication-plan.md).
Successful publication alone still does not clear the release gates.

If sales later need withdrawal, disable the separate sales/offer gate and
preserve owned inventory, original allocations, receipt replay and prepaid
lifecycle access. Keep #4991, #4999, #5000 and the epic open until their actual
acceptance is recorded.
