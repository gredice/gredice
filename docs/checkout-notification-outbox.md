# Checkout notification outbox

Checkout operation and delivery creation write notification intents to the
existing `email_messages` table in the same transaction as the authoritative
source record. Checkout waits only for that database commit. Slack message
construction, Slack HTTP calls, delivery-email rendering, ACS submission, and
ACS polling run later in the worker.

The outbox covers only the normal checkout flow:

- scheduled-operation Slack;
- delivery-created Slack; and
- scheduled-delivery email for each normalized account recipient.

The previous delivery-email grouping rule is preserved within one checkout:
delivery requests for the same account, delivery slot, and address produce one
email intent per recipient. A later independent checkout receives its own
intent, and pickup requests do not produce a scheduled-delivery email. Existing
Slack settings and message copy remain authoritative when the worker executes.

`GET /api/internal/cron/checkout-notifications` runs every minute, requires an
exact `Bearer CRON_SECRET` header, and has a 60-second function limit. A worker
claims at most 20 intents by default, stops before its provider-start budget is
exhausted, and reserves time to persist the result. Claims use row locking and
a five-minute lease. Expired claims from before the provider fence are safe to
reclaim.

## Retry and provider fence

Each deterministic intent has one stable provider operation ID and at most
three proven-safe delivery attempts. Missing provider configuration is
deferred without consuming an attempt. Explicit rate limits and server
rejections retry with bounded backoff. Terminal provider rejection is not
retried.

Immediately before a provider request, the worker persists
`submission_started`. A transport error, timeout, invalid success response, or
worker crash after that point is ambiguous and remains in `sending`; the
normal claim query cannot submit it again. This at-most-once fence prevents a
duplicate Slack message or customer email.

For an ACS fence, use `provider_message_id` as the ACS operation ID and inspect
the official read-only operation endpoint before changing state. For Slack,
confirm the message outcome in the configured channel and provider audit data.
Never requeue an ambiguous row merely because it is old. Any manual resolution
must preserve the prior operation ID, timestamps, and failure category.

## Health and incident response

The cron returns `503` when its worker has a current failure or aggregate health
contains a failed, fenced, stale-fenced, or expired pre-submission claim. The
new worker-completion, outbox-health, and cron-failure records contain aggregate
counts, oldest timestamps, and bounded error names or codes only; they add no
recipient addresses, rendered bodies, source metadata, or raw provider errors.
Existing source-detail builders retain their established bounded diagnostics.

Inspect rows with `metadata.outboxKind = checkout_notification` and use
`metadata.notificationKind` only to separate the three bounded intent types:

1. For `outbox_claimed` past its lease, allow the next cron to reclaim it.
2. For `retry_scheduled`, correct provider configuration or wait for the due
   time; do not replay checkout.
3. For `submission_started` or `submission_uncertain`, establish provider
   disposition before any manual transition.
4. For `retry_exhausted` or `terminal_failure`, correct the bounded failure and
   explicitly review whether a safe retry is proven.

## Deployment and rollback

No schema migration or new environment variable is required. Deploy the API,
cron registration, worker, and enqueue code together. Verify that the cron is
authorized and healthy, then compare the aggregate checkout latency phases
described in [checkout-performance.md](./checkout-performance.md).

For rollback, disable the checkout-notification cron before reverting enqueue
code. Queued intents remain durable and can be drained by the forward version.
Do not reset `sending` rows during rollback because their provider outcome may
already be accepted.
