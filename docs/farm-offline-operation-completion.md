# Farm offline operation completion

## Summary

Farm operators can finish a scheduled operation with notes and photographs even
when connectivity is unavailable or unreliable. The Farm app first stores one
immutable completion command on the current device and then sends that same
command when the authenticated app is open with connectivity.

This workflow covers operation completion only. Planting completion, blocker
reports, schedule caching, service-worker background synchronization, and farm
selection are outside its scope.

## Actors

- **Farm operator:** prepares and confirms the completion on a phone.
- **Farm app:** stores drafts and queued commands in IndexedDB, displays their
  state, and drains the queue while the authenticated app is in the foreground.
- **Farm Server Actions and upload route:** authenticate the current user,
  selected account, operation target, task version, requirements, and evidence.
- **Storage repository:** serializes completion under the operation lock and
  resolves keyed replays.
- **Vercel Blob:** stores completion photographs at deterministic paths.
- **Internal verifier:** reviews work whose domain state is
  `pendingVerification`; synchronization does not imply verification.

## Configuration

`farmOperationCompletionSyncMode` is a three-state Farm feature flag declared in
`apps/farm/app/flags.ts`:

| Mode | New local commands | Existing commands | Farmer UI |
| --- | --- | --- | --- |
| `off` | Uses the legacy online path | Does not drain | Existing records remain visible for recovery |
| `drain_only` | Uses the legacy online path | Drains in the foreground | Queue and resolution UI remain visible |
| `enabled` | Persists before any network work | Drains in the foreground | Full queue and resolution UI |

Production, development, and test default to `enabled` while Farm is in its
active pilot. A Vercel flag override can select another mode for rollback or
targeted testing.

The workflow uses the existing authenticated Farm session and Vercel Blob
configuration. It adds no database migration and no service-worker background
sync registration.

## Entry points

- `apps/farm/app/schedule/CompleteOperationModal.tsx` collects the proof and
  confirms the local handoff.
- `apps/farm/app/schedule/useOperationCompletionDraft.ts` serializes draft
  writes and performs the atomic draft-to-queue transition.
- `apps/farm/lib/offline/operationCompletionQueueStore.ts` owns IndexedDB queue
  records, claims, retries, tombstones, expiry, and session fences.
- `apps/farm/components/offline/OperationCompletionSyncProvider.tsx` drains the
  queue after authenticated mount, queue creation, `online`, `pageshow`, visible
  `visibilitychange`, or an explicit retry.
- `apps/farm/app/api/operations/images/upload/route.ts` authorizes exact
  deterministic Blob paths.
- `apps/farm/app/schedule/actions.ts` recovers uncertain uploads and submits or
  replays a completion.
- `packages/storage/src/repositories/scheduleTaskSubmissionsRepo.ts` is the
  completion source of truth and idempotency boundary.

## State model

| State | Meaning | Retained private content | Next transition |
| --- | --- | --- | --- |
| `saved_local` | Editable draft on this device; the farmer has not confirmed it | Notes and photographs | `queued` or discarded |
| `queued` | Immutable completion command waiting for a foreground send | Notes and photographs | `syncing`, `failed`, or expired |
| `syncing` | One tab owns a time-bounded IndexedDB claim | Notes, photographs, and recovered Blob URLs | `server_confirmed`, `failed`, or stale-claim recovery |
| `failed` | Retry is delayed or explicit farmer resolution is required | Notes and photographs until expiry or discard | `queued`, discarded, or expired |
| `server_confirmed` | The server returned the receipt for this exact submission ID | None; the record is a content-free tombstone | Automatic tombstone expiry |

The app must describe local persistence, transport, and domain verification as
different facts. A `server_confirmed` submission can still have the domain state
`pendingVerification`.

## Happy path

1. The modal saves notes and selected photographs as a device-local draft.
2. **Dovrši radnju** stops and flushes pending draft writes, then atomically
   converts that draft into a queue record. Its persisted submission UUID and
   attachment UUIDs never change during retry.
3. A foreground coordinator claims the record with IndexedDB compare-and-swap.
   Web Locks reduce duplicate work between tabs but are not the correctness
   boundary. While slow photographs are uploading, the active coordinator
   renews the exact claim; an expired or replaced claim cannot be renewed.
4. Each photograph uses one deterministic path derived from operation, entity,
   task version, submission UUID, and attachment UUID. Before retrying an
   uncertain upload, an authenticated recovery action checks that exact object.
5. The completion Server Action sends the persisted submission UUID. The
   storage repository runs under the operation lock:
   - the same UUID and canonical command returns the original receipt;
   - the same UUID with different content is a terminal conflict;
   - a different UUID against already-terminal work is a terminal conflict.
6. The client stores a content-free `server_confirmed` tombstone, refreshes the
   schedule, and reports the server receipt separately from
   `pendingVerification` or verified completion.

## Authentication and device isolation

Queue work is scoped to the exact `userId`, selected `accountId`, session
incarnation, and local writer generation returned by the authenticated claims
route. The coordinator fails closed until all values are available and checks
the scope before every local transition.

Successful logout revokes the session generation and purges only that session's
drafts and queue records. A delayed request or an older tab cannot mutate a
newer session. Work is never adopted automatically by another user, account, or
session.

## Failure handling

- Offline, network, Blob transport, and server-unavailable failures return the
  record to a retryable state with persisted bounded backoff.
- A stale `syncing` claim becomes claimable again after its lease expires.
- Assignment, authorization, task version, requirement, target status, or
  submission-content conflicts are resolution-required. The UI preserves the
  local evidence and offers review or explicit discard; it does not loop.
- Expired commands scrub notes, photographs, and URLs before reporting that
  farmer action is required.
- Discarding during or after an in-flight request only removes the local copy.
  The UI never claims that it canceled a command that may already have reached
  the server.
- If IndexedDB is unavailable or full, `enabled` mode does not start network
  work. The modal keeps the current form open and explains that it is not safely
  queued.

Blob upload and event append cannot be one transaction. A terminal conflict or
discard may therefore leave an unreferenced deterministic Blob. Cleanup must be
authenticated and may delete an object only after proving no completion event
references it. Until that cleanup exists, monitor orphan growth during the
pilot and never bulk-delete by path prefix alone.

## Foreground and mobile behavior

Synchronization runs only while an authenticated Farm page is open. The push
service worker remains notification-only. Phone copy therefore asks the farmer
to reopen the app with connectivity and stay in it while photographs are sent.

The app-wide banner and settings panel distinguish:

- saved only on this device;
- waiting for connectivity;
- sending;
- action required;
- receipt confirmed by the server.

The affected operation modal is gated by the same local record so another tab
or a late draft save cannot create a second completion. Controls are designed
for 320–430 px widths and use at least 44 px targets.

## Observability

`farm_completion_sync_state_changed` accepts only bounded properties:

- state and foreground trigger;
- queue-size, age, and attempt buckets;
- a controlled failure code.

Never include notes, labels, image names, Blob contents or URLs, task/operation,
account or user identifiers, coordinates, storage keys, pathnames, raw SDK
errors, or session fingerprints. Logs should report controlled codes and
counts, not serialized queue records.

Pilot review should compare queue age, retry counts, terminal conflict rate,
and successful receipts without joining them to private farmer content.

## Rollout and rollback

1. Keep production `enabled` while Farm is in its active pilot.
2. Record physical iOS standalone and Android Chrome results, including weak
   connectivity, background/force-close/reopen, lost response, and logout
   cases. Reopen GitHub task #4194 if a formal go/no-go gate is reinstated.
3. Review controlled telemetry and unreferenced Blob growth.
4. Retain `enabled` after the pilot only when the go/no-go record is approved;
   otherwise use the rollback sequence below.

To stop new queue creation while preserving farmer work, change `enabled` to
`drain_only`. Keep the app deployed until existing records reach a server
receipt or explicit resolution. Use `off` only after the queue is drained or
when the incident requires all automatic sends to stop; records remain visible
so support can guide recovery. Rehearse `enabled` to `drain_only` during the
pilot.

## Validation

Run the narrow checks from the repository root:

```bash
corepack pnpm --filter @gredice/storage test -- scheduleTaskSubmissionsRepo.node.spec.ts
corepack pnpm --filter farm exec tsc --noEmit
corepack pnpm --filter farm test:prepare
corepack pnpm --filter farm exec playwright test app/schedule/CompleteOperationModal.spec.tsx app/schedule/useOperationCompletionDraft.spec.tsx lib/offline/operationCompletionDraftStore.spec.tsx lib/offline/operationCompletionQueueStore.spec.tsx lib/offline/operationCompletionQueueSync.spec.tsx components/offline/OperationCompletionSyncProvider.spec.tsx
corepack pnpm --filter farm exec playwright test
corepack pnpm --filter farm build
git diff --check
```

Record physical device, operating-system, browser/PWA mode, connectivity case,
result, and observed copy in #4194. Automated browser success does not close the
real-device launch gate.
