# Universal game runtime performance closeout

The software delivery and integrated acceptance work in [#4715](https://github.com/gredice/gredice/issues/4715)
is complete. All 24 delivery children are closed. Fauna acceptance merged through
[PR #5564](https://github.com/gredice/gredice/pull/5564) as
`2e8bfa18a2ccc83cb0b2bcf8817e53e305f9f942`; material/native-instancing acceptance
merged through [PR #5567](https://github.com/gredice/gredice/pull/5567) as
`ebd39bd48fb0a51736ba3458563647a8999897ac`. Game/Garden/JS sources in the latter
merge match the measured candidate. The intervening API-only `@hono/mcp` update
changes no Garden runtime or profiling source.

## Delivery dependencies

The issue retains the detailed chronological dependency order and rejected-run
history. These groups account for every delivery child:

| Work | Dependencies and result |
| --- | --- |
| [#4716](https://github.com/gredice/gredice/issues/4716) comparison baseline | Established the unchanged canonical comparison contract. |
| [#4766](https://github.com/gredice/gredice/issues/4766), [#4800](https://github.com/gredice/gredice/issues/4800) root isolation/recovery | Follow the baseline; provide independent root demand and context recovery. |
| [#4778](https://github.com/gredice/gredice/issues/4778) → [#4776](https://github.com/gredice/gredice/issues/4776) → [#4775](https://github.com/gredice/gredice/issues/4775) evidence and gates | Establish retained artifacts, fixture-aware resources and cadence/lifetime comparisons before runtime acceptance. |
| [#4773](https://github.com/gredice/gredice/issues/4773), [#4717](https://github.com/gredice/gredice/issues/4717), [#4802](https://github.com/gredice/gredice/issues/4802) outline/scheduler | Follow the root and gate foundations; retain the corrected GPU regression clearance. |
| [#4718](https://github.com/gredice/gredice/issues/4718) → [#4719](https://github.com/gredice/gredice/issues/4719) spatial/compiler | Shared spatial queries precede retained scene compilation. |
| [#5149](https://github.com/gredice/gredice/issues/5149) → [#5161](https://github.com/gredice/gredice/issues/5161) metadata/packet planning | Metadata follows spatial queries; affected-group planning follows the compiler, initial material source and shared metadata. |
| [#4720](https://github.com/gredice/gredice/issues/4720), [#5140](https://github.com/gredice/gredice/issues/5140) fauna | Follow runtime/spatial foundations; late-reveal repair and original-runtime/integrated acceptance complete in #5564. |
| [#4721](https://github.com/gredice/gredice/issues/4721), [#5141](https://github.com/gredice/gredice/issues/5141), [#5147](https://github.com/gredice/gredice/issues/5147) materials | Follow the compiler; native program reuse, resident ownership and final packet/reporting acceptance complete in #5567. |
| [#4722](https://github.com/gredice/gredice/issues/4722) scene resources | Follows scene compilation; cold, replacement, lifecycle and retained-resource gates remain in the final matrix. |
| [#5067](https://github.com/gredice/gredice/issues/5067) preparation/allocation | Follows the compiler; PRs #5115/#5552 provide the repair and matched natural preparation/allocation evidence. |
| [#5125](https://github.com/gredice/gredice/issues/5125) camera cadence | Follows owned runtime demand; PRs #5127/#5563 provide correction and focused acceptance. |
| [#4723](https://github.com/gredice/gredice/issues/4723) layered caching | Follows material and resource ownership; PR #5545 and final native integration retain measured benefit and bounded resources. |
| [#4772](https://github.com/gredice/gredice/issues/4772), [#5068](https://github.com/gredice/gredice/issues/5068) rejected experiments | Kernel specialization follows the baseline; source residency follows the compiler. Both were measured and rejected without production merge. |

## Final evidence

- Fauna: the complete native symmetric 2x2 comparison passes 344 metrics and 42
  invariants. Original-runtime trajectory parity covers all 17 species with
  40,934 actor samples, 257 decisions and 1,286,523 joint samples across
  day/night/autumn-post-rain, 30/60 Hz and 24-second trajectories. See
  [fauna runtime details](game-fauna-world.md).
- Materials: four independent complete 39-run bundles pass all 344 metrics and 42
  invariants, with zero screening, reproduced or unresolved failures. The
  candidate is `a31175bfdbfd9c1d23810e993d8b2b3853b5a68c`; its authored-material
  control is `ecadc8ff576fd274598051dfac5f7f1811d9ea73`. Only the packet provider
  differs. Common rigid fauna and corrected shadow membership retain the same
  simulation/rendering clocks. Steady submissions fall by about nine draws per
  frame in every resolved profile; fauna-heavy draws fall from 589 to 564.
- Live rain/camera: all 30 native producer/cadence runs pass with unchanged
  inventory/settings and minimum 30/60 fps delivery ratios of 0.995/0.945.
  Submitted-draw medians are lower in every profile. These descriptive work
  observations accompany the complete canonical relative clearance.
- Cache: all 19 native integration runs pass, including cached depth on all five
  profiles, three High lifecycle/context-restoration runs, a 60-second resource
  warmup plus 60-second flat soak, and five cloudy image/GPU pairs. Paired GPU
  median/worst ratios are 0.3974/0.4642; geometry, shader and texture growth during
  the soak is zero.
- Source validation: 2,399 Game units, seven consumer type tasks, 39 material
  WebGL cases, production builds and final-head required CI pass. The new
  submitted-buffer regression fails before the membership-reporting correction
  and passes afterward while motion statistics remain throttled.

[Material acceptance details](game-static-render-packets.md) contain per-profile
native draw medians, cloudy GPU/image results, environment qualification and
unavailable-metric limits. Canonical source, quality, clocks, five-second windows,
thresholds and scene content remain unchanged. Nine metric/phase groups remain
unavailable, recorded as 108 raw skip entries.

## Retained limits and rejections

Earlier material cohorts, invalid build-marker attempts, the isolated control
resource-plateau event, the initial CI failure, original callback classification
failure, rejected primary-shadow prototype and CT oracle-cache failure remain
retained. A sleeping 60 Hz display caused all 15 original supplemental control
runs to fail their 60 fps delivery gate at an observed 50 Hz; a verified real
wake restored native 60 Hz before the separately declared passing cohort. The
runtime-owner schema is unsupported by the generic comparative CLI; its invalid
diagnostic is preserved, and independent checks use its original inventory fields.
The canonical comparison provides relative CPU/GPU clearance.

The independently verified evidence archive is
`issue-4715-performance-evidence-2026-11-02.tar.gz`, SHA-256
`6ce375334a817c8a1b729ac2c56ac7426e0a42899840bc724afd32f0869aec9e`.
All 4,471 regular/hard-linked entries match their source manifest. Merge readback
is retained separately from the sealed pre-merge evidence.

Physical-device High thermal clearance remains open in
[#4344](https://github.com/gredice/gredice/issues/4344). Local native rendering,
CI, preview, merge and production deployment are separate facts; this closeout
makes no physical-device, thermal or production runtime verification claim.
