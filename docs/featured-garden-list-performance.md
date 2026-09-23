# Homepage featured garden list performance

## Follow-up: pre-header timeout after PR #4914 (23 September 2026)

The daily application review found two more homepage list timeouts at
15:00:48–49 UTC on 22 September, after the featured-ID route was deployed. Both
expired at 3,002–3,004 ms while waiting for API headers. Three other successful
requests spent 2,573–2,695 ms waiting for headers, while the API's
`featured-list` timer measured 399.5–441.1 ms. The response body took 1–5 ms.
The successful requests are not trace matches for the failures, so they locate
the missing measurement window but do not identify the exact failed operation.

The homepage calls `api.gredice.com` directly from WWW. The featured endpoint
was still inside `app/api/[...route]/route.ts`, which imports every API domain
before the featured handler starts its timer. The successful `x-vercel-id`
headers show requests entering through Frankfurt, Singapore, or Cleveland and
executing in Frankfurt. Region transit, function startup, and routing all fall
outside the handler timer. The saved evidence cannot apportion their time or
prove that the two failures reached the handler.

The endpoint now has an exact Next.js route backed by the same Hono handler and
storage ranking function. The production build resolves it separately from the
catch-all. In local build traces, the catch-all retained 303 files totaling
10,411,230 bytes; the dedicated route traced 267 files totaling 4,694,494
bytes. These totals include framework and shared files and are a bounded bundle
comparison, not a measurement of Vercel cold-start duration. Five read-only
GETs from the local machine through Frankfurt ingress to the current API took
210–329 ms to headers, of which the handler reported 118–235 ms. They did not
reproduce the cross-region tail.

WWW now sends a random UUID with the list request and includes it in its slow
or failed list log. The API logs that ID on handler entry and completion, with
duration but no garden, member, auth, or URL data. Future pre-header failures
can be matched to API logs: with complete logs, no entry points to delay before
this handler; an
entry without a timely completion points within it; a quick completion points
after it. The API accepts only UUID-shaped IDs for logging. WWW also records
`x-vercel-cache` on responses that reach it. A timeout before headers still has
no API response headers.

The endpoint remains `Cache-Control: no-store`; its list is fresh, and each
public detail independently rechecks visibility. The three-second list and
five-second shared detail deadlines, ranking, ten-detail cap, legacy-API 404
fallback, and partial-detail recovery remain in place. Local build and tests
cannot establish that production timeouts are eliminated. Verify with matched
WWW/API trace IDs and request timings after a separate release.

## Original PR #4914 investigation

Investigation date: 22 September 2026. Baseline: `db3d4cebb` (current
`origin/main` when work started). Source incident: issue 1 of the
`gredice-vercel-review` automation's 2026-09-22 report.

## Evidence and limits

Two production homepage requests exhausted the 3,000 ms list deadline. The
incident's nearby successful API requests were not trace matches, so they cannot
identify the cause. The timeout was not reproduced during this investigation.

Five sequential, uncached GETs to the deployed `/api/gardens/public`, from the
local Node 24 process, measured:

| Sample | Headers (ms) | Body (ms) | HTTP status |
| --- | ---: | ---: | ---: |
| 1 | 709 | 3 | 200 |
| 2 | 516 | 17 | 200 |
| 3 | 350 | 2 | 200 |
| 4 | 456 | 3 | 200 |
| 5 | 299 | 2 | 200 |

Every body contained 209 summaries and 180,723 decoded bytes; JSON parsing
rounded to 0 ms. All responses were Vercel cache MISSes through `fra1`. These
measure the local-to-API hop, not the original WWW-function-to-API hop or its
cold start. Existing responses had no Server-Timing header.

Storage profiling used the production read functions through the Neon driver,
with an unpooled connection enforcing `default_transaction_read_only=on`,
`statement_timeout=10000` and `lock_timeout=1000`. The read-only setting was
checked before reading application data. No SQL parameters, user data or
credentials were recorded. A pooled connection rejected the timeout startup
option before any application query; the direct connection was used to retain
the read-only and timeout guards.

The full list loaded 271 beds and 3,915 fields. Its path is:

1. Read all public, non-deleted gardens, then their previews and member profiles.
2. Read beds, then field events, weed state, photo operations, and planting/task
   hydration. Only the event-derived active field count is used in the summary.
3. Read likes and serialize all summaries; WWW sorts and keeps ten.

In the final three paired measurements, using the same database and process:

| Sample | Gardens/profiles/previews (ms) | Full bed hydration (ms) | Likes (ms) | Old total (ms) | Featured IDs (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 141 | 258 | 18 | 418 | 106 |
| 2 | 46 | 134 | 18 | 199 | 121 |
| 3 | 47 | 132 | 18 | 198 | 139 |

The new IDs matched both the old repository ranking and the deployed full-list
ranking. Earlier paired samples measured 97–122 ms for featured IDs versus
190–411 ms for full preparation. These are small, sequential samples with warm
connections, not production tail-latency or load-test claims.

The new Hono route returned HTTP 200, `Cache-Control: no-store`,
`Server-Timing: featured-list;dur=102.2`, and a 111-byte body. The actual WWW
loader, using that local route for the list and live public API detail reads,
completed in 720 ms with all ten gardens and their fresh owner profiles. This
does not verify a deployed new API/WWW pair or browser rendering.

## Fix and preserved behavior

`GET /api/gardens/public/featured` returns at most ten IDs. It first reads public,
non-deleted garden IDs and like counts, then counts plants only for candidates
whose likes can place them in the top ten. Ties at the cutoff are retained until
plant counts resolve them. It uses the existing field-event reducer, preserving
removal/reactivation semantics and the existing public list's field-count
definition; selected planting density does not replace that definition.

Ordering remains likes, active plants, then latest garden update. Garden ID is
a deterministic final tie-breaker. No previews, profiles, weeds, photos or
planting tasks are hydrated for this list. The existing full public list is
unchanged.

WWW preserves the independent 3,000 ms list and 5,000 ms shared detail deadlines,
including body reads, a maximum of ten parallel details, successful results
when individual details fail, and the existing empty fallback. List and detail
fetches explicitly bypass caching. Each detail rechecks current public/non-deleted
visibility and supplies its current first member as the owner. Owned-garden
priority and the carousel/canvas components are unchanged. If the featured route
returns 404 during a staggered API/WWW release, WWW uses the existing full list,
including its popularity ordering, with the same abort signal and remaining
list budget. Other list failures do not trigger another request.

Near-deadline list successes (at least 2,500 ms) record headers/body timing and
the API's Server-Timing and Vercel request ID. List failures distinguish waiting
for headers from reading the body. A request that times out before headers
cannot report an API request ID. This improves future diagnosis without claiming
the two original failures were caused by a particular database query.

## Validation

- 53 storage tests passed against a disposable local PostgreSQL database:
  `pnpm --filter @gredice/storage test:node featuredPublicGardens.node.spec.ts gardensRepo.node.spec.ts`.
- 9 API route/serialization tests passed:
  `pnpm --filter api exec node --import tsx --conditions=react-server --test lib/garden/featuredPublicGardensRoute.node.spec.ts lib/garden/publicGardenSerialization.node.spec.ts`.
- 23 WWW loader/carousel tests passed:
  `pnpm --filter www exec node --import tsx --conditions=react-server --test app/getLandingFeaturedGardens.node.spec.ts app/landingFeaturedGardens.node.spec.ts`.
- `pnpm --filter www typecheck` passed.
- `pnpm --filter api exec next typegen` and
  `pnpm --filter api exec tsc --noEmit --pretty false` passed.
- Changed TypeScript files pass Biome; `git diff --check` passes.
- The broad storage TypeScript command still reports 41 existing diagnostics in
  unrelated scripts/tests. An archived baseline with the same dependencies
  reproduces those diagnostics; this change adds none. API and WWW consumer
  checks cover the changed storage source.

Tests cover ranking across the tenth-place tie, likes taking precedence,
private/deleted exclusion, visibility changes between reads, absence of preview
and planting hydration, canonical plant lifecycle counts, exact list header/body
deadlines, ten-detail capping, HTTP/network/JSON failures, and partial detail
success, legacy-API compatibility, and legacy header/body reads sharing the
original list deadline. No UI layout changes required a browser regression run.

## Release boundary

The investigation performed no deployment, migration or production data change.
The bounded legacy-list fallback allows API and WWW to become ready in either
order. After release, verify API/WWW readiness together and observe list latency
and fallback frequency; these local results do not establish that all cold-start
or network timeouts are eliminated.
