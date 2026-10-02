# API cron cadences

All cron times in `apps/api/vercel.json` are UTC. The hourly maintenance jobs
share minute zero to avoid introducing extra wake windows. This is the approved
first cadence reduction in #5090; it does not by itself permit Neon to sleep.

| Job | Schedule | Delay and recovery |
| --- | --- | --- |
| Web Push | Hourly, minute 0 | Up to an hour of polling delay; existing quiet-hours eligibility, retry claims and expired-message checks apply. |
| Delivery-ready email | Hourly, minute 0 | Existing ten-minute batching delay remains; total delay is approximately 10–70 minutes. Delivery-lifecycle email remains separate. |
| Delivery notification health | Hourly, minute 0 | Explicit 135-minute failure window covers one missed hourly run and 15 minutes of jitter. Feature flag, failure-rate thresholds and ten-minute stale/ambiguous queue age remain unchanged. |
| Social publishing | Hourly, minute 0 | Up to an hour of publishing delay; queued/scheduled eligibility and failure reporting remain unchanged. |
| Outlet lifecycle cleanup | Hourly, minute 0 | Read-time offer expiry and hold availability remain authoritative; active checkout reservations stay protected. |
| Stripe checkout orphan recovery | Every five minutes | Separate authenticated path preserves discovery/recovery cursors, idempotency, maintenance gating and the aggregate drain preflight. It never repeats outlet cleanup. |
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

Remaining frequent work: the six one-minute automation, notification,
lifecycle-reconciliation and tracking-retention jobs, five-minute payment
recovery, and status ingestion. #5085 and #5084 address these separately.

After merge, verify the exact production deployment SHA and deployed cron
configuration. Compare scheduled invocation counts and processing latency over
a matching 72-hour window. Local tests and the empty backlog snapshot establish
neither the monthly infrastructure budget nor database sleep.
