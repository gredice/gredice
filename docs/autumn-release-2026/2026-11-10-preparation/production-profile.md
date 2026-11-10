# Game Scene Profile Report

Generated: 2026-11-10T02:11:33.611Z

Schema: 6
Comparison contract: 6
Source commit: 2e02348ca21c18518ebade352d34eebb28e6fe4a
Comparable: yes
Comparability reasons: none
Served build: 2e02348ca21c18518ebade352d34eebb28e6fe4a (clean)
Profiler harness: 2e02348ca21c18518ebade352d34eebb28e6fe4a (clean)
Runtime: darwin/arm64, Node v26.13.0, Chromium 151.0.7922.34

Base URL: http://localhost:5497

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
| game-autumn-launch-small-early-sun-low | baseline | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 1/1, rain 100/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30 | 18.2 ms | 18.7 ms | 38.5 | 77 | 9641 | 19281 | 0 | 57.5 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-small-early-sun-low.png |
| game-autumn-launch-small-early-sun-constrained | baseline | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 3 (0 animated), invalidations 0, cloud 0 projected/0 real, attenuation 0px/0ms/0 updates/0 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/122, visible 97, pages 1, chunks 16, surface materials/uniforms snow 1/1, rain 100/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 30 | 18.2 ms | 18.6 ms | 39.5 | 79 | 9747 | 19493 | 0 | 48.1 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-small-early-sun-constrained.png |
| game-autumn-launch-small-early-sun-high | baseline | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 3 (0 animated), invalidations 0, cloud 0 projected/0 real, attenuation 0px/0ms/0 updates/0 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/244, visible 244, pages 1, chunks 17, surface materials/uniforms snow 1/1, rain 100/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30.1 | 18.3 ms | 18.6 ms | 86.8 | 173 | 23251 | 46349 | 0 | 48.1 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-small-early-sun-high.png |
| game-autumn-launch-medium-mid-cloud-low | cloudy | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 1/1, rain 296/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.9 | 18.4 ms | 18.7 ms | 35 | 70 | 10119 | 20237 | 0 | 54.2 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-medium-mid-cloud-low.png |
| game-autumn-launch-medium-mid-cloud-constrained | cloudy | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 3 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 64px/240ms/40 updates/264 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/382, visible 152, pages 1, chunks 49, surface materials/uniforms snow 1/1, rain 296/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.9 | 18.3 ms | 18.6 ms | 36 | 72 | 10277 | 20553 | 0 | 68.9 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-medium-mid-cloud-constrained.png |
| game-autumn-launch-medium-mid-cloud-high | cloudy | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 3 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 192px/96ms/103 updates/268 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/662, visible 465, pages 1, chunks 50, surface materials/uniforms snow 1/1, rain 296/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 30 | 18.4 ms | 18.7 ms | 91 | 181.9 | 25895 | 51789 | 0 | 57.5 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-medium-mid-cloud-high.png |
| game-autumn-launch-dense-late-wind-low | windy | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 1/1, rain 884/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.8 | 29.9 | 18.4 ms | 18.7 ms | 35 | 70 | 8715 | 17429 | 0 | 73.1 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-dense-late-wind-low.png |
| game-autumn-launch-dense-late-wind-constrained | windy | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 3 (0 animated), invalidations 0, cloud 7 projected/0 real, attenuation 64px/240ms/37 updates/383 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/1133, visible 169, pages 1, chunks 147, surface materials/uniforms snow 1/1, rain 884/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.9 | 18.3 ms | 18.7 ms | 36 | 72 | 9112 | 18223 | 0 | 77.6 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-dense-late-wind-constrained.png |
| game-autumn-launch-dense-late-wind-high | windy | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 3 (0 animated), invalidations 0, cloud 7 projected/0 real, attenuation 192px/96ms/96 updates/388 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/1891, visible 627, pages 1, chunks 148, surface materials/uniforms snow 1/1, rain 884/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 29.9 | 18.3 ms | 18.6 ms | 82.7 | 166 | 24750 | 49665 | 0 | 92.9 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-dense-late-wind-high.png |
| game-autumn-launch-medium-mid-rain-low | rain | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 700/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 1/1, rain 296/1; weather surface integrated, integrated 189 instances/1 materials/1 plugin variants, avoided 12 submissions/2268 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.9 | 18.4 ms | 18.6 ms | 68 | 136 | 18205 | 36410 | 0 | 68.9 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-medium-mid-rain-low.png |
| game-autumn-launch-medium-mid-rain-constrained | rain | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 3 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 64px/240ms/39 updates/264 materials | 1000/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/382, visible 152, pages 1, chunks 49, surface materials/uniforms snow 1/1, rain 296/1; weather surface integrated, integrated 189 instances/1 materials/1 plugin variants, avoided 12 submissions/2268 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 30 | 18.3 ms | 18.7 ms | 69 | 138 | 18663 | 37326 | 0 | 61 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-medium-mid-rain-constrained.png |
| game-autumn-launch-medium-mid-rain-high | rain | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 3 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 192px/96ms/101 updates/267 materials | 2000/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/662, visible 465, pages 1, chunks 50, surface materials/uniforms snow 1/1, rain 296/1; weather surface integrated, integrated 189 instances/1 materials/1 plugin variants, avoided 12 submissions/2268 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 60 | 29.9 | 18.4 ms | 18.6 ms | 138 | 277 | 47403 | 95122 | 0 | 77.6 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-medium-mid-rain-high.png |
| game-autumn-launch-dense-winter-snow-low | snow | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/1050 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 630+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 862/9, rain 866/1; weather surface integrated, integrated 567 instances/1 materials/1 plugin variants, avoided 48 submissions/24948 overlay-triangle proxy, fallback 51 submissions/20502 overlay-triangle proxy | 59.8 | 29.9 | 18.3 ms | 18.6 ms | 52.5 | 105 | 43762 | 87524 | 0 | 98.2 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-dense-winter-snow-low.png |
| game-autumn-launch-dense-winter-snow-constrained | snow | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 3 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 64px/240ms/37 updates/358 materials | 0/1575 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 630+0/1133, visible 169, pages 1, chunks 147, surface materials/uniforms snow 862/9, rain 866/1; weather surface integrated, integrated 567 instances/1 materials/1 plugin variants, avoided 48 submissions/24948 overlay-triangle proxy, fallback 51 submissions/20502 overlay-triangle proxy | 60 | 30 | 18.5 ms | 18.7 ms | 53.5 | 107 | 44462 | 88924 | 0 | 110.6 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-dense-winter-snow-constrained.png |
| game-autumn-launch-dense-winter-snow-high | snow | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 3 (0 animated), invalidations 0, cloud 8 projected/0 real, attenuation 192px/96ms/96 updates/358 materials | 0/3500 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 630+0/1891, visible 627, pages 1, chunks 148, surface materials/uniforms snow 862/9, rain 866/1; weather surface integrated, integrated 567 instances/1 materials/1 plugin variants, avoided 48 submissions/24948 overlay-triangle proxy, fallback 51 submissions/20502 overlay-triangle proxy | 60 | 30 | 18.3 ms | 18.7 ms | 125 | 250 | 124559 | 249118 | 0 | 92.9 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-dense-winter-snow-high.png |
| game-autumn-launch-small-mid-night-low | night | default | 1 | 0 | 0 | 0 | none | low | 390x844 | off | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/0, visible n/a, pages n/a, chunks n/a, surface materials/uniforms snow 1/1, rain 100/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.8 | 29.9 | 18.3 ms | 18.7 ms | 43.5 | 87 | 9526 | 19052 | 0 | 61 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-small-mid-night-low.png |
| game-autumn-launch-small-mid-night-high | night | default | 1 | 0 | 0 | 0 | none | high | 2880x2000 | 4096px, cached, refreshes 3 (0 animated), invalidations 0, cloud 0 projected/0 real, attenuation 0px/0ms/0 updates/0 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/244, visible 244, pages 1, chunks 17, surface materials/uniforms snow 1/1, rain 100/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 29.9 | 18.3 ms | 18.6 ms | 113 | 226 | 23651 | 47301 | 0 | 51 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-small-mid-night-high.png |
| game-autumn-launch-dense-late-wind-constrained-reduced-motion | windy | default | 1 | 0 | 0 | 0 | none | auto-constrained | 390x844 | 1024px, cached, refreshes 3 (0 animated), invalidations 0, cloud 7 projected/0 real, attenuation 64px/320ms/30 updates/383 materials | 0/0 | n/a | field visuals 0 instances/0 objects/0 batches/0 chunks, uploads 0/0; mulch 0 instances/0 objects/0 batches/0 groups; snow/decor 0+0/1133, visible 169, pages 1, chunks 147, surface materials/uniforms snow 1/1, rain 884/1; weather surface integrated, integrated 0 instances/0 materials/0 plugin variants, avoided 0 submissions/0 overlay-triangle proxy, fallback 0 submissions/0 overlay-triangle proxy | 59.9 | 30 | 18.3 ms | 18.7 ms | 36 | 72 | 9111 | 18221 | 0 | 77.6 MB | pass | /tmp/gredice-autumn-20261110-YI0WJE/production-profile-final/screenshots/game-autumn-launch-dense-late-wind-constrained-reduced-motion.png |

## High-target Aggregate Failures

- None

## Per-run Diagnostic Failures

- None

## Console Warnings And Errors

### game-autumn-launch-small-early-sun-low

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-small-early-sun-constrained

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-small-early-sun-high

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-medium-mid-cloud-low

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-medium-mid-cloud-constrained

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-medium-mid-cloud-high

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-dense-late-wind-low

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-dense-late-wind-constrained

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-dense-late-wind-high

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-medium-mid-rain-low

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-medium-mid-rain-constrained

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-medium-mid-rain-high

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-dense-winter-snow-low

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-dense-winter-snow-constrained

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-dense-winter-snow-high

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-small-mid-night-low

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-small-mid-night-high

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)

### game-autumn-launch-dense-late-wind-constrained-reduced-motion

- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/exception-autocapture.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/1.445.6/tracing-headers.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config.js)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/exception-autocapture.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/static/tracing-headers.js?v=1.445.6)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/array/phc_maoFkdSCXyn6AeqebUjwqH8BcQjNTphUHRtz4xaoTUYA/config)
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized) (http://localhost:5497/ingest/flags/?v=2&compression=base64)
- warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead. (http://localhost:5497/_next/static/chunks/3bsaq7dw4g4iu.js)
