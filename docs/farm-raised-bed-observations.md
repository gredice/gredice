# Farmer raised-bed observations

Tracked by Uredan task `71e0a5f5-5446-4d81-92f6-686e18d9f961`.

Farmers open an existing raised-bed detail page and choose **Zabilježi opažanje**.
The default target is the whole bed. The optional plant picker identifies an exact
legacy field/crop cycle or a selected planting, including multi-field and co-plant
layouts. Observations accept text, photographs, or both (2,000 characters and up
to 20 photographs, each at most 25 MB).

Submission atomically creates a normal operation scheduled at the server's
current time, assigned to its author and already awaiting verification. Admins
review its notes and photographs in the existing daily Schedule and use the
ordinary verification, evidence-editing and rejection controls. Farmer submission
never verifies work, including when the author is an administrator. Verifying an
observation never changes a plant's lifecycle; observations can describe a plant
before sowing and remain reviewable after its lifecycle changes.

## UX impact

This extends the existing bed-detail, proof-upload and admin-verification journeys
without adding navigation or a recurring schedule step. Capture is occasional
and initiated by the farmer. Alternatives rejected: a separate observation inbox
(duplicate review flow), plant-status requests (cannot represent free text/photos),
and scheduling unfinished work (the farmer has already made the observation).

The modal uses existing shared Button, Modal and Alert primitives. It supports
keyboard entry, focus return, native touch/gallery selection and narrow screens.
Empty submissions are disabled; abandoned beds disable capture. Submission locks
editing and closing while pending. Errors retain the text, selected identity,
photos, uploaded URLs and submission ID for a retry. Closing the modal preserves
its draft only while the page remains mounted; there is no durable offline queue
for new observations. An unconfirmed submission response locks the exact target,
text, photos and receipt until an identical retry succeeds. This also applies to
unexpected server errors that may occur after commit; later rejections cannot
prove the original command did not commit. Closing and reopening preserves that
retry, even if the plant options change or the bed becomes unavailable. A known
pre-commit rejection still permits editing. While editing is available, a removed
exact plant selection must be chosen again. Reordering options cannot change the
submitted identity.

## Persistence and access

Both the upload-token route and submission boundary validate current farm access,
stored user role, non-deleted farm/garden/bed, sandbox exclusion, abandonment and
exact crop identity. Account, farm and garden IDs come from storage. Blob paths
are bound to the author, bed and submission, with one UUID filename. Before issuing
a token, storage durably reserves one of at most 20 paths per author/submission,
serialized with submission by the same advisory lock. Repeated requests reuse a
slot; removed and failed uploads do not free slots. Tokens disable random suffixes
and overwrite, so each slot can create only one blob, and no more tokens are
issued after submission. An upload whose response was lost is recovered by exact
path and validated Blob metadata. The budget is per submission, not a global
per-farmer quota. `raisedBed.observation.imageReserved` records these slots in the
existing event table; no schema migration is needed. Submission
checks allowlisted image hosts and existing Blob metadata, image content type,
path and size. Text is displayed through the existing plain-text evidence UI.

The first submission provisions the internal `raisedBedObservation` operation
definition inside the same transaction, using existing operation attribute
definitions. It has zero duration, no deliverable and no automatic/all-target
application. Directory and schedule caches are invalidated after commit. No
schema change, migration, external catalogue command or production seed is needed.
Environments must already have the standard operation attribute definitions.

`operation.observation.recorded` retains the submitted target on the operation's
indexed event aggregate. `raisedBed.observation.submitted` retains an actor-scoped
submission receipt and content fingerprint. Retrying an identical command returns
the original operation, even after its plant changes; changing the content of an
already committed command is rejected. Different observations use fresh UUIDs.

## Whole-journey verification

- Browser component tests cover whole-bed text capture, selected plants,
  photo-only upload and retry without re-upload, pending close protection,
  lost upload/submission responses, locked retries after plant refresh,
  empty/invalid inputs, photo removal, cancellation, refreshed plant options,
  abandoned beds, mobile layout, keyboard focus and accessibility.
- Storage integration tests cover the real schedule projection and ordinary
  admin verification, farmer verification denial, exact crop targets, pre-sowing
  multi-field plants, unchanged plant lifecycle, stale identity, inaccessible and
  sandbox/abandoned beds, photo evidence and duplicate/concurrent retries.
  Upload reservations cover inaccessible targets, forged roles/paths, durable
  duplicate slot reuse, concurrent requests at the cap and post-submission denial.
- Existing plant-status browser tests and schedule-submission/advanced-sowing
  storage tests cover adjacent regressions. Shared contract unit tests validate
  content bounds, upload paths and Blob metadata.
- Farm production build and farm/admin consumer type checks validate integration.
  PGlite skips the existing Postgres-only lock-order race tests; PostgreSQL CI
  remains the authority for those tests. Live Blob/provider and production
  acceptance are separate from these deterministic local checks.
