# Checkout fulfillment date incident: cart 1371

Prepared on 24 October 2026. This is a recovery plan, not an executed recovery.
Merging, deploying, requeueing/replaying fulfillment, provider writes, and
production data changes require separate authorization. No schema migration is
needed for this fix.

## Evidence and diagnosis

The supplied automation report covers 23 October 2026 12:14 UTC through
24 October 2026 12:14 UTC:

- Deployment: `dpl_2ac86v7ZRAfhUZd8Ddc9rJx8qdA8`, API production alias,
  source `2b513827eba36d8dd4dc2ee21da3408efec75cb9`.
- Cart `1371`; failed items `7034`, `7039`, `7040`, `7041`. The saved runtime
  evidence contains five date errors per item across five distinct requests.
- The report records five other operations created. Treat these as partial
  successes to reconcile, not permission to recreate them.
- At 24 October 12:00:46 UTC, the reported health snapshot had one
  `manual_review` claim and a maximum attempt count of five. The oldest manual
  review timestamp was 23 October 19:35:29 UTC.
- The report attributes 222 HTTP 503 responses to this checkout's repeated
  reconciliation: 203 orphan recoveries, 17 Stripe cron checks, two webhooks.
  These are request counts, not additional customers or fulfillment attempts.

Evidence files, kept outside the repository:

- `/Users/aleks/.codex/automations/gredice-vercel-review/runs/2026-10-24/report.json`
- The adjacent `runtime-evidence.json`, `deployed-source.txt`, and
  `request-statuses.json`.

The relevant local source matches the recorded deployed source. On a fresh
selected-planting operation, `prepareSelectedPlantingCheckoutOperation` passed
the string from `checkoutScheduledDateFromAdditionalData` to the repository.
Both explicit dates and its default are strings. `checkoutOperationFingerprint`
expects a `Date` and calls `toISOString()` before creating an operation or its
mapping. The already-mapped path converted the stored string to a `Date`.
Regression tests fail on the fresh path before the fix and pass afterward.
This reproduces the source-level mismatch; the production minified frame has
not been independently source-mapped.

The fix converts either the durable mapped date or the selected/default date
to `Date` at this operation boundary. The shared repository also rejects invalid
date objects or runtime non-Date inputs with `CheckoutOperationConflictError`
before writing fulfillment effects. It retains canonical ISO fingerprints,
cart-item mapping keys, conflict checks, transaction boundaries, and locks.
Planting-event string date formats and existing default-date behavior are
unchanged.

Settlement, refunds, current cart/claim contents, actual operation IDs, rewards,
deliveries, invoices, receipts, and customer-visible completion have not been
read from production in this investigation. Saved logs are not a data audit.

## Local validation

- The selected-operation regression group failed ten date assertions before the
  fix; its stored-mapping replay and target-validation cases already passed.
- After the fix, all 87 tests in
  `apps/api/lib/stripe/processCheckoutSession.node.spec.ts` pass, covering JSON
  and object metadata, all three purchase currencies, timezone offsets,
  date-only/missing/invalid metadata, and mapped replay with unchanged reward
  keys despite metadata drift.
- All 43 tests across `checkoutFulfillmentIdempotency.node.spec.ts` and
  `accountsRepo.node.spec.ts` pass against a disposable PGlite database. They
  include concurrent operation/reward reuse, canonical ISO date equivalence,
  changed-fingerprint rejection, invalid-date rejection, and rollback. The
  final checkout repository file was rerun after its assertion adjustment:
  11 tests pass. Docker PostgreSQL validation could not start because Docker's
  disk was full; these results establish PGlite behavior, not live Postgres.
- `pnpm --filter api exec tsc --noEmit`, a source-only storage TypeScript check,
  Biome on all four changed TypeScript files, and `git diff --check` pass.
- The full `pnpm --filter @gredice/storage exec tsc --noEmit` remains blocked by
  85 diagnostics in unchanged files, including missing dependencies for imported
  admin-app code and existing script/test type errors. No diagnostics remain in
  either changed storage file. This broader check is not claimed as passing.

## Read-only preflight before any recovery

Use an authorized production read-only connection and Stripe read access.
Keep provider IDs and account details in the restricted incident record.

1. Resolve exactly one Stripe Checkout Session/payment-processing claim to
   cart `1371` using authoritative session metadata and the frozen checkout
   attempt/snapshot. The report redacts its session ID; do not guess it or pick
   an arbitrary manual-review row. Verify account/garden identity, currency,
   captured amount, payment status, and any refunds/disputes. Stop on ambiguity
   or an unpaid, refunded, or disputed payment.
2. Re-read the exact claim, including status, lifetime attempts, last failure,
   review history, completion transaction, and durable completion output IDs.
   Check for a current worker/lease. A changed state requires a fresh review.
3. Inventory every item in this cart, including already-paid, deleted, or changed
   rows. Compare the frozen purchased items/amounts with current rows. For each
   item record its checkout operation mapping, operation ID and deletion state,
   target planting/lifecycle, original date, request note, and delivery provenance.
   Verify mappings and their operations agree and are unique. Confirm the four
   reported failures are the entire remaining cohort; stop if the scope differs.
4. Reconcile the five reported successes with durable mappings and operation
   schedule events. Check delivery requests and queued/sent notification outputs.
   A missing mapping beside an existing effect is an investigation blocker;
   do not synthesize a mapping or delete the operation to make recovery pass.
5. Reconcile EUR payment reward events under
   `payment:shoppingCartItem:<itemId>`, sunflower debits, inventory consumption,
   and any legacy cart-level checkpoints. An EUR reward may already exist even
   when operation creation failed. Compare source, account, currency, and amount;
   do not manually grant rewards or debit again. Duplicate or inconsistent
   evidence must be resolved before replay.
6. Verify the four intended planting targets are still valid for a new purchase
   effect. Preserve their purchased date; if a date is absent/invalid, review
   the default date that recovery would choose. Do not replace a target, advance
   its lifecycle version, or silently reschedule to bypass a conflict. Reconcile
   the transaction, invoice, receipt, and both durable completion outputs too.

An initial bounded cart read can run inside a read-only transaction:

```sql
begin transaction read only;

select id, status, is_deleted, updated_at
from shopping_carts
where id = 1371;

select id, entity_type_name, entity_id, currency, amount, status,
       is_deleted, garden_id, raised_bed_id, position_index, updated_at
from shopping_cart_items
where cart_id = 1371
order by id;

rollback;
```

Use the storage mapping readers for the full cart item set: they reject malformed
and duplicate mappings. A read-only claim-review preview below merely displays
claim state; it does **not** validate settlement or any of the other preflight
conditions.

## Authorized release and bounded recovery

1. Review the patch and validation evidence, then obtain separate authorization
   to merge and deploy. Verify the production API alias points to a READY
   deployment containing this exact fix before requeueing. Requeueing the old
   deployment would consume another retry budget with the same defect.
2. After the read-only preflight passes, prepare a review for the single resolved
   session ID. Use the existing command documented in
   [Stripe processing claims](./stripe-checkout-processing-claims.md). Supply
   the verified production environment through the approved operator workflow;
   do not pull new credentials or run migrations as part of recovery.

   ```sh
   pnpm --filter @gredice/storage stripe-payment-claim:review requeue \
     --stripe-payment-id='<verified-session-id-for-cart-1371>' \
     --reviewed-by='<authorized-reviewer>' \
     --reason='Cart 1371 payment and partial effects reconciled; date fix deployed; bounded fulfillment retry approved'
   ```

3. Only with separate approval for recovery, recheck state immediately and add
   `--apply` to the reviewed command. This writes the audit entry and moves only
   that `manual_review` claim to `retryable`; it preserves lifetime
   `attempt_count` and grants a new per-review retry budget. Cron can pick it up
   immediately. Treat this command as authorizing fulfillment side effects,
   including notifications and billing outputs, not as a harmless status reset.
   Do not reset attempts, edit cart/mapping/claim rows, replay webhooks, create a
   new payment/session, or use `checkout:resume-direct` (it supports a different
   sunflower plant-only recovery).
4. Observe the next normal fenced worker attempt and capture its request/claim
   evidence. Do not repeatedly requeue. The normal worker may revisit the full
   checkout: already-paid items must be skipped, and durable operation/reward/
   delivery/inventory keys must reuse prior effects. If a target, fingerprint,
   amount, or delivery conflict appears, stop intervention and investigate;
   never loosen those guards. Requeue grants the standard retry budget, not a
   single-attempt limit; if the first attempt fails, obtain authorization for
   containment before another due retry rather than editing the claim directly.

If authoritative preflight instead proves all fulfillment is already complete,
use the supported `resolve` review action only after verifying the canonical
completed transaction and both linked durable completion outputs. Preview it
first and obtain separate approval to apply. Never mark the claim complete to
hide unfinished items.

## Acceptance and failure handling

- Exactly the reviewed remaining items complete. Their new mappings each point
  to one live operation with the intended target/date; the five prior operations
  and their mappings remain unchanged. There are no duplicate schedule events,
  rewards, debits, inventory consumptions, deliveries, or output records.
- Cart/item statuses agree with fulfillment; the same payment identity has one
  canonical completed transaction and both valid durable completion outputs.
  Invoice/receipt evidence and notification delivery state reconcile with the
  captured payment. A queued output is not proof of external delivery.
- The claim reaches `completed` through the fenced worker (or the separately
  reviewed resolution path), preserving its attempt/review history. No new date
  TypeError appears, and subsequent reconciliation leaves durable counts stable.
- Confirm the customer-visible completed order and its intended garden operations
  through an authorized read-only check. Report payment settlement, application
  completion, and external delivery as separate verified facts.
- On failure, retain the partial effects and collected evidence. Do not delete
  operations, reverse rewards, refund, or roll back production data automatically.
  A code rollback also requires separate approval and does not repair this cart.
