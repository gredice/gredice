# Local production measurement readback — 2026-10-04

The corrected clean `22e48526d2b5f7e03386cb6540733386296c92db` production build passed **18/18** cases with unchanged `gameDenseWeather` / `gameDenseWeatherMobile` budgets and the comparability gate. Tree `5e3bcb19b148f0ffbc767c2a4cad426082c53050` had an empty status at measurement start. Warmup and sampling were 5 seconds each, one run per case. Managed server 5495 exited normally after the run.

Native graphics used `angle-metal` on Apple M4 Pro, macOS arm64, Node 24.15.0 and Headless Chromium 151.0.7922.34. Constrained auto is a synthetic navigator 4-core/4-GB policy input, not a physical device. Mobile viewport 390×844/browser DPR 3 resolved low/auto-constrained at effective DPR 1 and backing 390×844; high viewport 1440×1000/browser DPR 2 used effective DPR 2 and backing 2880×2000. Europe/Zagreb was explicit. No measured long tasks in any case.

Runtime garden-data census matched exact 24 first-wave identities plus 2 legacy identities in every repeat: 63/104, 189/312, 567/936 stacks/blocks at small/medium/dense. This does **not** prove all 24 GLB meshes mounted or submitted. Normal frustum cuts outer props/recipes at edges. Densities show essentially the same central subset; increases total garden-data/offscreen population, not nine complete repeats simultaneously rendered. Not worst-case densely packed on-screen GPU coverage or product-art framing. Existing ambient scene behavior remains enabled; this is a combined scene workload, not isolated model cost.

Astra xhigh independently inspected six corrected desktop/mobile images and approved a real ground/identifiable-prop visual witness, including the previously sky-only medium mobile view. This is a profiling witness, not product-art or new asset approval. The other 12 images retain automated nonblank witnesses. Every launch sample also passed the ordinary sampling-path lower geometry floor of 5,000 triangles/rendered frame.

| Scenario | Resolved quality | DPR | RAF / rendered FPS | p95 / max frame ms | Draws/render | Triangles/render | GPU p95 ms | JS heap MB | Budget |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| small-early-sun-low | low | 1 | 59.8 / 30.1 | 18.3 / 18.6 | 77 | 19281 | 2.15 | 57.5 | pass |
| small-early-sun-constrained | auto-constrained | 1 | 59.9 / 30 | 18.2 / 18.7 | 79 | 19493 | 2.33 | 92.9 | pass |
| small-early-sun-high | high | 2 | 59.9 / 30 | 18 / 18.6 | 173 | 46349 | 18.03 | 82.4 | pass |
| medium-mid-cloud-low | low | 1 | 60 / 30 | 18.3 / 18.6 | 70 | 20237 | 2.26 | 61 | pass |
| medium-mid-cloud-constrained | auto-constrained | 1 | 59.9 / 30 | 18.3 / 18.7 | 72 | 20553 | 2.35 | 104 | pass |
| medium-mid-cloud-high | high | 2 | 59.9 / 29.7 | 18.2 / 18.7 | 181.9 | 51790 | 18.47 | 77.6 | pass |
| dense-late-wind-low | low | 1 | 59.8 / 29.9 | 18.3 / 18.7 | 70 | 17429 | 2.29 | 68.9 | pass |
| dense-late-wind-constrained | auto-constrained | 1 | 59.8 / 29.9 | 18.3 / 18.6 | 72 | 18223 | 2.36 | 87.5 | pass |
| dense-late-wind-high | high | 2 | 60 / 29.9 | 17.9 / 18.5 | 166 | 49665 | 19.2 | 98.2 | pass |
| medium-mid-rain-low | low | 1 | 60 / 30 | 18.4 / 18.7 | 136 | 36410 | 2.32 | 73.1 | pass |
| medium-mid-rain-constrained | auto-constrained | 1 | 60 / 30 | 18.3 / 18.7 | 138 | 37326 | 2.5 | 64.8 | pass |
| medium-mid-rain-high | high | 2 | 60 / 30.1 | 18.2 / 18.8 | 277 | 95122 | 18.91 | 77.6 | pass |
| dense-winter-snow-low | low | 1 | 60 / 29.9 | 17.9 / 18.7 | 105 | 87524 | 0.79 | 92.9 | pass |
| dense-winter-snow-constrained | auto-constrained | 1 | 60 / 30 | 17.9 / 18.5 | 107 | 88924 | 0.9 | 117.3 | pass |
| dense-winter-snow-high | high | 2 | 59.9 / 30 | 18 / 18.7 | 250 | 249118 | 8.54 | 189.8 | pass |
| small-mid-night-low | low | 1 | 59.9 / 29.9 | 18.1 / 18.7 | 84.5 | 19004 | 2.22 | 64.8 | pass |
| small-mid-night-high | high | 2 | 59.9 / 30 | 18.1 / 18.6 | 226 | 47301 | 18.64 | 61 | pass |
| dense-late-wind-constrained-reduced-motion | auto-constrained | 1 | 60 / 29.9 | 18.1 / 18.6 | 72 | 18221 | 2.46 | 87.5 | pass |

Frame p95/max describe RAF sample intervals; rendered FPS and draw/triangle denominators describe actual rendered frames. GPU timestamps are local native diagnostic measurements, not a physical mobile or thermal result. Raw JSON retains existing budget formulas and observer telemetry; no thresholds or comparability fields were weakened.

The prior clean 9fac run is archived under `rejected-sky-only/` as rejected diagnostic evidence. Its medium mobile images contained only sky: 1,248/1,380 triangles per rendered frame and 23/25 draws. Its 18 passing generic budgets must not be interpreted as launch acceptance. The central-repeat regression and pure normal-path geometry validator now reject this case; these repairs preceded the corrected clean build.

Focused checks: 2 deterministic fixture tests and 135 profiler units passed; production build and 18 scenario measurements passed. The normal post-build `pnpm --filter garden typecheck` produced a stale incremental-cache diagnostic for `/staza-bundeva`. Root confirmed `pnpm --filter garden exec tsc --noEmit --incremental false` passed with no source edits or casts. Both logs and exact commands are archived in [validation.json](./validation.json); this is not a source typing failure.

Physical devices/thermal, worst-case simultaneous dense on-screen geometry, audio/listening, 2D fallback, interaction/cleanup, economy/recovery and actual catalogue/configuration/deployment readback remain open. No live services, domain writes or publication were exercised.

See [manifest.json](./manifest.json) for SHA256 of the untouched raw JSON/Markdown/logs and all 18 corrected screenshots plus the rejected medium witness. Raw reports preserve their original temporary output paths; these archived copies are byte-identical. The six reviewed images are listed explicitly.
