# Offline autumn release preflight (#4999 / #5000)

`pnpm preflight:autumn-release` consolidates the narrow A/B pilot into a reviewable
manifest and actionable report. It reads local source, assets and optional local
inputs. It does not fetch URLs, connect to storage, read live configuration,
change environment variables, generate assets, publish products or clear release
gates. Its output is **source-ready** or **blocked**, and always
**release-blocked**. Exit code 1 is intentional for a blocked release.

## Selected scope

The tracked [pilot selection](autumn-release-2026/pilot-selection.json) selects
exactly the twelve first-wave families #4948–#4959: 24 ordinary item identities
backed by 16 GLBs. It also records the three four-piece starter recipes and their
existing StoneMedium / EnamelGardenLamp dependencies. Arrangement ground, tree,
pine and walkway are scenery, excluded from paid contents. Existing seasonal,
audio and pack purchase/inventory/placement/lifecycle foundations are prerequisites.

Optional C/Later props, effects, activities and group/ownership offers are explicitly
excluded from this required launch selection, even where their PRs are prepared.
Tea-table steam remains selected; the chestnut C-half of #4972 is excluded explicitly.
An excluded issue is not a claim that its source is absent. The wider epic can ship
those separately after their own gates; this preflight cannot silently expand the pilot.

## Run

Use Node >=24 and the pinned pnpm. From the repository root:

```sh
pnpm install --frozen-lockfile --filter api... --filter .
pnpm preflight:autumn-release /absolute/new-review-directory
pnpm preflight:autumn-release /absolute/another-new-directory \
  --catalogue /absolute/published-block-export.json \
  --products /absolute/reviewed-offers.json \
  --evidence /absolute/artifact-index.json
```

Each optional input is a regular UTF-8 JSON file up to 10 MB. Unknown/duplicate CLI
options are rejected. The output directory must not exist, even if empty. The
command emits `manifest.json` and `report.json`; it never overwrites prior evidence
or installs an offer in `GREDICE_GARDEN_PACK_CATALOGUE_JSON`. Root selection and
repo artifacts cannot use traversal or symlinks escaping the checkout. Asset reads
are bounded at 50 MB, JSON at 10 MB, directory rows at 10,000, offers at three and
evidence artifacts at 100. The API's pinned tsx and shared contracts are reused;
no renderer or database module is needed.

The manifest records every inspected file/hash, actual versioned model URLs,
family-to-model aliases, registered renderers, audited picker memberships, supplied
catalogue identities/prices, immutable product versions and excluded scope. Proposed
family seed prices are deliberately omitted. Without a directory export it reports
which exact identities need reconciliation instead of guessing IDs or prices.

## Source and trust boundary

Family manifests pin model/image/Blender bytes. Their current manifests stay
`unpublished`, with null source catalogue IDs. The three pumpkin Blender files
missing from their historical manifest are inventoried separately through the asset
registry; this is a new byte inventory, not retroactive art approval.

The tool checks runtime registry declarations without executing renderers. It
accepts only the current identifier/shorthand registry grammar; expressions or
duplicate bindings fail closed. It checks the 16 generated model URLs against the
asset registry and GLB version hashes. Pumpkin/aster named colours map to base GLBs;
no alias-name URL is fabricated. Picker membership was audited against actual
`autumnItemCollections`; exact picker/shared-metadata source pins preserve that
mapping. Changed metadata requires deliberate review rather than automatic acceptance.
Direct selected renderer/shared-JS inputs are inspected alongside the existing
starter proof loader. This is bounded selected-input coverage, not a full renderer
dependency graph or proof of every visual/collision behavior.

The existing starter evidence reader compares exact current captures, previews,
model/source/runtime inputs and layout proof. Original approvals remain intact.
Desktop/high recapture source is `6f7d5700a`; low/static remains original `c48974bd`.
The CLI operates only on its own checkout, avoiding a mixed-root proof lookup.

`sourceFingerprint` hashes the sorted inspected file inventory. Git `headCommit`,
`headTree` and `workingTreeStatus` are recorded separately: dirty working bytes are
not claimed to equal HEAD. Source archives may have null Git provenance and still
run from local byte pins. Changing selected bytes blocks the source check until
reviewed evidence/selection is deliberately updated; the tool never refreshes pins.

## Optional inputs

The [input contract](autumn-release-2026/preflight-input-contract.json) documents
formats. Catalogue input is the raw published block-directory array, not sandbox or
internal render rows. All IDs/names must be positive and globally unique. New pilot
rows must match authored metadata, dimensions, spans, functions, sale eligibility
and the reviewed WWW cover URL. Legacy dependencies resolve from the same export
and preserve their actual model identities/1×1 spans. Top-down images are checked
from source inventories, not an invented public directory field. StoneMedium's
unversioned GLB and the legacy numbered top-down images are intentional.

Offers use the existing strict service schema and must match the three exact recipes,
current individual prices, allocations, policy, localized text and reviewed previews.
Content-addressed versions use the existing preparation/version function. Publication
or snapshot-window changes require a new immutable version; no existing version is
mutated. All emitted sales are forced off, including when supplied offers say enabled.
A valid synthetic fixture is not a configured production offer.

Evidence input contains only a source fingerprint and bounded artifact references
(kind, repository-relative path, SHA256, optional note). Actual local hashes must
match. A hash proves file identity, not its assertions. Booleans, invented measurements
or labels cannot produce release-ready: every artifact remains marked for independent
review, and the six deployment/storage/combined-QA/physical-device/live-acceptance/
publication gates always remain external blockers. Deployed URL bytes and physical
hardware require independently observed evidence and reviewer acceptance.

## Validation

```sh
pnpm --filter api exec node --import tsx --conditions=react-server --test \
  lib/garden/autumnReleasePreflight.node.spec.ts
```

The shim registers meaningful malformed scope, changed model/source, duplicate/internal
IDs, cover/geometry/metadata, immutable recipe versions, sales-off, artifact trust,
file bounds, escaping symlink and CLI/overwrite regressions in existing API node CI.
It requires no workflow change, database, live configuration or asset regeneration.
Existing sample workflow pins are preserved.

## Dated prepared-candidate output (2026-10-04)

The committed [manifest](autumn-release-2026/2026-10-04-preflight/manifest.json),
[report](autumn-release-2026/2026-10-04-preflight/report.json) and
[validation identities](autumn-release-2026/2026-10-04-preflight/validation.json)
were generated from clean `22e48526d2b5f7e03386cb6540733386296c92db` with
394 inspected files. Source is ready; release is blocked. The supplied public export
was freshly observed at **2026-10-03T23:10:28Z** (October 4 in Zagreb), with 144 rows,
CDN MISS/Age 0 and the same bytes as the earlier observation. This is public readback,
not direct database verification.

All 24 new family rows are absent. The exact recipes are missing ten models;
StoneMedium `140` (5 suncokreta) and EnamelGardenLamp `758` (80 suncokreta) resolve
with matching metadata. Three actual offers and the six independent release gates
remain unverified. No IDs, prices or versions were invented to fill those gaps.
Eleven focused cases pass both in the normal workspace and a fresh API-only source
archive; API compilation passes. These outputs are a dated checkpoint, not current
production configuration or a future-release certificate.
