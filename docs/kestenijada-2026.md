# Kestenijada sample and event window (#4997)

`/kestenijada` is an authored, public inspiration page. It is not a customer's
public garden and never creates a garden, account, purchase or placement. Its
canonical share URL is `https://vrt.gredice.com/kestenijada` and sharing requires
an explicit click. There are no real-world event, food-stock or delivery claims.

## Exact scene

The pure source of truth is `@gredice/js/kestenijada`. A 4×4 grass surface has
four StoneWalkway pieces in column x2 and five static decorations, one each:

| Decoration | Origin x/z | Rotation | Occupied cells |
| --- | --- | --- | --- |
| ChestnutRoastingCart | 0/3 | 0 | 0/3, 1/3 |
| GardenTeaTable | 0/1 | 0 | 0/1 |
| AutumnBlanketBench | 3/1 | 1 | 3/1, 3/2 |
| HarvestCrateOrchard | 3/3 | 0 | 3/3 |
| WoodenHandLantern | 1/1 | 0 | 1/1 |

Grass and path are scenery, not additional contents to buy as a bundle. The
cart approach cells 0/2 and 1/2 remain empty. Translation is (-2,0,-2), with
0.4 grass support. Existing entity components apply footprint offsets exactly
once; the scene does not duplicate the cart's +0.5X or rotated bench's +0.5Z.
Existing model metadata supplies cart/bench/tea spans. Static variant decoding
fails closed if a future model requires a selected appearance.

The default view is day. Optional Sumrak/Noć controls reuse the existing scene
lighting; there are no event-specific lights or effects. Sound and weather are
disabled. Mobile uses the existing low quality profile and camera zoom53;
desktop uses zoom80 with a maximum780×600 viewport. Static furniture remains
complete under low quality and reduced motion. The sample's exact render-only
metadata has negative IDs/zero prices, lives in the viewer's isolated cache and
never participates in catalogue eligibility, ownership or placement. It cannot
refetch published rows after that display cache becomes stale.

## Published offers and privacy

The sample lists its actual five decorations separately from the existing
`chestnuts` / Kestenijada shop collection. Both use only the raw published block
directory response. The collection is hidden when its cart is not eligible.
Links require positive safe IDs/prices, unique IDs/model names and unambiguous
WWW route aliases; the sample also checks exact decoration spans and excludes
functional/internal rows. Stored slugs are preferred; the existing WWW block
route supports stored slugs and slugified labels. Current night-only availability
uses real scene-location time, never the selected preview lighting. Missing
items say “Trenutačno nije u ponudi”; directory failures keep an explicit retry
and suppress offer links. No local draft prices or IDs become sale offers.

The Garden root provider selects only this exact pathname for the public
branch. It preserves Nuqs/theme providers but omits AuthProvider, temporary
login and private notifications. Other routes retain their existing providers.
The pathname boundary has Suspense for Next's dynamic route prerendering.
PublicGardenViewer receives only authored stacks, never a fabricated numeric
garden ID, presence controller or private garden metadata. Assets on the actual
route resolve relative to the current app origin, including preview deployments.

## Default-off promotion

`GREDICE_KESTENIJADA_EVENT_CONFIG` is server-only, unset by default. It accepts
bounded strict JSON with exactly `enabled`, `assetsVerified`, `startsAt` and
`endsAt`. Both booleans must be true. Instants must be valid absolute ISO dates
with an explicit UTC/offset and startsAt < endsAt. Discovery and the optional
photo prompt require startsAt ≤ server-reference time < endsAt and all five
currently eligible published decorations. The homepage checks the catalogue
with a five-second timeout and fails closed. No real dates, catalogue rows or
configuration are published by this change. `assetsVerified` is an operational
attestation after a deployed-asset review, not proof supplied by a directory row.

After the window ends, the permalink remains neutral inspiration. Purchased
pieces and independent shared steam/fire/lighting are unaffected by this window;
this page neither grants nor consumes anything. The public sample does not
advertise an active event when configuration or readiness is missing.

## Optional local photo

“Trenutak uz kestene” is available only during the ready event window. It uses
the existing PublicGardenViewer capture/PNG encoder with static authored stacks,
no private name, sign message, account IDs, visitors or weather data. The PNG
stays local and can be downloaded explicitly. No upload or share of that image
occurs. Cancellation, a lighting change, window closure and unmount invalidate
pending work; obsolete callbacks cannot replace a fresh capture. Closing or
unmounting revokes the Blob URL. Encoder failures remain visible with an explicit
retry. Sharing the sample always shares only the static canonical URL.

## Local evidence

`docs/kestenijada-2026/` contains day/dusk/night/mobile-low captures and measured
world/screen bounds for all five actual decoration geometry roots. Astra's visual
review approved all four original views: readable identities, correct support,
clear approach and uncropped geometry. Final file hashes and source/GLB bindings
are recorded in `evidence.json`. No model, source asset or GLB was edited.
The probe's renderer counters are incidental diagnostic samples (including
cached/offscreen passes); they are **not** frame cost or performance acceptance.
SwiftShader screenshots are visual/local evidence, not physical-device budgets.

Validation commands (from repo root):

```sh
pnpm --filter @gredice/js exec tsx --test src/kestenijada/kestenijada.unit.ts
pnpm --filter @gredice/game exec tsx --import ./scripts/register-test-assets.mjs --test src/kestenijada/kestenijadaScene.unit.ts src/gardenOverview2DBundleBoundary.unit.ts
pnpm --filter garden exec playwright test --config playwright.kestenijada.config.ts
pnpm --filter garden exec playwright test --config playwright.kestenijada-capture-regression.config.ts
pnpm --filter garden build
pnpm --filter garden exec playwright test --config playwright.kestenijada-route.config.ts
pnpm --filter @gredice/game typecheck
pnpm --filter garden typecheck
pnpm --filter www typecheck
```

The actual-route test starts only a local fixture API and built app on port 5486
by default (`GREDICE_KESTENIJADA_TEST_ORIGIN` can select another local HTTP
origin). Its
sales-like rows/one-hour window are synthetic test data. It verifies direct
navigation has no private reads, model requests use the app origin, a real Link
to the ordinary root preserves login/bootstrap behavior, and the discovery Link
returns in the same document with no private calls after the public sample mounts.
No fixture request reaches live auth/storage or modifies external data. Production
publication, deployed catalogue readiness and physical-device acceptance remain
separate release work.

## Integration provenance

The original checkpoint `d0fee5e13a2230d160c723a4ea65e52d1c285d83` and its
nine capture/evidence files are archived without changing bytes in
`docs/kestenijada-2026/original-d0fee5e13/`. Fresh six-case browser captures on
the #4992 renderer parent `f97ddf38b6009103819902f9494a0fd5e2f28286` produced
byte-identical day/dusk/night/mobile PNGs, identical decoration world/screen
bounds and identical viewport sizes. This carries Astra's pixel review forward
without claiming a new, different visual approval. The recorder also pins the
extracted `orthographicCameraFit.ts` and `EntityPreviewContext.ts` inputs.

Final UI parent `9b9df59b18d98c4d2e98642d77f5d84504bc04d4` adds only two
test repairs to that verified renderer source. The typed private photo account
fixture now matches the actual current-account/balance response (including
sunflower history); all five existing photo/WebP regressions pass. Its initial
failure reproduced on exact parent f97 before any capture began, so the fix is
in the UI parent rather than an event workaround. No waits or privacy assertions
were relaxed. Final consumer typechecks and the selected-input readback verify
the restacked event. The evidence JSON distinguishes capture commits, final
integration parent and current byte bindings.

## Actual-route CI registration

The Garden CI matrix has a dedicated `kestenijada route` shard using
`playwright.kestenijada-route.config.ts`. This config starts the built app with
an explicit synthetic active event and an isolated local directory API. The
ordinary Chromium project excludes this route test because its regular server
has no event configuration. Component tests remain in the ordinary WebGL shard.
The route test compares model origins with the actual page origin, rather than
a developer machine's host and port. It retains direct navigation, same-document
Link transitions, configured discovery and private-request fences.

This CI-only correction changes test/fixture/registration bytes; the recorder
pins those inputs separately while preserving the original capture commits,
archived evidence and byte-identical visual/geometry proof. It does not provide
a new renderer capture or alter any model.
