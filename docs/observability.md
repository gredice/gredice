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

WWW log flushes share the batch processor's one-second collection window. A
single post-response flush then covers concurrent high-signal records, and a
failed forced flush pauses additional forced attempts for 30 seconds while the
batch processor keeps its normal export schedule. OTLP exports and forced
flushes have bounded timeouts so telemetry cannot occupy the full function
lifetime.

## Cron schedules

Do not reduce one-minute schedules from event counts alone. Checkout outboxes,
delivery tracking privacy cleanup, delivery notification reconciliation, and
automations have documented latency or recovery contracts. Inspect aggregate
worker results and empty-run ratios over a representative production window
before changing cadence.
