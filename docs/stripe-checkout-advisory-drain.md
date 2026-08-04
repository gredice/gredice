# Stripe checkout advisory drain gate

## Summary

This runbook records the temporary release gate used before durable payment
claims and migration `0078` were activated. Issue `#4387` paused completed
Stripe checkout processing so the legacy advisory-lock processor could not
cross the claim backfill boundary, while keeping Stripe retries, checkout
expiration release, and outlet cleanup intact.

PR `#4385` deployed the claim schema under that forced gate. Activation task
`#4388` removes the code-level default only after its production build runs a
read-only migration, relation, index, constraint, and singleton-cursor
verification. Keep this document as the cutover and rollback evidence record.

## Actors and entry points

- Stripe delivers `checkout.session.completed` and
  `checkout.session.expired` to `POST /api/stripe/webhook`.
- The authenticated reconciliation job invokes `GET /api/stripe/cron`.
- The authenticated outlet job invokes
  `GET /api/internal/cron/outlet-lifecycle`.
- During the prerequisite release, legacy paid-session processing was owned by
  `withStripePaymentProcessingLock` in `packages/storage`.
- An operator runs the read-only drain preflight through the approved
  production environment runner.

## Maintenance behavior

Signature and cron authentication are checked before maintenance state:

- A valid completed-payment webhook returns HTTP `503`, `Retry-After: 60`, and
  `Cache-Control: private, no-store`. It performs no fulfillment or transaction
  work, so Stripe retains the delivery for retry.
- An expired checkout remains active and releases its durable checkout attempt.
- The authenticated Stripe reconciliation job returns the same retryable
  maintenance response before listing Stripe sessions.
- Outlet lifecycle cleanup still releases expired reservations and closes
  offers. Stripe orphan-attempt reconciliation is skipped, and the response is
  HTTP `503` with `maintenance: true`. The same authenticated invocation runs
  the aggregate drain preflight without exposing checkout or account data.
  `stripePaymentProcessingDrained: true` means no instrumented shared-lock
  holder remains, `false` means one is active, and `null` plus
  `stripePaymentProcessingDrainFailureCategory` means the probe failed. Even a
  `true` result cannot observe a processor that started before this release and
  never acquired the shared fence.
- Missing or invalid authentication invokes neither maintenance checks nor
  business work.

After activation,
`GREDICE_STRIPE_CHECKOUT_PROCESSING_MAINTENANCE_ENABLED` is the sole emergency
maintenance switch. Unset or `false` keeps durable claim processing active; a
documented truthy value returns both entry points to retryable maintenance.
Changing a Vercel environment value requires a new deployment, so the fastest
rollback is routing to the exact maintenance-on `#4385` deployment.

## Drain fence

Every legacy Stripe payment processor holds a shared, transaction-scoped
PostgreSQL advisory lock for the full lifetime of its existing per-session
advisory transaction. The drain preflight attempts the matching exclusive lock
inside a read-only transaction:

```sh
pnpm --filter @gredice/storage stripe-payment-processing:drain-preflight
```

The command prints only aggregate JSON. It exits `0` with `{"drained":true}`
when no legacy processor is active, exits `2` with `{"drained":false}` while
any shared processor lock remains, and exits `1` on an operational failure. It
does not read or print checkout, account, payment, or user data.

The lock namespace and key are stable source constants. Migration `0078` must
take the matching exclusive transaction-scoped lock before identity preflights,
claim-table DDL, or legacy-claim seeding. Do not copy or independently change
the numeric keys.

## Production cutover

The API Vercel project runs `pnpm --filter @gredice/storage migrate:deploy`
during a production build, after the API build and before activating the new
deployment. The command runs pending migrations and then a read-only claim
schema readback; preview deployments skip both. The completed cutover order is:

1. Merge the `#4387` prerequisite PR. Confirm the production API deployment is
   `READY`, references the exact merge SHA, and contains no new migration.
2. Verify a valid signed completed-payment delivery and the authenticated
   Stripe reconciliation endpoint both return retryable maintenance responses.
   Verify an expired checkout still releases its attempt and outlet cleanup
   still reports counts.
3. Record the immediately preceding deployment's effective function maximum
   duration. Confirm the production aliases and any rolling release are 100%
   routed to the exact `#4387` SHA, then start the timer and wait for that entire
   duration plus an operational margin (never less than five minutes). Verify
   runtime logs show no continuing checkout invocation from the preceding
   deployment. A processor that started before `#4387` does not hold the new
   shared fence, so the database probe cannot observe it.
4. Run the drain preflight through the approved production environment runner
   until it exits `0`. Because the deployed gate prevents new completed-payment
   work, the elapsed predecessor limit and successful exclusive probe together
   establish the drain boundary. The scheduled outlet lifecycle response and
   `stripe_payment.processing.maintenance_active` log provide an independent
   production readback of the same aggregate result. Neither condition is
   sufficient on its own.
5. Run the three read-only Stripe transaction-identity preflights documented by
   the claim migration PR, and rehearse migration `0078` against a
   production-scale PostgreSQL clone.
6. Rebase PR `#4385` onto the prerequisite. Require migration `0078` to take the
   same exclusive drain fence before it seeds claims, then rerun its full CI and
   real-PostgreSQL tests.
7. Merge PR `#4385`. The production build applies migration `0078` while the
   already-live prerequisite still rejects completed-payment work. A migration
   failure leaves the maintenance deployment live and retryable.
8. Confirm the exact `#4385` production deployment is `READY`, fully routed,
   and still reports `drained: true` under maintenance.
9. Merge activation task `#4388`. Its production `migrate:deploy` must read back
   the exact migration `0078` journal hash, required claim tables and indexes,
   validated singleton constraints, and one row in each cursor table inside a
   repeatable-read, read-only transaction. Any mismatch fails before Vercel
   activates outputs and leaves the `#4385` maintenance deployment live.
   Verify the exact activation SHA is `READY`, then invoke reconciliation until
   one frozen discovery range and one recovery cycle complete.
10. Complete one low-risk paid sunflower checkout. Require one completed claim,
   one transaction, one ledger effect, and one pair of durable completion
   outputs before recording post-cutover latency.

## Failure handling and observability

- Maintenance responses log
  `stripe_payment.processing.maintenance_active` with the entry-point source
  and, for outlet lifecycle, only the aggregate drain result or failure
  category.
- A failed exclusive drain probe means at least one legacy processor transaction
   is still active. Do not run or merge the claim migration.
- A successful exclusive probe cannot see a processor that began on the
  pre-`#4387` deployment. Do not skip the predecessor-duration and runtime-log
  check.
- A migration lock timeout or failed preflight must fail the production build;
  do not bypass it or run migration statements individually.
- A migration-readback invariant failure also fails the build after migrations
  may have committed. Repair forward and retry the deployment; do not attempt an
  automatic schema rollback.
- Keep the Stripe event destination enabled. HTTP `503` responses preserve
  automatic retries; disabling the destination can prevent automatic delivery
  of events created while it is disabled.
- Never log auth headers, webhook bodies, Stripe customer details, or production
  connection strings while verifying the cutover.

## Validation

From the repository root:

```sh
pnpm --filter api test:node
pnpm --filter api exec tsc --noEmit
pnpm --filter @gredice/storage test
pnpm --filter @gredice/storage stripe-payment-claim:migration-readback
git diff --check
```

The storage CI job must run the drain concurrency case on real PostgreSQL with
zero skips before merge. Run the migration readback only with the intended
environment's `POSTGRES_URL`; it is read-only and prints aggregate counts or a
bounded invariant code, never connection details or cursor values.
