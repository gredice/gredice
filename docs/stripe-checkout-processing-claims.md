# Stripe checkout processing claims

Paid Stripe Checkout sessions use a durable, lease-fenced claim before the API
runs fulfillment. Webhook delivery and the hourly Stripe reconciliation cron
therefore converge on the same `stripe_payment_id` without holding a PostgreSQL
connection while Stripe, fulfillment, billing, email, or analytics work runs.

The claim transaction only inserts or locks one
`stripe_payment_processing_claims` row. The callback runs after that transaction
commits. Heartbeats and final state transitions are separate short statements
that require the current random claim token and an unexpired lease.

## States and recovery

- `queued`: Stripe discovery durably recorded the completed session, but no
  worker has claimed it yet.
- `processing`: one worker owns the token until `lease_expires_at`. The default
  lease is two minutes and is renewed every 30 seconds.
- `retryable`: the last attempt failed before the retry limit, or a completed
  provider session is still waiting for payment settlement. The cron can
  reclaim it after `next_attempt_at`. Settlement deferrals preserve the
  lifetime attempt count but reset the current manual-review cycle, so a valid
  delayed payment cannot exhaust the ordinary retry budget.
- `completed`: a completed, non-deleted transaction with the same Stripe ID and
  both verified durable completion outputs were found and linked on the claim.
- `manual_review`: processing could not establish a completed transaction, a
  non-retryable failure occurred, or five attempts were exhausted.

The hourly cron first resumes a frozen Stripe `created[gte]`/`created[lte]`
range in pages of 100. Each page and its next provider cursor are committed in
one database transaction: session claims are enqueued before the cursor can
advance. An exhaustive range rolls forward from the prior upper bound with a
five-minute overlap, so boundary events are deduplicated by Stripe session ID
and sessions created during a long scan enter the next frozen range.

Recovery uses a separate durable scheduler cursor. Each pass freezes the
highest scheduler ID that existed at its start and advances the cursor before
calling Stripe or fulfillment. A permanently failing old claim therefore
cannot pin newer claims. `completed`, `manual_review`, and currently leased
claims are excluded before any Stripe retrieval. A process crash needs no
manual reset: after the lease expires, a later pass gets a new token and repeats
the existing idempotent fulfillment path.

An old worker cannot complete or fail a claim after its lease expires or a
replacement token is issued. The claim control is revalidated before each
fulfillment, ledger, transaction, billing, durable-output, and analytics
boundary. Checks inside an existing database transaction use that transaction,
avoiding an extra pool checkout while preserving the ownership fence.

The transaction repository also enforces one final transaction row per Stripe
payment identity. An exact replay returns that row; a replay with a different
account, garden, amount, currency, or status raises an identity-conflict error
and is never silently accepted.

Claim completion also verifies the durable order-confirmation and purchase
notification output IDs. A replay can repair missing output links before the
claim becomes `completed`; it does not resend from an untracked in-memory step.
Both outputs are created immediately after the transaction and before optional
billing automation, keeping the durable completion boundary short.

New Checkout sessions explicitly request only Stripe's `card` payment method.
This prevents Dashboard-enabled delayed methods from silently changing the
event contract. Reconciliation still treats an older complete-but-unpaid
session as deferred and can fulfill it once a later retrieval reports `paid`.

## Deployment preflight

Migration `0078_silly_bushwacker.sql` refuses to create the unique index if a
historical Stripe identity is malformed, semantically duplicated, or attached
to a transaction that is not active and completed. Run all three read-only
preflights before deploying:

```sql
select id, stripe_payment_id, status, is_deleted
from transactions
where stripe_payment_id is not null
  and (
    stripe_payment_id <> btrim(stripe_payment_id)
    or char_length(btrim(stripe_payment_id)) not between 1 and 255
  )
order by id;
```

```sql
select
    btrim(stripe_payment_id) as normalized_stripe_payment_id,
    count(*) as transaction_count,
    array_agg(id order by id) as transaction_ids
from transactions
where stripe_payment_id is not null
group by btrim(stripe_payment_id)
having count(*) > 1
order by transaction_count desc, normalized_stripe_payment_id;
```

```sql
select id, stripe_payment_id, status, is_deleted
from transactions
where stripe_payment_id is not null
  and (status <> 'completed' or is_deleted = true)
order by id;
```

All three results must be empty. If any is not, compare Stripe payment state,
account, amount, sunflower ledger entries, cart fulfillment, invoices, and
receipts for every returned identity. Prepare a reviewed data-correction
migration that preserves the audit trail and updates dependent records; do not
trim, pick, undelete, complete, or rewrite a payment identity based only on
creation time. Retry migration `0078` only after every preflight is empty.

The unique index uses the original column value without `coalesce`, and the
preflight excludes nulls. PostgreSQL unique-index semantics therefore continue
to allow multiple nulls if the currently non-null column is relaxed in a future
schema change.

The repository's `migrate:deploy` path uses Drizzle's PostgreSQL migrator, which
executes all pending migration statements and their migration-journal writes in
one database transaction. Migration `0078` additionally places its duplicate
and canonical-identity preflights before its first DDL statement. Before those
preflights, it takes the exclusive transaction-scoped advisory drain fence that
matches the shared fence held by legacy processors. It sets transaction-local
`lock_timeout` to five seconds and `statement_timeout` to five minutes. An
active legacy processor, busy writer, or failed identity preflight therefore
fails the build with an atomic rollback instead of partially creating or
seeding the claim schema.

The API Vercel project's production Build Command runs
`pnpm --filter @gredice/storage migrate:deploy` after the API build and before
the new deployment is activated. That command runs pending migrations and then
verifies the exact migration `0078` journal hash, claim relations and indexes,
validated singleton constraints, and cursor rows in a repeatable-read,
read-only transaction. A mismatch fails before Vercel deploys outputs. Preview
builds skip migrations and readback. Do not run migration `0078` separately or
copy its statements into an ad hoc runner: the production build is the cutover
boundary, and its migration transaction must retain the exclusive drain fence
and all preflights.

The same verification can be invoked independently through an approved
environment runner:

```sh
pnpm --filter @gredice/storage stripe-payment-claim:migration-readback
```

It opens a repeatable-read, read-only transaction and emits only aggregate
verification counts. Failures expose a bounded invariant code, not database
credentials, cursor values, payment identities, or customer data.

Do not run the advisory-lock version and claim version concurrently: they use
different ownership protocols. Keep the Stripe event destination enabled
throughout the cutover. Disabling a destination can prevent automatic delivery
of events generated while it is disabled; the API maintenance response instead
creates a failed delivery that Stripe can retry. See Stripe's documentation for
[event destinations](https://docs.stripe.com/workbench/event-destinations) and
[automatic webhook retries](https://docs.stripe.com/webhooks?lang=node).

When the emergency maintenance flag is enabled, maintenance is deliberately
narrow. Authenticated Stripe reconciliation and valid
`checkout.session.completed` deliveries return HTTP 503 with `Retry-After: 60`
and `Cache-Control: private, no-store`. `checkout.session.expired` remains active
so cart reservations can be released. The five-minute outlet lifecycle cron
still performs outlet cleanup, reports its counts, skips only orphan
Stripe-attempt reconciliation, and returns the same retryable 503. Missing or
invalid cron authentication invokes neither job. With the flag unset or
`false`, durable claim processing is active.

Follow the detailed prerequisite behavior and drain evidence in
[Stripe checkout advisory drain gate](./stripe-checkout-advisory-drain.md).
Use this prerequisite-gated cutover:

1. Rehearse migration `0078` on a production-scale PostgreSQL clone. Record its
   duration and transaction row count; verify the real-PostgreSQL lock test
   fails atomically under the matching shared advisory drain fence and succeeds
   after release.
2. Merge prerequisite issue `#4387`. Confirm the production API deployment is
   `READY`, references its exact merge SHA, and contains no new migration. Keep
   the Stripe destination enabled. Confirm the authenticated reconciliation
   cron and a valid signed completed-payment delivery return HTTP 503 with
   `Retry-After: 60`; verify Stripe retains the delivery for retry.
3. Record the immediately preceding production deployment's effective function
   maximum duration. Confirm every production alias and rolling release is
   fully routed to the exact `#4387` merge SHA, then wait for the entire
   predecessor maximum duration plus an operational margin of at least five
   minutes. Verify runtime logs show no continuing checkout invocation from the
   preceding deployment. The aggregate drain probe cannot observe a processor
   that started before the shared fence existed, so neither the timer nor the
   probe is sufficient alone.
4. Run
   `pnpm --filter @gredice/storage stripe-payment-processing:drain-preflight`
   through the approved production environment runner until its aggregate
   result is `{"drained":true}` and exit status is zero. Require the
   authenticated outlet-lifecycle aggregate readback to agree. Run all three
   transaction-identity preflights above and require every result to be empty.
5. Rebase claim PR `#4385` onto the fully routed prerequisite. Verify migration
   `0078` takes the matching exclusive drain fence before identity preflights,
   DDL, or legacy-claim seeding, then require its full CI and real-PostgreSQL
   migration tests to pass.
6. Merge PR `#4385`. Its Vercel production Build Command builds the API and then
   automatically runs `migrate:deploy` before deploying the new outputs.
   Migration `0078` reacquires the exclusive fence and reruns the identity
   preflights in its transaction. A fence timeout or preflight failure fails
   the build atomically while the exact `#4387` maintenance deployment remains
   live; investigate the blocker and retry the full deployment without
   bypassing the migration.
7. Confirm the build log records successful migration `0078`, the resulting API
   deployment is `READY` at the exact `#4385` merge SHA, the production aliases
   are fully routed, and the forced maintenance gate still reports a successful
   aggregate drain.
8. Merge activation issue `#4388`. Its production build reruns migrations and
   then verifies the exact migration journal hash,
   `stripe_payment_processing_claims`,
   `stripe_payment_processing_claim_reviews`,
   `stripe_payment_discovery_checkpoints`,
   `stripe_payment_recovery_cursors`, required unique indexes, validated
   singleton constraints, and one row in each cursor table. The verifier is
   read-only and privacy-safe. A mismatch fails before output activation and
   leaves the exact `#4385` maintenance deployment live. Confirm the activation
   merge SHA is `READY` and fully routed before sending queued work to the claim
   processor.
9. Invoke the authenticated cron manually. A budget-limited discovery or
   recovery pass returns an unhealthy HTTP 503 while preserving both cursors.
   Repeat reconciliation until one frozen discovery range and one recovery
   cycle complete, then confirm a subsequent cycle is healthy with no due or
   expired work.
10. Make one low-risk paid sunflower checkout and verify one linked `completed`
    claim, one completed transaction, one ledger effect, and both deterministic
    durable completion outputs. Record end-to-end checkout and processing
    latency, then watch retries, duplicate suppression, database pool wait, and
    transaction count through another healthy reconciliation cycle.

For rollback, route to the exact maintenance-on `#4385` claim deployment, or
enable the emergency maintenance flag and deploy that configuration. Verify
both entry points return 503. Drain claim workers and the current
order-confirmation and checkout-notification workers. Then run:

```sh
pnpm --filter @gredice/storage stripe-payment-claim:rollback-preflight
```

The command is read-only and exits nonzero unless every new-only v1
`purchase_slack` output and Stripe order confirmation with `cartId: null` is
terminal `sent` (including an intentional worker-recorded skip). A queued,
sending, failed, or bounced row blocks downgrade because the previous release
would parse it as invalid. Keep the compatible release active and let its
workers drain queued/sending rows. For failed or bounced rows, do not relabel
them: establish provider evidence, ship a reviewed forward repair/requeue on
the compatible release, and rerun the preflight. Deploy the previous
advisory-lock release only after the aggregate blocker count is zero. Leave the
claim tables, review audit, outputs, and unique index in place. Invoke the cron
and verify queued Stripe deliveries recover. Do not drop or rewrite active
claim rows during rollback.

## Health and manual review

The authenticated cron response exposes aggregate `queuedCount`,
`processingCount`, `expiredLeaseCount`, `retryableCount`,
`dueRetryableCount`, `manualReviewCount`, `maxAttemptCount`,
`oldestRecoverableAt`, and `oldestManualReviewAt`. It returns HTTP 500 when
Stripe discovery, cursor storage, or session processing rejects. It returns
HTTP 503 while either cursor is budget-limited, a due retry or expired lease
remains, or a claim needs manual review.

The function has a 60-second platform limit and a 45-second soft work budget:
up to 15 seconds for discovery and at most 50 recovery candidates. A new
candidate starts only while at least 30 seconds remain in the soft budget,
covering two sequential five-second Stripe calls plus 20 seconds of fulfillment
and database headroom. Every reconciliation Stripe request uses a five-second
timeout and zero SDK retries. A worker killed beyond the hard platform limit is
recovered after its lease expires; no detached timeout race continues work
after the response. Production rollout must confirm observed maximum cron
duration stays below 60 seconds and the slowest recovery candidate stays below
the 30-second start reserve.
Logs contain bounded state, attempt, pagination count, scheduler ID, and Stripe
identity fields, not cart contents, customer data, or raw provider responses.

Health is one database aggregate over non-completed rows; it never materializes
checkout history in application memory. `maxAttemptCount` is the maximum across
the same actionable `queued`, `processing`, `retryable`, and `manual_review`
rows and is zero when none exist. Completed claim history is excluded from every
health count, oldest timestamp, and maximum.

Use this query when an alert reports stale or manual-review work:

```sql
select
    stripe_payment_id,
    status,
    attempt_count,
    lease_expires_at,
    next_attempt_at,
    last_failure_code,
    manual_review_reason,
    completed_transaction_id,
    updated_at
from stripe_payment_processing_claims
where status <> 'completed'
order by updated_at;
```

For an expired `processing` or due `retryable` row, let cron reclaim it. For
`manual_review`, first establish authoritative Stripe, fulfillment, ledger,
transaction, invoice, and receipt evidence. Use the supported review command;
do not update the claim row directly. Run it without `--apply` first:

```sh
pnpm --filter @gredice/storage stripe-payment-claim:review requeue \
  --stripe-payment-id=cs_example \
  --reviewed-by=operator@example.com \
  --reason='Stripe and fulfillment evidence reviewed; retry approved'
```

Repeat the exact command with `--apply` to move the claim to `retryable`. The
next claim receives a fresh per-review retry budget while `attempt_count`
continues as lifetime history. Both the decision and the prior manual-review
reason are appended to `stripe_payment_processing_claim_reviews`.

If fulfillment is already complete, first ensure the canonical completed,
non-deleted transaction with the same Stripe ID and both deterministic durable
completion outputs exist. Then preview and apply:

```sh
pnpm --filter @gredice/storage stripe-payment-claim:review resolve \
  --stripe-payment-id=cs_example \
  --reviewed-by=operator@example.com \
  --reason='Canonical transaction and durable outputs verified' \
  --apply
```

`resolve` refuses to complete a claim without that transaction and both valid
output records. Never manually reuse an old claim token or reset the lifetime
attempt count.
