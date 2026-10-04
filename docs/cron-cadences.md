# API cron cadences

All cron times in `apps/api/vercel.json` are UTC. The hourly maintenance jobs
share minute zero to avoid introducing extra wake windows. This is the approved
first cadence reduction in #5090. The due-work dispatcher in #5085 removes the
remaining idle minute/five-minute PostgreSQL polling from these workers.

| Job | Schedule | Delay and recovery |
| --- | --- | --- |
| Web Push | Hourly, minute 0 | Up to an hour of polling delay; existing quiet-hours eligibility, retry claims and expired-message checks apply. |
| Delivery-ready email | Hourly, minute 0 | Existing ten-minute batching delay remains; total delay is approximately 10–70 minutes. Delivery-lifecycle email remains separate. |
| Delivery notification health | Hourly, minute 0 | Explicit 135-minute failure window covers one missed hourly run and 15 minutes of jitter. Feature flag, failure-rate thresholds and ten-minute stale/ambiguous queue age remain unchanged. |
| Social publishing | Hourly, minute 0 | Up to an hour of publishing delay; committed queue/schedule edits publish Redis hints. The hourly recovery preflight checks eligibility before any Admin request. Empty passes do not call Admin or revalidate its page. |
| Outlet lifecycle cleanup | Hourly, minute 0 | Read-time offer expiry and hold availability remain authoritative; active checkout reservations stay protected. |
| Stripe checkout orphan recovery | Every five minutes, Redis gate | Created/bound attempt events publish hints. Outstanding attempts retain five-minute discovery/recovery; empty polling avoids PostgreSQL after hourly recovery. Maintenance always forces the existing aggregate drain preflight. |
| Preview Blob deletion outbox | Daily at 03:00 UTC | Immediate unpublish/delete attempts remain in the garden mutation routes. Failed attempts remain durable for daily recovery. |

Hourly push, delivery-ready and social workers process up to twelve of their
previous five-minute batches per invocation (up to 1,200 push attempts, 2,400
ready requests and 240 social posts). They start no new batch after four minutes
and have a five-minute function maximum. A short/empty batch ends the pass;
retries, partial recipient failures and lack of progress stop repeated immediate
provider attempts. Capacity exhaustion returns non-success rather than silently
claiming the queue drained. The accepted polling delay assumes the worker is
within that capacity; monitor burst/backlog counts as well as average traffic.

The Blob outbox worker claims at most 100 rows per batch with eight delete
workers, at most ten batches per invocation, and starts no further batch after
45 seconds. Every batch shares a ten-second Blob abort deadline, and the function maximum
is 120 seconds, leaving at least 75 seconds after the final batch starts for
provider cancellation and durable result persistence. Claim expiry and exponential
retry backoff remain unchanged. Partial failure and potential leftover backlog
return a non-success status; the aggregate capacity warning identifies a daily
window that requires attention. Unclaimed rows and interrupted claims remain
durable. A read-only production query at 2026-10-02 02:53 UTC found zero pending,
due or previously failed rows. Completed rows are deleted, so this snapshot
does not establish historical creation throughput; compare subsequent daily
claimed/deleted counts and capacity warnings before treating capacity as proven.

## Prompt work and idle recovery

`/api/internal/cron/work-dispatch` replaces five separate minute cron schedules
with one minute invocation. It checks the existing Silo Redis service before
running the existing workers concurrently. PostgreSQL remains authoritative;
Redis stores only a job generation, due timestamp and recovery timestamp.

| Worker | Signal / next due time | Normal delay / recovery |
| --- | --- | --- |
| Automations | Definition edits, committed new runs and retries; remaining runnable event backlog and stale run locks | Eligible events/runs within one minute plus the existing bounded processing time. Calendar schedule discovery and missed signals recover each UTC hour. |
| Order-confirmation email | Paid-cart outbox commit, safe retry and provider-reconciliation transitions | Within one minute after enqueue/retry eligibility. Claim expiry and uncertain-provider reconciliation remain scheduled; uncertainty never causes a resend. |
| Checkout notification | Durable operation/delivery outbox commit and safe retry | Within one minute after eligibility; existing claims, recipient ordering, idempotency and uncertain-send fences apply. |
| Delivery-lifecycle email | Notification commit and retryable failures; deferred quiet-hours time and pre-send lease expiry | Within one minute after eligibility. Preference checks, notification expiry, quiet hours and provider-submission fences apply. Disabled rollout workers do not query the queue. |
| Delivery-lifecycle reconciliation | Committed delivery domain events, with processed/decision markers excluded | Within one minute for new source events when both rollout flags and the canonical rollout timestamp enable the worker. Source reconciliation is bounded; remaining source work retains its hint. |
| Tracking retention | Shared minute-zero maintenance; no minute poll | Hourly physical cleanup. Delivery tracking, customer projection and rerouting continue enforcing the existing two-minute exact-location expiry at read time. |

All workers retain their existing batch, time and claim limits. Backlog beyond
those limits remains due for another pass; the delay assumes sufficient worker
capacity and healthy providers. The minute dispatcher still costs one Vercel
invocation each minute, even when every worker is idle. It removes four other
minute invocations and makes its own empty pass Redis-only. Hourly retention
removes a further 1,416 scheduled invocations per day: together 7,176 per day
(215,280 per 30 days), relative to the cadence-only configuration in #5090.

Signals publish after transaction commit. Nested savepoint rollback discards
its hints; outer rollback discards all hints. Publication failure is logged with
job/error name and never changes a committed business response. Each publication
increments a Redis generation and keeps the earliest due timestamp. The worker
acknowledges only its observed generation, so an enqueue/retry racing with its
final projection cannot be cleared. An interrupted worker never acknowledges
its hint; existing durable claims handle subsequent retries safely.

The first poll in each UTC hour runs bounded recovery against PostgreSQL,
including after signal eviction or an older producer missed publication. A
healthy empty hour then avoids database reads until work arrives or the next
hour. Redis configuration/transport failure fails open to the original worker
polling behavior and emits sanitized diagnostics for transport errors; it does
not provide idle database savings. Missing producer credentials instead fall
back to hourly recovery, so configure every producer before rollout.

## Configuration and rollout

API, Admin, Garden, Farm and Delivery must share the same **server-only**
`GREDICE_SILO_KV_REST_API_URL` and `GREDICE_SILO_KV_REST_API_TOKEN`. Production
uses a shared stable `due-work:v1:production` namespace; previews include the
deployment source SHA and do not consume production hints. The Silo Redis service
must support atomic `EVAL`. No new database schema or paid service is required.

Deploy producer credentials and source before depending on hints. Confirm the
managed-definition synchronization in #5083 is also deployed: an older runner
that rewrites defaults every pass can keep publishing automation hints.
Consumers remain compatible with old producers through bounded hourly recovery.
For rollback, restore the five original minute cron paths and minute retention
in the same deployment as the old consumer source. Retain the separate
five-minute payment recovery and all checkout maintenance/drain requirements.

Identical empty checkout reconciliation resets now append no event, including
concurrent reset calls. Actual cursor advancement and nonempty-to-empty resets
remain append-only under the shared transaction advisory lock.

Checkly's existing 30-minute checks and real customer/admin traffic remain
possible database wake sources. Preserve equivalent outage coverage when
considering lightweight health endpoints. Status ingestion is addressed in #5084.

A read-only Checkly configuration inspection on 2026-10-02 verified six active
API checks in `eu-central-1`, each on a 30-minute cadence with a status-code-only
assertion. WWW, Garden, Farm, Storybook and API root URLs expect 200; Admin checks
`https://app.gredice.com/admin` and expects 401 without authentication. The API
landing page has no storage reads, and the Admin check verifies its auth boundary.
The checks remain unchanged: replacing page/auth probes with different endpoints
would require evidence of equivalent outage coverage and measured database savings.

After merge, verify the exact production deployment SHA and deployed cron
configuration and shared producer credentials without logging their values.
Compare scheduled invocation counts, Redis-only skips, recovery scans, retry
latency and Neon active CU-hours over a matching 72-hour window. Include Checkly,
status ingestion, maintenance and real traffic in the remaining wake sources.
That production measurement remains pending; local tests and empty backlog
snapshots establish neither the monthly infrastructure budget nor database sleep.

## Optional dispatcher attribution

Set server-only `DUE_WORK_ATTRIBUTION=1` on API for a short production measurement
window, then unset it. It is disabled by default and adds no Redis or PostgreSQL
operations. Each authorized `runDueWork` pass emits one `due-work-dispatch`
record with a fixed job name and these fields:

- `reason`: `idle-signal` for a Redis-only skip, `recovery-preflight` for a
  durable-queue projection that skipped its worker, or a worker run caused by
  `due-signal`, `hourly-recovery`, `forced`, `disabled`, or `redis-unavailable`.
- `signalAvailable`, `recoveryDue`, and `workerStarted`: distinguish missing or
  failed Redis from healthy hints, recovery scans and actual worker invocations.
  A recovery preflight accesses PostgreSQL even if its worker was skipped. A
  disabled worker keeps its existing rollout response without a due projection.
- `durationMs`: elapsed time for the signal check, optional preflight, worker and
  acknowledgement. It is wall time, not billed CPU or database time.
- `signalLatenessMs`: the nonnegative interval from the observed Redis due hint
  to worker start, or `null` when no due hint exists, no worker starts, or the
  worker is disabled. It includes time spent checking Redis. This is a
  due-signal-to-start proxy; it does not measure each business enqueue, provider
  acceptance, recipient delivery or the latency of every item in a batch.
- `status` and `success`: worker HTTP status and the existing response success
  policy, including HTTP 200 with `success: false`. Skips report 200/true. A
  thrown worker or malformed successful response retains its original exception;
  `thrownPhase` distinguishes `worker` from `response`, and `success` is `null`.
- `acknowledgement`: `acknowledged`, `raced`, `error`, `missing-signal`, or
  `not-attempted`. Worker failure never clears its hint. A successful worker
  with a raced or failed acknowledgement retains its successful response.

Records contain no request/account/queue IDs, raw timestamps, URLs, headers,
payloads, error text or response bodies. Logging failures never affect business
results. The Vercel log's deployment/time metadata supplies the measurement
window; group by job and reason and inspect acknowledgement failures separately.
Only `idle-signal` establishes a Redis-only skip. Missing-signal fail-open runs,
recovery preflight skips and disabled worker responses do not establish database
savings. Combine these records with durable queue/backlog and provider evidence,
exact deployment readback, traffic and costs; attribution alone does not prove
end-to-end notification latency or the infrastructure budget. Exclude attribution
overhead when comparing normal operating costs.
