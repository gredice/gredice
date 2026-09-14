# Fauna transition GPU investigation

Date: 2026-09-13. Issue: [#4802](https://github.com/gredice/gredice/issues/4802).
Integration: [#4777](https://github.com/gredice/gredice/pull/4777).

## Integration acceptance, 2026-09-15

The repaired #4777 integration passes a fresh, non-diagnostic contract-v6
comparison: **344/344 comparisons and 42/42 invariants**, across all four
baseline/candidate pairings. There are zero validation errors, reproduced
regressions, unresolved replications, or cadence-confounded comparisons. Eight
screening signals and 108 protocol-skipped metrics remain in the report. The
unchanged replication rule determines the result; individual GPU samples are
not uniformly faster.

This subject integrates main's per-Canvas frame and spring ownership with the
semantic scheduler. Only scheduler-admitted frames advance their root;
post-render receipts follow actual draws and are consumed once, including
manual preview capture. Building HUD identity also survives mode changes so
keyboard focus can return correctly. These are source changes from the
historical rejected integration, not repeated captures of that subject.

- Baseline: clean `fd41eb9c175162f531b918ea007412a19db63b0c`.
- Candidate: clean `1bd0d82bd30c400556b5ff68621ba756afa944b0`.
- Four independent 39-run production captures use clean frozen producer
  `f653a380ecb605654920ed24d86892225fdd10f2`. Both candidate batches pass all
  39 runs. Baselines fail only the five explicitly permitted legacy scheduler
  checks on their 30 cross-tier runs; their other nine runs pass.
- Headless Chromium 149.0.7827.55, ANGLE Metal on M4 Pro, Node 24.15.0,
  original five-second windows, screenshots, one server/profiler at a time,
  and command-scoped display-awake assertions. No external instrumentation,
  quality reduction, scene-content change, or threshold adjustment.
- The comparator is byte-identical to the existing PR version at
  `ced09ac7f252be88bad56044f0523a8c0bf453fe`. The older comparator bundled with
  the frozen producer rejects its own producer's cold/resource field inventory.
  That invalid attempt remains in `comparison`; the already-committed inventory
  correction validates the untouched captures in `comparison-current-validator`.
  No comparator code or threshold was changed for this repair.

| Capture | Fourth fauna arrival median GPU p95 |
| --- | ---: |
| baseline-1 | 19.93 ms |
| baseline-2 | 18.77 ms |
| candidate-1 | 21.35 ms |
| candidate-2 | 22.36 ms |

The current candidate also passes all **23/23** standalone acceptance runs:
static idle, live lifecycle, five owner policies, and matched building controls.
This acceptance bundle uses the clean candidate as both subject and harness,
including its current live-lifecycle acknowledgement checks. Validation also
passes 1,969 game units, 470 profiler/comparator tests, game/garden/www
typechecks, the production garden build, and complete
[CI run 34901092670](https://github.com/gredice/gredice/actions/runs/34901092670),
including WebGL component tests.

Raw reports, screenshots, the predeclared plan, logs, and a SHA-256 manifest are
retained under `apps/garden/.game-profile-results/4777-fix-2026-09-14/` in both
the repair worktree and `/Users/aleks/Documents/GitHub/gredice` so removing the
worktree does not discard them. The strict comparison JSON SHA-256 is
`d35946f03ac2cd7c26e83b859066dab4aaac815b27a3604399e96e644da97bcb`.
The directory date follows the UTC capture date; this acceptance note uses the
local date. Later changes in this PR record evidence and freeze the browser
test clock during exact cadence measurements; the measured runtime is unchanged.

This new integration satisfies the release gate that blocked #4777 and #4802.
It does not establish a native-driver explanation for the old measurements.
The historical failed comparison and inconclusive diagnostics below retain
their original meaning. Physical-device thermal clearance remains in #4344.

## Historical result, 2026-09-13

**Inconclusive; the optimization and release gate were blocked.** Twenty-one
fresh diagnostic runs did not establish a causal explanation or a verified
correction. No runtime change is proposed by this investigation. The two source
ablations were restored, and the diagnostic browser instrumentation was never
added to the application or canonical harness.

The historical non-diagnostic contract-v6 comparison remains **REGRESSION**:
343/344 comparisons and 42/42 invariants passed, but the fourth fauna arrival
failed the unchanged GPU gate in all four baseline/candidate pairings. Its
baseline GPU p95 medians were 19.70/19.04 ms and candidate medians were
23.91/30.18 ms. Its recorded SHA-256 is
`e4b3b8731919f2715097743fde9ec0616429396fd7cc4c51f3b75c5e445e2c13`.
These historical values and hash are transcribed from #4802; the old raw
`4800-release-v6` bundles were not found in the available local checkouts and
could not be revalidated. Their recorded failure remains valid for those
historical subjects; the acceptance above measures a different integration.

## Subjects and observation

- Baseline: clean current-main subject
  `af6e1b303ef0876bbbcc9798f9a6491c67a5c51d`.
- Integration control: clean
  `a8f0998b034e2f2f2588a95b57781a410620f017`, formed by merging that main into
  #4777's `ced09ac7f252be88bad56044f0523a8c0bf453fe`. This is a new subject,
  distinct from the historical rejected `9884d89ca` capture.
- Frozen harness: clean
  `f653a380ecb605654920ed24d86892225fdd10f2`, schema/comparison contract 6.
- Production builds; headless Chromium 149.0.7827.55; ANGLE Metal on Apple M4 Pro;
  macOS arm64; Node 24.15.0; pnpm 11.5.2. High quality, browser DPR 2,
  1280x720 CSS viewport and 2560x1440 backing buffer.
- Exact scenario: `game-garden-switch-high-fauna-single-context-desktop`, three
  fresh runs per experiment, seven arrivals per run. Original 5-second warmup
  and sample options, screenshots, one subject server and one profiler at a
  time, command-scoped `caffeinate -du`. No concurrent task-owned build, install,
  test, or second browser workload ran during captures. Other desktop apps were
  left untouched; this remains shared-workstation evidence.
- Every capture adds a CDP CPU sampling profile at a 1 ms sampling interval and
  JavaScript wrappers recording WebGL query CPU spans, selected method costs,
  and GPU query results. **This additional instrumentation makes every result
  diagnostic**, including reports whose ordinary provenance field says
  `comparable: true`. The frozen harness does not detect the external injector.

The baseline uses the harness's explicit legacy outline and renderer-stat
modes. The integration uses its canonical modes. The two source ablations have
honest `served-build-dirty` provenance, with their exact patches retained.

## Bounded experiments

The plan was written before the first capture. After the initial CPU/query
observations, a query-end flush control and two single-change source ablations
were selected. Both source ablations were negative. A second declared
experiment then applied the same pre-query synchronization intervention to
both restored subjects. There were no unchanged full release reruns.

Each row contains the three raw fourth-arrival GPU p95 measurements, followed
by their median. These are different fresh transitions, not paired identical
command replays or a symmetric release comparison.

| Diagnostic | Run 1 / 2 / 3 GPU p95 (ms) | Median (ms) |
| --- | --- | ---: |
| Main control | 18.42 / 19.76 / 19.35 | 19.35 |
| Integration control | 21.73 / 22.42 / 22.29 | 22.29 |
| Integration: `flush()` immediately after the existing `endQuery()` | 20.61 / 27.68 / 20.25 | 20.61 |
| Integration: bypass outline mask-cache hits | 23.19 / 21.63 / 25.08 | 23.19 |
| Integration: retain scheduler RAF wakeups after calibration | 22.65 / 24.23 / 21.10 | 22.65 |
| Main: `finish()` immediately before the existing `beginQuery()` | 21.19 / 20.38 / 18.99 | 20.38 |
| Integration: the same pre-query `finish()` | 17.72 / 22.14 / 19.80 | 19.80 |

The outline ablation makes `hoverOutlineMaskCacheSnapshotMatches` reject every
nonnegative registry version, retaining the original mask/distance rendering
and scene content. The scheduler ablation removes only the calibration
condition from its existing RAF wakeup branch. It deliberately violates the
zero-polling contract: fourth-arrival runs record 101/112/109 post-calibration
RAF wakeups and 49/55/57 unexpected no-work wakeups. It is not a viable fix.
The flush and finish interventions are applied only by the diagnostic injector.

The integration control has a lower measured CPU submission cost despite its
higher fourth-arrival GPU median. Across all instrumented queries in all seven
arrivals, baseline CPU span mean/p95 is 2.14/3.10 ms, versus 1.74/2.40 ms for
the integration. CPU tail after the last draw has a 0.10 ms p95 on both subjects.
Those CPU spans include instrumentation and do not measure GPU execution.

| Fourth-arrival context | Main control range | Integration control range |
| --- | ---: | ---: |
| Draws per rendered frame | 472.9–510.0 | 484.7–523.4 |
| Triangles per rendered frame | 70,341–73,550 | 72,602–73,443 |
| Rendered FPS over the short transition | 35.6–43.5 | 35.1–36.4 |
| Measured window (ms) | 1,509.2–1,543.3 | 1,444.7–1,596.1 |
| Long-task total (ms) | 0 | 0 |

All runs retain the same Canvas/context through the switches, the 117-stack /
147-block fauna fixture, and the two-Cow interaction. Dynamic actor exposure
and transition submission counts still vary; these controls do not establish
pixel-identical command workloads or equal physical GPU clock state.

Neither source ablation consistently improves the rejected metric. The
synchronization controls alter the measurements, but their overlapping results
do not isolate a production defect or prove that the historical failure was a
measurement artifact. There is no justification here for adding `flush()` or
`finish()` to the runtime, disabling the cache, restoring polling, relaxing a
threshold, or approving #4777.

## Retained evidence

New reports, screenshots, CPU profiles, raw query observations, source patches,
the evolving experiment plan, build/capture logs, summary, injector source
variants, and SHA-256 manifest are retained outside Playwright scratch at:

```text
/Users/aleks/.codex/worktrees/5952/gredice/apps/garden/.game-profile-results/4802-investigation/
```

The manifest covers 241 files. Earlier injector source variants are explicitly
marked as reconstructed from the recorded successive edits; raw reports,
screenshots, CPU profiles, and query observations are unchanged. The summary
is derived from raw per-run reports and is not replacement release evidence.

| Bundle directory | `latest.json` SHA-256 |
| --- | --- |
| `baseline-instrumented` | `149f2a7f70a712d852fbf4be661da73a11d1e070d81a4e7034998e056d5cac00` |
| `integration-instrumented` | `464c1c41adca5bd91ab7ef133873df141da18f6fcef5250d6d8f7be05250125b` |
| `query-flush-instrumented` | `f3e377c471f7779cab9256b2d1603cc4143a96d44240e0dd269238e0db793977` |
| `outline-uncached-instrumented` | `41e4e2bd23c20a0122e8c8ff38db3e9aa9b94ef5e803e374b4aec7e82c9de49a` |
| `scheduler-raf-instrumented` | `e2a5e4723b45bfea783a5739de10f1e635c43cc8feb55943d234c85bca14d84b` |
| `baseline-drained-instrumented` | `42918c4d6ec07ff34a55f14ae1e72b6b9c5ef66aa5a02424876b1e4d9f09c10c` |
| `integration-drained-instrumented` | `a22dc9c118c4b6229721cdadffb1981e5f4a2e9379798f10422a12d6d5ae0459` |

## Remaining acceptance at the end of the 2026-09-13 investigation

The baseline, integration, both temporary source ablations, and restored
integration production builds passed. The final change is documentation only;
`git diff --check` is its validation. No runtime correction, cause-specific
regression test, new game/garden/www compatibility sign-off, current integration
CI refresh, or canonical 2×2 release PASS is claimed.

Further investigation needs a bounded GPU command/encoder trace or deterministic
command replay to separate command work, driver scheduling, and GPU state.
`xcrun --find xctrace` failed on this host because `xctrace` is unavailable; a
native Metal trace was not collected. That limits this investigation, and does
not establish a cause. A corrected runtime still needs the tests and fresh
symmetric contract-v6 comparison required by #4802. At that point, #4777 was
kept draft and #4802 open. The subsequent integration acceptance is recorded
above. Physical-device High thermal clearance remains separate in #4344.
