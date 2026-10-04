# Selected autumn launch production profiling (#4999)

`profile:game:autumn-launch` is a local production-build QA tool for the selected
A/B launch. It renders the 24 first-wave identities from #4948–#4959 (16 model
GLBs across 12 families) plus the two legacy starter-recipe props StoneMedium
and EnamelGardenLamp. It preserves the exact three authored starter layouts;
the other first-wave identities are separate render-only props. These sandbox
rows and quantities are not a sale catalogue or an ownership/charge test.
Optional C/later effects and products are outside this fixture's content scope.

Small, medium and dense fixtures repeat the full set 1, 3 and 9 times:

| Size | Ground stacks | Total blocks | First-wave props | Pilot included props | Legacy props |
| --- | ---: | ---: | ---: | ---: | ---: |
| small | 63 | 104 | 24 | 12 | 2 |
| medium | 189 | 312 | 72 | 36 | 6 |
| dense | 567 | 936 | 216 | 108 | 18 |

Pilot counts overlap first-wave/legacy counts; they must not be added together.
Every fixture records exact per-name counts, IDs, quarter-turns and null/static
appearance. Existing local sandbox metadata and scene rendering resolve the
models. Before sampling, the profiler requires the scene's runtime garden-data stack and
per-name block census to match the fixture, so a missing/wrong dataset cannot
silently pass as a lighter scene. Multi-cell wheelbarrow ground support is
included; the original log/bench supports and rotations stay authored.

The 18-case matrix covers small/medium/dense at low, constrained auto and high;
early clear sun, mid-autumn cloud/rain, late wind, winter snow, two night cases,
and constrained dense reduced motion. Constrained auto uses synthetic four-core,
4-GB navigator metrics and a touch/mobile viewport; it is not a real phone.
A populated central repeat is shared by all density cases. The ordinary normal
camera and frustum remain active, so fixture/runtime-data population is distinct
from mounted or visible geometry; the screenshots do not claim every identity is simultaneously in frame.
A launch-only lower scene-geometry witness rejects sky-only views even when the
generic nonblank image/upper performance budgets pass. Each scenario pins the
Europe/Zagreb browser timezone. Sound, avatar, HUD and
controls stay off to isolate the scene workload. Existing automatic quality,
shadows, DPR, particles, foliage and scheduler policies remain active.

```bash
# Commit all capture/profile inputs first; use an unused loopback port.
GAME_PROFILE_BASE_URL=http://localhost:5495 \
  GREDICE_API_HOST=http://127.0.0.1:9 \
  GAME_PROFILE_OUT_DIR=/tmp/gredice-autumn-launch-profile \
  pnpm --filter garden run profile:game:autumn-launch
```

The command builds and serves the production app, takes nonblank screenshot
witnesses and records existing draw/triangle/DPR/frame/long-task/resource metrics.
Launch browser requests are limited to the local app; auth/data/analytics are
synthetically denied and no live domain data is read or written. The existing
`gameDenseWeather`/`gameDenseWeatherMobile` budgets and comparability contract are
unchanged. Budget failures must remain failures; software rendering or an
emulated viewport cannot justify raising thresholds or declaring mobile ready.

A clean source commit/tree, actual build/report provenance, content census,
measurement settings, graphics backend and individual pass/fail results must be
recorded alongside each report. Run evidence belongs under
`docs/autumn-release-2026/` after the measurements complete. No historical image
approval or static capture is relabelled as a performance measurement.

Physical-mobile usability, thermal observations, listening/audio mixing, 2D
fallback, interaction/cleanup and the bundle economy matrix remain separate
#4999 acceptance work. This tooling and a headless production run do not close
those gates or authorize campaign/catalogue publication.

The [2026-10-04 local production readback](./autumn-release-2026/2026-10-04-launch-profile/README.md) archives a corrected 18-case pass plus the rejected sky-only first run. It retains the standard-camera visible-subset limitation and physical-device gates.
