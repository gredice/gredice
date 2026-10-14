# Game Scene Profile Report

Generated: 2026-10-03T23:31:55.500Z

Schema: 6
Comparison contract: 6
Source commit: 9facdce16b31cc0dfc237fed49706d428c4caf97
Comparable: yes
Comparability reasons: none
Served build: 9facdce16b31cc0dfc237fed49706d428c4caf97 (clean)
Profiler harness: 9facdce16b31cc0dfc237fed49706d428c4caf97 (clean)
Runtime: darwin/arm64, Node v24.15.0, Chromium 151.0.7922.34

Base URL: http://localhost:5495

Build: yes
Server: managed pnpm start
Scenario set: autumn-launch
Scenario filter: none
Warmup: 5000 ms
Soak: 0 ms
Sample: 5000 ms
Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36
GPU: Google Inc. (Apple) / ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)

Budget status: pass

| Scenario | Mode | Profile | Details | Controls | HUD | Debug HUD | Motion | Quality | Canvas | Shadow | Rain/Snow | Rain off | Overlays/Decor | Browser FPS | Rendered FPS | p95 | Max | Draw/frame | Draw/render | Triangles/frame | Triangles/render | Long tasks | Heap | Run diagnostic | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| game-autumn-launch-small-early-sun-low | baseline | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 3/2, rain 102/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 30 | 17.6 ms | 17.7 ms | 15 | 30 | 6220 | 12439 | 0 | 61 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-small-early-sun-low.png |
| game-autumn-launch-small-early-sun-constrained | baseline | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 2 (0 animated), invalidations 0, cloud 0 projected/0 real, attenuation 0px/0ms/0 updates/0 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/122, visible 103, pages 1, chunks 15, surface materials/uniforms snow 3/2, rain 102/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.8 | 29.9 | 17.6 ms | 17.7 ms | 23.5 | 47 | 6568 | 13136 | 0 | 68.9 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-small-early-sun-constrained.png |
| game-autumn-launch-small-early-sun-high | baseline | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 2 (0 animated), invalidations 0, cloud 0 projected/0 real, attenuation 0px/0ms/0 updates/0 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/244, visible 244, pages 1, chunks 16, surface materials/uniforms snow 3/2, rain 102/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30 | 17.2 ms | 17.7 ms | 102.5 | 205 | 21001 | 42001 | 0 | 64.8 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-small-early-sun-high.png |
| game-autumn-launch-medium-mid-cloud-low | cloudy | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 3/2, rain 298/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.9 | 17.3 ms | 17.7 ms | 11.5 | 23 | 624 | 1248 | 0 | 57.5 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-medium-mid-cloud-low.png |
| game-autumn-launch-medium-mid-cloud-constrained | cloudy | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 2 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 64px/240ms/40 updates/264 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/382, visible 60, pages 1, chunks 50, surface materials/uniforms snow 3/2, rain 298/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30 | 17.5 ms | 17.6 ms | 12.5 | 25 | 690 | 1380 | 0 | 104 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-medium-mid-cloud-constrained.png |
| game-autumn-launch-medium-mid-cloud-high | cloudy | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 2 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 192px/96ms/96 updates/268 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/662, visible 272, pages 1, chunks 52, surface materials/uniforms snow 3/2, rain 298/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30 | 17.6 ms | 17.7 ms | 40 | 80 | 9641 | 19282 | 0 | 68.9 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-medium-mid-cloud-high.png |
| game-autumn-launch-dense-late-wind-low | windy | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 3/2, rain 886/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 30 | 16.8 ms | 17.6 ms | 25.5 | 51 | 6164 | 12327 | 0 | 68.9 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-dense-late-wind-low.png |
| game-autumn-launch-dense-late-wind-constrained | windy | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 2 (0 animated), invalidations 0, cloud 7 projected/0 real, attenuation 64px/240ms/37 updates/382 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/1133, visible 191, pages 1, chunks 152, surface materials/uniforms snow 3/2, rain 886/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 30 | 17.2 ms | 17.7 ms | 26.5 | 53 | 6361 | 12721 | 0 | 82.4 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-dense-late-wind-constrained.png |
| game-autumn-launch-dense-late-wind-high | windy | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 2 (0 animated), invalidations 0, cloud 7 projected/0 real, attenuation 192px/96ms/97 updates/387 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/1891, visible 531, pages 1, chunks 156, surface materials/uniforms snow 3/2, rain 886/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.7 | 17.2 ms | 17.7 ms | 81.5 | 164 | 23609 | 47536 | 0 | 92.9 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-dense-late-wind-high.png |
| game-autumn-launch-medium-mid-rain-low | rain | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 700/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 3/2, rain 298/1; weather surface integrated, integrated 189 instances/3 materials/1 plugin variants, avoided 16 submissions/2268 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.7 | 17.2 ms | 17.6 ms | 11.9 | 24 | 1315 | 2648 | 0 | 68.9 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-medium-mid-rain-low.png |
| game-autumn-launch-medium-mid-rain-constrained | rain | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 2 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 64px/240ms/39 updates/266 materials | 1000/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/382, visible 60, pages 1, chunks 50, surface materials/uniforms snow 3/2, rain 298/1; weather surface integrated, integrated 189 instances/3 materials/1 plugin variants, avoided 16 submissions/2268 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 30 | 16.9 ms | 17.8 ms | 13 | 26 | 1690 | 3380 | 0 | 104 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-medium-mid-rain-constrained.png |
| game-autumn-launch-medium-mid-rain-high | rain | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 2 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 192px/96ms/102 updates/269 materials | 2000/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/662, visible 272, pages 1, chunks 52, surface materials/uniforms snow 3/2, rain 298/1; weather surface integrated, integrated 189 instances/3 materials/1 plugin variants, avoided 16 submissions/2268 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.9 | 17.1 ms | 17.6 ms | 58.5 | 117 | 18005 | 36010 | 0 | 73.1 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-medium-mid-rain-high.png |
| game-autumn-launch-dense-winter-snow-low | snow | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/1050 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 630+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 864/9, rain 868/1; weather surface integrated, integrated 567 instances/3 materials/1 plugin variants, avoided 45 submissions/24948 overlay-triangle proxy, fallback 52 submissions/20502 overlay-triangle proxy | 60 | 30 | 17.2 ms | 17.7 ms | 36.5 | 73 | 30810 | 61620 | 0 | 92.9 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-dense-winter-snow-low.png |
| game-autumn-launch-dense-winter-snow-constrained | snow | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 2 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 64px/240ms/38 updates/359 materials | 0/1575 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 630+0/1133, visible 191, pages 1, chunks 152, surface materials/uniforms snow 864/9, rain 868/1; weather surface integrated, integrated 567 instances/3 materials/1 plugin variants, avoided 45 submissions/24948 overlay-triangle proxy, fallback 52 submissions/20502 overlay-triangle proxy | 60 | 30.1 | 17.1 ms | 17.7 ms | 37.6 | 75 | 31637 | 63064 | 0 | 98.2 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-dense-winter-snow-constrained.png |
| game-autumn-launch-dense-winter-snow-high | snow | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 2 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 192px/96ms/97 updates/359 materials | 0/3500 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 630+0/1891, visible 531, pages 1, chunks 156, surface materials/uniforms snow 864/9, rain 868/1; weather surface integrated, integrated 567 instances/3 materials/1 plugin variants, avoided 45 submissions/24948 overlay-triangle proxy, fallback 52 submissions/20502 overlay-triangle proxy | 59.9 | 30 | 16.8 ms | 17.7 ms | 121.5 | 243 | 123897 | 247794 | 0 | 98.2 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-dense-winter-snow-high.png |
| game-autumn-launch-small-mid-night-low | night | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 3/2, rain 102/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30 | 17 ms | 17.6 ms | 34 | 68.1 | 6692 | 13385 | 0 | 54.2 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-small-mid-night-low.png |
| game-autumn-launch-small-mid-night-high | night | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 2 (0 animated), invalidations 0, cloud 0 projected/0 real, attenuation 0px/0ms/0 updates/0 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/244, visible 244, pages 1, chunks 16, surface materials/uniforms snow 3/2, rain 102/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30 | 17.3 ms | 17.7 ms | 91 | 182 | 20153 | 40305 | 0 | 57.5 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-small-mid-night-high.png |
| game-autumn-launch-dense-late-wind-constrained-reduced-motion | windy | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 2 (0 animated), invalidations 0, cloud 7 projected/0 real, attenuation 64px/320ms/32 updates/382 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/1133, visible 191, pages 1, chunks 152, surface materials/uniforms snow 3/2, rain 886/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30.1 | 17.3 ms | 17.7 ms | 26.6 | 53 | 6382 | 12721 | 0 | 87.5 MB | pass | /tmp/gredice-autumn-launch-9facdce16/screenshots/game-autumn-launch-dense-late-wind-constrained-reduced-motion.png |

## High-target Aggregate Failures

- None

## Per-run Diagnostic Failures

- None

## Console Warnings And Errors

### game-autumn-launch-small-early-sun-low

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-small-early-sun-constrained

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-small-early-sun-high

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-medium-mid-cloud-low

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-medium-mid-cloud-constrained

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-medium-mid-cloud-high

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-dense-late-wind-low

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-dense-late-wind-constrained

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-dense-late-wind-high

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-medium-mid-rain-low

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-medium-mid-rain-constrained

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-medium-mid-rain-high

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-dense-winter-snow-low

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-dense-winter-snow-constrained

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-dense-winter-snow-high

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-small-mid-night-low

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-small-mid-night-high

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

### game-autumn-launch-dense-late-wind-constrained-reduced-motion

- API error: 401 http://localhost:5495/api/gredice/api/directories/entities/operation
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5495/_next/static/chunks/323n7jrgmdrcm.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5495/api/gredice/api/directories/entities/operation)

