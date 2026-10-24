# API PostHog log export investigation, 2026-10-24

## Evidence

The read-only Vercel review recorded 16 `PostHog log flush repeatedly failed`
warnings from 2026-10-23 19:31:46.441 UTC through 2026-10-24 11:16:46.487 UTC.
All were attributed to successful HTTP 200 `/api/internal/cron/work-dispatch`
requests. Each warning reported two consecutive failures, a 60-second backoff,
and `Fetch request errored` caused by `AbortError`. This demonstrates unreliable
telemetry delivery; it does not demonstrate a failed cron job.

The supplied evidence is the `gredice-vercel-review` automation's
`runs/2026-10-24/report.json` and its sibling `runtime-evidence.json` and
`deployed-source.txt` files. Those local evidence artifacts are outside this repo.
Read-only [deployment inspection](https://vercel.com/gredice/api/2ac86v7ZRAfhUZd8Ddc9rJx8qdA8)
confirmed production deployment `dpl_2ac86v7ZRAfhUZd8Ddc9rJx8qdA8` was READY
at Git revision `2b513827eba36d8dd4dc2ee21da3408efec75cb9`. Before this fix,
`apps/api/lib/posthog-server.ts`, `apps/api/instrumentation.ts`, and the shared
`packages/js/src/posthog-logs/index.ts` matched that revision.

A fresh read of the latest warning request
`q8jfl-1792840606391-db734e63f603` confirmed the same error chain. The 16 warning
timestamps are only 79–185 ms after the epoch-millisecond components in their
Vercel request IDs. This is consistent with exports/timers resuming from earlier
requests, rather than those requests completing two fresh five-second export
attempts. This timing comparison is supporting evidence, not a runtime trace.

## Findings and fix

- The deployed API constructed `/i/v1/logs` directly on its selected host,
  bypassing the existing shared `getPostHogLogsUrl` helper. A read-only check of
  current project configuration found `NEXT_PUBLIC_POSTHOG_HOST` set to
  `https://eu.posthog.com`, with neither higher-priority server nor UI override
  configured. The host entry's update timestamp predates the deployment; a
  frozen deployment environment snapshot was not retrieved. The wrapper thus
  selects the UI host under the observed configuration. It now uses the helper
  to select `https://eu.i.posthog.com/i/v1/logs`, as in Garden and WWW.
  [PostHog documents the regional ingestion endpoint](https://posthog.com/docs/logs/installation/nodejs).
  Explicit custom hosts and path prefixes remain supported by that helper.
- Console forwarding called the scheduler with `void`, but the API supplied no
  `registerBackgroundTask`. Its one-second collection timer and subsequent
  export could outlive an HTTP response without keeping the invocation alive.
  The request-error hook already registered its own flush, but successful cron
  requests do not invoke that hook. The API now supplies the existing scheduler
  with `waitUntil`, including for concurrent callers sharing a batch and logs
  arriving during an active export. This follows the existing Garden/WWW
  integration and [Vercel's background-task lifecycle contract](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).
- The installed OpenTelemetry fetch transport owns the `AbortController` timer
  that creates this error chain. The shared exporter already retries an abort
  once with the same batch. Its five-second attempt deadline, 12-second
  processor budget, 13-second provider budget, five-minute processor fallback,
  and scheduler backoff remain unchanged. The exporter retains failed results
  for the scheduler because the batch processor otherwise swallows them.
  Repeated failures still warn through the original console without recursively
  forwarding that warning. A successful flush resets reporting for a new outage.

The fix addresses two demonstrated wiring defects. It does not establish that
the host or lifecycle issue individually caused every historical abort. An
unauthenticated GET to each EU host's `/i/v1/logs` returned HTTP 405 within the
five-second deadline from the development machine. That checks local DNS/TLS
reachability only; it does not test authenticated ingestion or historical Vercel
network health. No diagnostic logs were written to PostHog.

## Validation and remaining acceptance

The API integration mocks fetch while exercising the real wrapper, error hook,
OTLP serializer/exporter, batch processor, scheduler, and Vercel request-context
registration. It covers regional host selection with the observed production
configuration shape, nonblocking hooks, batched console errors, logs emitted
during export, one retry per abort, backoff, persistent warning visibility
without recursion, and renewed reporting after recovery. Existing shared tests
cover actual fetch deadlines, retry payload preservation, custom hosts, and
backoff limits.

Run the API integration command in [observability.md](./observability.md),
`pnpm --filter @gredice/js test`, and `pnpm --filter garden test:posthog`.

Local validation passed the API integration, all 201 shared JavaScript tests,
the Garden lifecycle integration, focused Biome checks, and `git diff --check`.
API route generation (`pnpm --filter api exec next typegen`) and TypeScript
(`pnpm --filter api exec tsc --noEmit --pretty false`) also passed.
A broader `pnpm --filter @gredice/js exec tsc --noEmit --pretty false` check
fails on existing package errors, including its ES2022 library configuration
not covering `Promise.withResolvers` in the unchanged exporter tests, as well
as unrelated achievement/plant tests. No shared package source was changed.

The investigation made no telemetry writes or production setting changes.
Runtime acceptance requires a separately authorized release,
verification that a known warning reaches PostHog, and a representative log
review for repeated export failures. Successful mocked tests do not establish
production ingestion health or recovery of logs already lost from memory.
