# Checkout order-confirmation outbox

Direct non-Stripe checkout records an order-confirmation intent in the existing
`email_messages` table when the cart makes its authoritative `new` to `paid`
transition. The checkout response waits for that transaction, but it does not
render the email, call the provider, or poll provider delivery.

The API cron at `/api/internal/cron/order-confirmation-emails` runs every minute
and requires `CRON_SECRET`. Workers claim a bounded batch with database row
locking. A durable claim can be retried after its lease expires. Once a worker
crosses the provider-submission fence, an ambiguous result remains in `sending`
and is not automatically submitted again; ACS operation IDs are identifiers,
not a repeatability guarantee.

The route has a 60-second function limit. The worker stops claiming new work
with less than ten seconds left, aborts provider work before the 50-second
worker budget, and reserves five seconds to persist the final state. An abort
that can occur after provider submission starts is fenced as uncertain rather
than retried. Each run reconciles at most three old fences first, with a
five-second GET budget each, so stale work cannot starve new confirmations.

The worker logs aggregate counts, queue age, duration, bounded failure
categories, and whether it stopped for its time budget. The cron also logs an
aggregate health snapshot for queued work, expired pre-submission claims,
stale submission fences, uncertain submissions, terminal failures, and retry
exhaustion. Recipient addresses, cart and item content, rendered bodies, and
raw provider errors must not be logged. The cron returns `503` while a current
delivery attempt fails or any stale/terminal state still needs reconciliation;
this is an operational alert, not a signal to replay checkout.

## Reconciliation

Expired `outbox_claimed` rows are safe to reclaim automatically because the
provider boundary was not crossed. Missing provider configuration follows the
same deferred retry path, does not consume delivery attempts, and does not
change checkout success.

Five minutes after `submission_started` or `submission_uncertain`, the worker
claims a separate reconciliation lease and uses the row's
`provider_message_id` as the ACS operation ID. Reconciliation calls only the
official, read-only operation endpoint; it never re-enters the email send path:

`GET {ACS endpoint}/emails/operations/{operationId}?api-version=2025-09-01`

- `Succeeded`: the existing audit row becomes `sent`; no new submission occurs.
- `Running` or `NotStarted`: the fence remains and another GET is scheduled
  with capped backoff.
- `Failed` or `Canceled`: the existing row records the terminal provider
  result and remains an operator-visible failure.
- A timeout, unavailable status API, 404, or unknown response is not proof of
  non-delivery. The row remains fenced and another read-only GET is scheduled.

Reconciliation claims use row locking and a five-minute lease, so a worker
crash during the GET is recoverable without creating a send path. Health stays
unhealthy while any reconciliation is pending, stale, terminal, or exhausted.
For a persistent fence, operators can use the same GET manually; raw provider
responses, recipient data, and operation-status errors must not be logged.

For `retry_exhausted`, first correct the bounded failure category shown in the
audit row. Requeue only failures proven to be before submission (for example,
configuration or rendering) or an authoritative provider non-delivery. Every
manual state transition must retain the prior operation ID, failure category,
and reconciliation time in metadata so the customer email remains auditable.

## Deployment and rollback

No schema migration or new environment variable is required. Deploy the API
code and cron together. Existing direct checkouts then begin writing intents,
and the worker drains them using the already-configured email provider.

For rollback, remove or disable the cron before reverting the enqueue code.
Queued rows remain durable in `email_messages`; they can be drained by the
forward version after it is restored. Do not reset `sending` rows without
confirming provider disposition through the reconciliation workflow, because
that could duplicate a customer email.
