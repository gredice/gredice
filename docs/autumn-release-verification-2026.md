# Autumn 2026 release verification

Evidence checkpoint: **2026-10-02**, baseline
`047d73c46840954757a28bb43c039c05a02c1386` (storefront #5114).
This advances [#4999](https://github.com/gredice/gredice/issues/4999) and
[#5000](https://github.com/gredice/gredice/issues/5000); both release gates remain
open. The [machine-readable checkpoint](autumn-release-2026/baseline-evidence.json)
records exact evidence identities and the bounded public-directory observation.
It is a dated checkpoint, not a continuously current release status.

The continuation adds [starter-pack preparation #5117](https://github.com/gredice/gredice/pull/5117)
and [private photo prompts #5119](https://github.com/gredice/gredice/pull/5119).
Combined source `3914255e78e24dc0490e5d2ab7e59e9adeb68276` passed 814 API
cases (14 existing skips), 2,075 game cases, 178 JS cases, four real-renderer photo
and nineteen storefront browser cases, and all seven API/Game/Garden/WWW typecheck
tasks. One unchanged OTLP timeout test failed during the parallel local JS run;
the complete isolated rerun passed. The checkpoint records both log fingerprints.
Six preparation cases and three isolated recipe service cases pass; independent
CLI checks without Git history cover disabled drafts, missing models, input bounds
and overwrite refusal. These additions preserve the release blockers below.

Photo prompts are optional and save only after local preview. They retain the
selected scene/camera/date, remove identifying text and metadata, discard obsolete
captures, and leave private sharing unchanged. Their static PNG presentation omits
weather effects and moving visitors; the UI discloses this. The four browser cases
include anonymous sandbox participation and authenticated current-owner privacy.
They establish local software-WebGL behavior rather than physical-device acceptance.

## Prepared stack continuation (2026-10-04)

The [dated source/CI checkpoint](autumn-release-2026/prepared-stack-checkpoint.json)
records candidate `53d041ee15af81901342343a03fd6e0fd46a0dcd`, the head of
[public pumpkin trail #5151](https://github.com/gredice/gredice/pull/5151).
Its observed UTC time is recorded in JSON. It supersedes neither the original
October 2 measurements nor their capture identities. The separate
[release preflight](autumn-release-preflight.md) consolidates current selected
source/asset inputs and reports unresolved release requirements.

The final activity wave is ordered as follows:

| PR | Prepared behavior | Local validation |
| --- | --- | --- |
| [#5144](https://github.com/gredice/gredice/pull/5144) | Dedicated Kestenijada route CI with a stable private guest bootstrap fixture | Built public route passed at both the dedicated fixture origin and ordinary CI origin. |
| [#5145](https://github.com/gredice/gredice/pull/5145) | Private six-motif album and at-most-once zero-value cosmetic grants | Eleven integration cases each in isolated PGlite and disposable PostgreSQL; strict campaign, route and client checks. |
| [#5146](https://github.com/gredice/gredice/pull/5146) | Owned-garden album UI, exact uncertain-command recovery and configured preview retry | Nine album browser cases and 21 inventory/placement regressions. |
| [#5151](https://github.com/gredice/gredice/pull/5151) | Public optional five-lantern trail with real mouse/touch picking and DOM controls | Three software-WebGL cases and two built-route cases; fixed camera, reset, reload and public privacy. |

At the recorded trail runtime source, all 2,103 Game and 191 JS unit cases passed
with no skips. A fresh shared-renderer capture from clean support commit
`6f7d5700a5426282d78b417908da9ce2ce6b0e00` preserved all 39 starter-pack
PNGs and four Kestenijada PNGs byte for byte. Each recapture retains its actual
source/tree identity and archives the preceding proofs. Original mobile/static
captures remain dated original evidence.

The JSON lists exact current-candidate CI conclusions; pending checks remain
pending. The normal-garden fresh-renderer Outlet test failed on #5146 and the
preceding #5144, including timeout/closed-renderer symptoms. Repetition before
album changes does not establish its cause. The current candidate's Outlet-rest
job passed; other pending checks remain listed separately. The October 2 WebGL
cancellation below is historical evidence, not a statement of the latest
candidate's result.

Prepared source includes optional C activities and Later layout/design work.
They do not automatically become A/B pilot launch requirements. The first-wave
A/B asset families contain 24 item identities backed by 16 GLBs; the three
starter packs select twelve exact models, including two existing catalogue
models. Family and pack coverage are distinct. No products, campaign dates,
rollout flags or catalogue publications are activated by this continuation.

## Release scope

The A/B pilot consists of the Jesen picker, the twelve first-wave prop families,
three manual example arrangements, existing seasonal/weather foundations, and
the finite pack purchase, inventory, placement and lifecycle paths. The three
starter products are Jesenski kutak, Šumski kutak and Topla večer, with four
placeable decoration objects apiece as described in the
[reviewed arrangements](autumn-arrangements-2026.md). A pumpkin group is one
object; the blanket is part of its bench, and cups belong to the tea table.
Pictured ground, trees and paths are separate scenery. Optional photo prompts
and raking do not block the paid-pack pilot. Optional C events/effects and Later
group layouts/ownership-aware offers are excluded from this checkpoint.

Preparation in a PR, a merge, runtime deployment, catalogue publication and live
commerce acceptance are distinct stages. Products must use deployed, published
directory identities and preserve ordinary individual purchasing. The
[pack implementation](garden-packs.md) keeps sale availability separate from
permanent purchased ownership.

## Evidence matrix

| Surface | Recorded result | Evidence and limits |
| --- | --- | --- |
| Small example gardens, early/mid/late autumn, day/overcast/dusk/night | 72 headless captures recorded | Six committed [arrangement JSON records](autumn-arrangements-2026.md#capture-matrix-and-reproduction), each with 12 scenes and input commit `c48974bd2e21316ae5c3034b9d305350aa479cd4`; high 780×600 and reduced-motion low 390×440, DPR 1. These use fixture directory rows and software WebGL. |
| Exact pictured objects, spans, supports and scenery | Local manifest/probe coverage | Four decoration objects per composition; occupied cells 4/5/5 inside a 2×3 reserved corner. The three local public preview PNGs match the approved source screenshots byte for byte. Catalogue availability is a separate check. |
| Pack economy, ownership and concurrency | API: 807 passed, zero failures, 14 existing skips | [October 2 API CI passes](https://github.com/gredice/gredice/actions/runs/37024405052/job/110896115908). Private PGlite exercises the default pack integration paths. Disposable PostgreSQL runs separately passed 11 purchase and 18 placement/lifecycle cases with zero skips. This covers fixtures, not live balances. |
| Storefront and recovery | 16 local browser cases passed | Exact contents, repeated purchases, lost responses, remounts, account/cookie changes, stale quotes and insufficient funds; [browser fixture and tests](../apps/garden/tests/garden-pack-storefront.spec.tsx). |
| Owned inventory, prepaid placement, store/retrieve | 21 local browser cases passed | Actual client hooks and inventory HUD, exact unit identity and retry commands; [inventory suite](../apps/garden/tests/garden-pack-inventory.spec.tsx). No live purchase is claimed. |
| Game/JS regression and import boundaries | 2,072 game + 177 JS cases passed | [October 2 game/JS CI passes](https://github.com/gredice/gredice/actions/runs/37024405052/job/110896115633). React-only/Outlet entry checks remain intact. |
| Consumer compilation | Local API/Game/Garden/WWW/Storybook checks passed | Storage compilation retains the same 42 baseline diagnostics; it is not a clean storage typecheck. |
| Dense autumn, steam, quality and suspension | Earlier scoped software-WebGL evidence available | [Steam record](localized-steam-2026/validation.json): 225 ground tiles, 25 trees, 50 props and four tea tables. Steam adds 0/1/1 calls and 0/48/96 triangles at low/medium/high. p95 timings rose on medium/high. This is an earlier scoped fixture and does not clear final-head production or device budgets. |
| Winter handoff, rain/snow, constrained tier, picking, lids/gates, 2D fallback and audio | Scoped fixtures exist; combined release matrix incomplete | Run the final selected launch scope together. Earlier prop/effect tests and snapshots do not establish the cross-product matrix or real-device listening. |
| Live pilot catalogue | Blocked in observed public response | GET returned 144 rows at 18:28:09 UTC. Only StoneMedium (140) and EnamelGardenLamp (758) matched the twelve included model names. Ten names were missing. The response was CDN-cached (Age 108, max-age 3600); it is public discovery evidence, not a direct database audit. |
| Final production profiling and physical mobile | Not verified at this checkpoint | No final-head combined production report, physical touch/listening, sustained thermal observations or hardware frame-budget clearance is attached. |

The fourteen API skips are pre-existing opt-in ordinary purchase/box/stack and
Advent storage integration cases. The pack purchase/placement/lifecycle cases
run by default in isolated databases; they are not hidden behind those skips.

## Unresolved release failures at the October 2 checkpoint

The [October 2 WebGL components 2/2 job](https://github.com/gredice/gredice/actions/runs/37024405052/job/110896116165)
was cancelled after approximately fifteen minutes. Its failed attempts include
hedgehog walk/sniff/idle close-ups and dense low-quality localized steam. Those
same tests fail before the timeout on the
[#5059 parent job](https://github.com/gredice/gredice/actions/runs/36949951067/job/110671441706).
No new failing test name was observed, but cancellation leaves the job incomplete
and the aggregate CI gate failed. Matching a parent failure does not waive it for
release: resolve or reproduce the failing cases and finish the required WebGL
matrix on the release candidate.

## Completing the gate

1. Review the generated storage DDL together with the source-owned integrity
   guards and any exact legacy-location backfill. Apply the ordered rollout only
   through the normal release process; never use `pnpm db-push`. Confirm readiness
   probes before enabling the owned pack routes.
2. Deploy the reviewed runtime/assets first. Read back every included model and
   image URL, compare bytes with the reviewed manifest, then prepare the three
   pilot products from published directory rows. Resolve missing, duplicated,
   unsupported or changed-footprint entries before producing a sale candidate.
   Pin exact fixed variants, full unit allocations and reviewed model/preview
   byte hashes. Mint a new `productVersionId` when any snapshot field or its
   reviewed asset evidence changes: draft-to-published promotion, text, snapshot
   dates, prices, allocations, quantities, identities and previews all count.
   The complete snapshot is immutable; only the separate `offer.sale` gate/window
   can change independently.
3. Run purchase → partial placement → reload → repeat purchase → expiry → owned
   placement/store/retrieve → refund/recycle with authorized release fixtures.
   Record account/garden switches, concurrent last-unit use and response-loss
   retries. Verify no extra placement charge and unchanged individual shopping.
4. Exercise the small/medium/dense seasonal and weather matrix across
   low/constrained/high, reduced motion, 2D fallback, hidden-tab suspension and
   cleanup. Include rotation, picking, supports, lids/gates and manual audio
   listening; record the exact source and environment for every result.
5. Run the existing production profiler on the clean final candidate using the
   commands below and compare with the applicable budgets. Measure physical
   mobile touch, audio, sustained frames and thermal behavior separately. Record
   device/browser/OS, reported DPR, backing size, quality, calls, triangles,
   frame/long-task metrics, durations and pass/fail. Do not substitute a small
   headless viewport for these observations.
6. Attach the final dated matrix, unresolved-failure disposition, deployment and
   live readback evidence before closing #4999/#5000 or enabling pilot sales.

From the repository root, the existing production profiler entry points are:

```sh
pnpm --filter garden run profile:game:cross-tier
pnpm --filter garden run profile:game:dense-mobile
pnpm --filter garden run profile:game:runtime-baselines
```

These build/start local production fixtures and store reports outside tracked
source. A generic dense profile is a baseline; add the chosen autumn launch
contents to the measured scene rather than claiming the baseline represents them.

If sales must be withdrawn, disable the sales gate or offer sale availability
while preserving owned access, receipt replay and prepaid lifecycle routes.
Keep purchased quantities, appearance and original paid/recycling allocations
unchanged. The storage gate is a schema-readiness control, not a sale-withdrawal
switch. See the [ordered rollout and rollback notes](garden-packs.md).
