# WWW featured-garden 403 investigation

Status on 2026-10-16: the rejecting layer remains unconfirmed. The local change
repairs missing request correlation and captures safe rejection metadata. It
does not establish a fix for the underlying production 403. Nothing was deployed
or changed in Vercel security configuration during this investigation.

## Existing work

The featured-garden latency/fallback PRs
[#4833](https://github.com/gredice/gredice/pull/4833),
[#4857](https://github.com/gredice/gredice/pull/4857),
[#4914](https://github.com/gredice/gredice/pull/4914), and
[#5009](https://github.com/gredice/gredice/pull/5009), and compact-summary PR
[#5093](https://github.com/gredice/gredice/pull/5093) are merged. Issue
[#5082](https://github.com/gredice/gredice/issues/5082) is closed. Searches of
issues and PRs for `featured` and `403`, plus the open PR list, found no ongoing
fix for this rejection.

## Correlated evidence

The featured finding in
`/Users/aleks/.codex/automations/gredice-vercel-review/runs/2026-10-16/report.json`
was checked against the live WWW request log and dashboard request details:

- Time: `2026-10-15T14:25:17.112Z`.
- WWW request: `8t582-1792074317112-09080bb04e1c`, `GET /`, HTTP 200,
  canonical host `www.gredice.com`.
- Deployment: `dpl_5ptq8x2qFhPythD6WGuqL2fM6TdZ`, production `main`, commit
  `ea1ab77e3e93ff271b631b489088192093bc6950`.
- WWW generated trace UUID: `bb4b532e-8c47-4160-8a3a-b60cf94b5a2e`.
- Upstream `x-vercel-id`:
  `fra1::1792074317-yAK4HcjG8sSiGqyMTyWYYxDmzRlfOyb9`.
- The loader logged HTTP 403 after 27 ms, with null `server-timing` and
  `x-vercel-cache`, then returned its empty result. The page selects
  `LandingGameScene` when that result is empty.

The same dashboard request lists these outgoing calls:

| Destination | Status | Dashboard duration |
| --- | --- | --- |
| `api.gredice.com/api/gardens/public/featured/summaries` | 403 | 26 ms |
| `api.gredice.com/api/outlet/offers` | 403 | 62 ms |
| `api.gredice.com/api/data/statistics/plants` | 403 | 59 ms |

This render therefore had a broader API-read failure. Its incoming user agent
identified itself as OAI-SearchBot; this observation does not establish human
impact or causation.

The saved API edge query for the summaries path during 14:20–14:30 UTC contains
three allowed HTTP 200s and no 403. Fresh API and team-wide queries for
14:24–14:27 UTC also contain no matching 403. API runtime search for the trace
UUID and the dashboard lookup for the upstream ID returned no records. Vercel's
trace lookup returned `trace_not_found` for the WWW request, whose logged OTEL
trace field is empty. The application UUID is a custom correlation header,
not an OTEL trace ID. These absences do not identify a WAF
rule, prove a protection failure, or prove that the API handler was never entered.

The summaries route was missing the trace logging already present on the older
featured-ID route. Consequently, even a successful summary request could not
be found using WWW's trace UUID. That is a confirmed diagnostic defect.

The loader and summaries route were unchanged between the affected commit and
the checked base, `83bf828c98bd7c6d971e7d67060e1f8043d46ee5`. The summaries
route is public and has no explicit 403 branch; repository failures propagate.
The API proxy matcher excludes this path. Current project settings protect
deployment hostnames but exempt custom domains. Those settings do not prove
the historical configuration or response origin.

A single anonymous canonical API probe on 2026-10-16 returned HTTP 200 with ten
summaries, API timing, and cache headers. This demonstrates current availability
from the probe's location, not recovery of the historical failing path.

## Prepared change and remaining acceptance

WWW retains its deadline, one public request, `no-store`, and empty fallback.
It now records the requested hostname, normalized content type, bounded
`x-vercel-error` code, recognized mitigation marker, redirect flag, and whether
the API echoed the request UUID. It does not read or log rejection bodies,
redirect locations, cookies, or challenge/bypass tokens.

The summaries handler logs entry, completion, and failure for valid UUIDs and
echoes the UUID on its response. Invalid trace values are ignored. The older
featured-ID route shares the same UUID parser. Failure logging excludes raw
repository errors, and the original error continues to the existing error
handler. Visibility checks, payload projection, HTTP caching, authentication,
and platform security controls are preserved.

Once these diagnostics are separately approved for deployment, correlate a
future rejection by its UUID and upstream request ID. Confirm trace echoing on
a successful request to the updated API before interpreting an absent echo.
Use the actual platform error/mitigation marker and API lifecycle logs to
identify ownership; an absent marker is still inconclusive. A provider-side
lookup of the historical upstream ID is another route to the missing evidence.
Do not introduce bypasses, broad allow rules, retries of authorization failures,
or cached previously public summaries as substitutes for that evidence.

## Local validation

- `pnpm --filter www test:landing-featured-gardens`: 17 tests passed.
- API featured-summary and featured-ID route tests: 10 tests passed.
- Landing carousel/rollout tests: 4 tests passed. Removed stale source-text
  assertions for the retired detail fan-out and its timeout; the behavioral
  loader tests verify the current request count, deadline, and `no-store` option.
- Targeted Biome checks, `git diff --check`, WWW typechecking, and API route
  type generation plus `tsc --noEmit --pretty false` passed.

The new correlation/diagnostic assertions failed before implementation and
passed afterward. They cover valid and invalid UUIDs, handler failures,
single-request 403 fallback, header redaction, and preserving an unread
rejection body. Existing tests retain timeout and compact public-payload coverage.
