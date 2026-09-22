# Observability event budget

Vercel records separate Observability events for the request, Proxy, Function,
and outgoing API stages of one product action. Gredice keeps those layers when
they provide required routing, authentication, or operational reliability and
avoids producing additional telemetry about routine telemetry.

## Vercel Web Analytics

The app layouts render `@vercel/analytics` only when `VERCEL=1`. Local and CI
production builds therefore do not request Vercel's reserved
`/_vercel/insights/*` resources. The WWW CMS catch-all also reserves the
`_vercel` first segment, so a missing platform resource can never become a CMS
directory API lookup.

Proxy matchers exclude `/_vercel/*`. Vercel serves those platform resources
without running Gredice PostHog Proxy logic.

## PostHog

The `/ingest` reverse proxy remains enabled so browser analytics keep their
first-party endpoint and shared anonymous identity. It does not emit a second
PostHog request log for its own traffic.

Routine Proxy pass-through requests are available in Vercel Observability and
are not copied to PostHog logs. PostHog request logs are reserved for:

- the public `/api/mcp` contract;
- redirects; and
- rewrites other than PostHog ingestion.

Vercel retains normal `console.info`, `console.log`, and `console.debug` runtime
logs. PostHog receives only `console.warn`, `console.error`, unhandled request
errors, and the explicit high-signal request logs above. This prevents routine
cron completion and health records from forcing an outgoing OTLP request every
minute while retaining operational failures.

API, WWW, Garden, App, and Farm log flushes share the scheduler's one-second
collection window. A single post-response flush then covers concurrent
high-signal records. The OTLP fetch transport aborts exports after five seconds
so DNS, connection, and response stalls are bounded. A timeout retries the same
batch once because OpenTelemetry treats its own fetch abort as non-retryable;
the processor's 12-second bound and provider's 13-second deadline cover both
attempts without delaying the response. Cloud UI hosts are normalized to their
regional ingestion hosts for OTLP exports; custom hosts and path prefixes are
preserved.

Failed exports propagate through the forced-flush scheduler, which uses
exponential backoff from 30 seconds to five minutes. The batch processor's own
timer is a five-minute fallback, so it cannot bypass that backoff. A runtime
warns only after a repeated failure and only once until a successful flush
resets the failure streak. WWW and Garden register every scheduled flush with
Vercel's post-response `waitUntil` lifecycle, including flushes triggered by forwarded
console warnings. Telemetry therefore remains non-blocking without leaving its
batch timer or export request detached when the response completes. Error-hook
and Proxy callers also register their flushes explicitly.

Calls within a collection window share one flush. Records arriving after an
export starts collect in a subsequent batch, which waits for the active flush
and checks its failure backoff before exporting. Each caller registers its task
with the current request lifecycle, including callers sharing an existing batch.
This avoids leaving late records to the unregistered five-minute fallback timer.
The queue remains in memory: failed batches and runtime termination can still
lose logs, and a timeout retry can duplicate a batch accepted before the timeout.

Run `pnpm --filter garden test:posthog` for the Garden console/error-hook lifecycle
integration and `pnpm --filter @gredice/js test` for shared batching, export
deadlines, timeout retries, and failure-backoff coverage. Tests use mocked
transport and do not send telemetry to PostHog.

## Cron schedules

Do not reduce one-minute schedules from event counts alone. Checkout outboxes,
delivery tracking privacy cleanup, delivery notification reconciliation, and
automations have documented latency or recovery contracts. Inspect aggregate
worker results and empty-run ratios over a representative production window
before changing cadence.
