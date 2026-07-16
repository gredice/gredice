# Delivery handoff audit

## Summary

The delivery handoff check is an advisory record of what the driver observed at
the customer stop. It helps the driver confirm that every expected harvest left
the vehicle, while keeping delivery possible when a sticker is missing, a QR
code cannot be read, or another operational exception occurs. QR verification
never blocks arrival or fulfillment.

The expected manifest comes from the immutable per-harvest trace snapshot on
`delivery_run_stops`. The server does not trust the device to define which
harvests belong to a stop. A handoff attempt can update the advisory resolution
of an expected item, but it cannot add an item to the manifest or move an item
between stops.

## Actors and access boundaries

- The driver assigned to the active delivery run can read and mutate the
  handoff manifest for the current physical stop.
- An administrator assigned as the run's deliverer can perform the same
  workflow. Administrators can also inspect other runs when investigating
  delivery support cases, but cannot mutate an unassigned run.
- Other drivers cannot read or mutate a run that is not assigned to them.
- Customers cannot access raw handoff attempts, operation receipts, QR input,
  driver identifiers, or internal exception details. A separate,
  customer-safe receipt projection is deferred to GitHub issue `#4144`.
- The retention cron is an authenticated internal system actor. It receives no
  customer input and returns counts only.

These boundaries apply both to successful scans and to error outcomes. An
invalid or wrong-stop QR scan must not become a lookup endpoint for another
customer, stop, run, or trace record.

## State and audit model

The audit has two layers:

1. The current per-harvest advisory state records whether an expected item is
   still pending or was resolved as scanned, no-label, missing, or skipped.
   Repeated scans resolve to the same final state.
2. Idempotent operation receipts record the bounded result of each submitted
   attempt. Results distinguish scanned, already-scanned, no-label, missing,
   skipped, stale, invalid, wrong-stop, and unknown-item attempts without
   exposing data from a mismatched trace.

The client supplies a stable operation identifier. Retrying the same operation
with the same payload returns the original receipt; it does not create another
audit row or apply the state transition twice. Reusing an operation identifier
with a different payload is a conflict. Bulk requests preserve one receipt per
harvest attempt so a partial exception remains visible and retryable without
replaying successful items.

Offline operations are ordered by their client occurrence time. A late-arriving
older operation is recorded as `stale` and cannot replace newer evidence for the
same harvest. After pickup, QR validation uses the run's immutable trace
snapshot, so retiring the public trace link does not invalidate evidence for a
harvest that is already on the vehicle.

Every mutation is also bound to the retry attempt shown by the manifest. When a
stop is deferred and opened for another visit, the server resets its advisory
state and increments the attempt identity. A delayed operation from an earlier
visit is rejected as a route conflict, is not stored as current evidence, and
cannot appear in the later fulfillment event.

Raw QR values, trace URLs, and trace tokens are never stored in operation
receipts or logs. A receipt can keep the operation payload hash, internal run
and stop identifiers, the bounded outcome, and audit timestamps needed for
idempotency and support. Logs and cron responses contain aggregate counts only.

## Handoff and fulfillment lifecycle

1. The driver opens the current physical stop. The API derives its expected
   harvest manifest from the stop group and the `delivery_run_stops` trace
   snapshots captured when the run was planned.
2. Live QR scans and explicit no-label, missing, or skipped actions are sent as
   idempotent operations. Each item succeeds or fails independently.
3. The server verifies assignment or administrator authority, the current
   physical stop, and the trace-to-stop relationship before recording an
   advisory result.
4. The UI can rebuild the latest manifest from the server after a refresh. A
   lost device cache therefore does not erase successful or skipped results.
5. The driver can fulfill the stop with zero, partial, or complete QR coverage.
   Handoff verification is evidence, not a delivery gate.
6. The final per-stop advisory state and the delivery fulfillment event follow
   the normal delivery and account-history lifecycle. They remain available as
   long as the corresponding operational delivery history remains available.

Invalid and wrong-stop attempts are bounded audit outcomes, not manifest
changes. Network failures leave the operation retryable. A retry with the same
operation identifier is safe even if the first response was lost.

## Retention cleanup

The delivery tracking retention cron at
`apps/api/app/api/internal/cron/delivery-tracking-retention/route.ts` also
deletes noisy handoff attempt and idempotency rows after a run has been
completed for 90 days. Cleanup is bounded per invocation so one cron request
cannot perform an unbounded delete. Empty cleanup is a successful no-op.

Only attempt and idempotency receipts are subject to this 90-day cleanup. The
manifest's final per-stop advisory state and normal fulfillment history are not
deleted by this cron; they follow the delivery/account lifecycle described
above. The route preserves its existing bearer-secret authentication and
`private, no-store` response policy, and reports only sanitized aggregate
counts. Cleanup failures return a generic failure response and do not expose
operation, run, stop, driver, trace, or customer data.

## Validation

Use focused storage and API coverage for:

- assignment and administrator authorization, including cross-run and
  cross-stop denial;
- every advisory result and attempt outcome;
- exact idempotent replay, conflicting reuse, bulk partial results, and retry
  after a lost response;
- refresh reconstruction from persisted state and fulfillment with zero scans;
- 90-day boundary behavior, bounded cleanup, and counts-only cron responses;
- proof that operation receipts and logs contain no raw QR value.

From the repository root, run the narrowest applicable checks:

```sh
pnpm --filter @gredice/storage test:node
pnpm --filter delivery test:unit
pnpm --filter delivery typecheck
pnpm --filter api build
git diff --check
```
