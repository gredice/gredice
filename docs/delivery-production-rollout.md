# Delivery production rollout and evidence runbook

This runbook is the release gate for the delivery epic
[#4120](https://github.com/gredice/gredice/issues/4120). It covers the driver,
admin, customer, route, tracking, offline, exception, QR, and notification
flows. Automated checks establish code behavior; they do not replace a
physical-device run against the deployed production build.

## Operational entry points

- `/admin/delivery/operations` is admin-only. It shows a bounded 24-hour view
  of active and recent routes, tracking freshness, reroute age, persisted route
  source, abandoned routes, exception outcomes, and action replay delay.
- `/admin/delivery/notifications` is the existing admin-only notification
  health and diagnostics view. Do not duplicate notification receipts or
  provider details in the route view.
- The delivery project's server logs emit the stable message
  `Delivery route fallback selected`. Group it by `phase` and `errorCode`.
  Allowed dimensions are `provider`, `fallback`, `phase`, `errorName`,
  `errorCode`, and `nodeCount`.
- Pickup, handoff, arrival, completion, and exception command failures use
  their existing named log messages with bounded `errorName`, `errorCode`, and
  mutation counts. They may include only an opaque route, stop, or pickup-node
  ID needed for private diagnosis; they never include the authenticated driver
  ID or a raw error.
- Notification health logs use the stable messages documented in
  [Delivery notification lifecycle](./delivery-notification-lifecycle.md),
  including `Delivery notification systemic channel failure`,
  `Delivery notification retries exhausted`, and
  `Delivery notification eligible queue is stale`.

The operations view and server log streams are private operational surfaces.
Do not publish them in customer APIs or analytics dashboards.

## Data minimization contract

Aggregate health contains counts, rates, bounded age values, state/source
enums, and time windows only. The admin diagnostic list additionally contains
an opaque route ID because an operator needs it to recover a specific route.
Exception receipts are reduced inside PostgreSQL to bounded `outcome` and
`reason` values before application code receives them; the query never selects
the stored request or stop identifiers. These operational projections and the
named logs above must never select or log:

- exact or rounded GPS coordinates, polylines, addresses, contact details, or
  customer/account/driver identifiers;
- delivery notes, exception notes, abandonment reasons, provider response
  bodies, raw `Error` objects, stack traces, or preparation summaries;
- QR/trace values, queue entries, client operation IDs, or payload digests.

Diagnostics default to the last 24 hours, reject windows over 30 days, cap the
result at 200 records, and fail closed for invalid limits or dates. The admin
page does not accept an unbounded search parameter.

Pending actions that have not left a phone are not known to the server. The
driver UI is the source of truth for the live local queue count. Once an action
reaches the server, the operations view can identify a replay delayed by five
minutes or more from its data-minimized receipt. An absent receipt means
**unknown**, not zero pending actions.

## Initial thresholds and operator response

These thresholds are release gates for the first canary. Revisit them only from
recorded evidence; do not loosen them during an incident.

| Signal | Initial classification | Operator query and response |
| --- | --- | --- |
| Tracking receipt age at most 30 seconds | Healthy | Confirm `Uživo` in `/admin/delivery/operations`; no action. |
| Tracking receipt age over 30 through 120 seconds | Warning | Open the opaque route diagnostic; ask the driver to keep the route visible and confirm GPS/network recovery. |
| Tracking receipt age over 120 seconds, or no first receipt 120 seconds after start | Critical | Treat exact customer tracking as unavailable. Confirm the driver UI says delayed/offline and use the recovery protocol below. |
| Reroute pending for 10 minutes | Critical | Inspect route state by opaque route ID. Retry or recover through the existing admin workflow; never edit route rows manually. |
| Active route without server activity for 60 minutes | Critical | Contact the driver, inspect their local queue state, then recover, reassign, or abandon through audited controls. |
| Local route source at least 25% of at least four modern active/recent plans | Warning | Search `Delivery route fallback selected`, group by `phase,errorCode`, and verify Google Maps credentials/quota/provider health. Local routing remains a supported fallback, not a silent success. |
| Applied action replayed five minutes or more after it occurred | Warning | Confirm connectivity recovery and that the driver queue drains without conflict. Use the route ID only in private diagnostics. |
| Abandoned route or bounded exception outcome | Informational | Reconcile the audited outcome and recovery state. Alert only on a sustained canary pattern, not a single expected exception. |
| Notification systemic failure, exhausted retry, stale eligible queue, or ambiguous acceptance | Existing notification severity | Use `/admin/delivery/notifications` and the notification runbook; do not infer delivery failure from channel failure alone. |

### Log query recipes

Run these in the private log explorer for the named Vercel project and deployed
commit. Save a shareable private query URL or screenshot with customer data
redacted.

1. Delivery route fallbacks: exact message
   `Delivery route fallback selected`, time range matching the canary, grouped
   by `phase` and `errorCode`. Compare the result with the persisted local
   source numerator and modern-plan denominator on the admin page.
2. Route start failures: exact messages `Delivery run preflight rejected`,
   `Delivery run preflight failed`, and `Failed to start delivery run`, grouped
   by the bounded `errorName` and `errorCode` fields.
3. Notification failures: exact messages listed above, grouped only by channel,
   counts, rates, and bounded window. Use the notification admin timeline for
   an authorized per-request diagnosis.

If any query includes an address, coordinate, customer/driver identity, raw
provider response, exception message, or stack, stop the rollout and treat it
as a privacy incident.

## Pre-deployment gate

- [ ] The change has a reviewed PR, green required checks, and an immutable
      commit SHA for the candidate deployment.
- [ ] Delivery, API, app, storage, and affected shared-package tests pass for
      the candidate SHA.
- [ ] `/admin/delivery/operations` and `/admin/delivery/notifications` return
      private, no-customer-data diagnostics to an admin and reject a normal
      user.
- [ ] The route fallback test proves that raw error messages, addresses, and
      coordinates are absent from structured metadata.
- [ ] The driver and customer journey suite from
      [#4146](https://github.com/gredice/gredice/issues/4146) is linked. If that
      issue is still open, the rollout cannot advance beyond synthetic testing.
- [ ] All rows in the physical-device matrix below have deployed-build
      evidence. Pending is a release blocker, not an implicit pass.
- [ ] Notification producers remain disabled until their defaults/backfill and
      separate channel gate in the
      [notification runbook](./delivery-notification-lifecycle.md) are complete.

## Staged rollout

### Stage 0 — deployed, no production route assignment

1. Deploy the candidate SHA and verify both admin views with an admin account.
2. Run a synthetic route with non-customer addresses and accounts. Exercise
   pickup QR, advisory handoff QR, arrival, delivery, exception/retry, and
   abandonment recovery.
3. Confirm the operations view changes only through bounded metadata and that
   the notification view remains independent.
4. Complete the existing
   [driver action checklist](./delivery-driver-mobile-validation.md) and
   [tracking protocol](./delivery-tracking-mobile-validation.md) on every
   supported target.

Exit only when there are no critical alerts, every synthetic action is
reconciled, and the four physical rows are signed off.

### Stage 1 — one controlled route

1. Assign one trained driver/admin to one operationally selected route and time
   slot. Do not broaden the user's role or expose the admin diagnostics.
2. Observe route planning, every pickup, GPS freshness, current-stop actions,
   customer live/stale/recovery behavior, and the final receipt from both
   perspectives.
3. Record the candidate SHA, deployment URL, time window, generic tester role,
   device/browser versions, and sanitized outcomes in the evidence ledger.
4. Hold for one full route plus 30 minutes so delayed replays, reroutes, and
   notification receipts can settle.

Exit only with zero critical alerts, no unresolved local queue items, no
privacy leak, and all expected customer states reconciled.

### Stage 2 — limited delivery wave

1. Expand by operational assignment to one delivery wave while preserving a
   clear control group and the existing manual recovery process.
2. Review the admin operations and notification views before the wave, during
   every active route, and 30 minutes after the last completion.
3. Calculate fallback and exception rates only when their minimum denominator
   is met. Preserve the exact private log query and time window as evidence.
4. Repeat one weak-connectivity recovery and one customer stale/recovery check
   without using real customer data in screenshots or notes.

Exit only after two consecutive waves meet the initial thresholds.

### Stage 3 — general availability

1. Expand normal route assignment only after Stages 0–2 and every feature row
   in the evidence ledger are signed off.
2. Enable notification producer/email/reconciliation flags only through their
   coordinated, default-off rollout. Enable notification health monitoring at
   the same time.
3. Review alerts daily for the first seven delivery days. Any threshold change
   needs a dated evidence link and reviewer.

## Rollback checklist

Trigger rollback for any privacy leak, inaccessible primary driver action,
incorrect delivery completion, unreconciled duplicate, repeated critical GPS
or reroute signal, systemic notification failure, or failed physical-device
gate.

- [ ] Stop assigning new delivery routes; do not delete active or historical
      route records.
- [ ] Tell active drivers to keep the route visible and finish only if the
      current state is safe and reconciled. Otherwise use audited admin
      reassign, recover, retry, or abandon controls.
- [ ] Disable `GREDICE_DELIVERY_NOTIFICATIONS_ENABLED` in both delivery and API
      projects before disabling email or reconciliation workers. Preserve
      receipts for diagnosis.
- [ ] If code rollback is required, promote the last known-good Vercel
      deployment for each affected project. Record both SHAs and deployment
      URLs; do not mix unverified app/API/storage versions.
- [ ] Confirm customer tracking becomes truthfully delayed/offline and retains
      only its permitted cached summary; never claim a stale point is live.
- [ ] Re-run both admin queries for the incident window, save sanitized
      aggregate evidence, and link the incident/issue.
- [ ] Re-enter at Stage 0 after the fix. A previous physical-device pass does
      not cover a changed camera, GPS, offline queue, or primary action flow.

## Physical driver and customer evidence matrix

Follow the detailed protocols in
[Delivery driver mobile validation](./delivery-driver-mobile-validation.md) and
[Delivery mobile tracking validation](./delivery-tracking-mobile-validation.md).
Use the production deployment, not emulation. Camera testing must include fast
multi-scan pickup and advisory destination verification. Weak-connectivity
testing must prove queued actions remain idempotent and the UI never reports an
unknown server state as synchronized.

| Supported target | Driver route, camera, and current stop | Weak network and queue recovery | GPS foreground, resume, and truthful stale state | Customer live, stale/recovery, and receipt | Evidence | Sign-off |
| --- | --- | --- | --- | --- | --- | --- |
| iPhone, Safari tab | Pending | Pending | Pending | Pending | Pending | Pending |
| iPhone, Home Screen | Pending | Pending | Pending | Pending | Pending | Pending |
| Android, Chrome tab | Pending | Pending | Pending | Pending | Pending | Pending |
| Android, installed PWA | Pending | Pending | Pending | Pending | Pending | Pending |

For each row record device model, exact OS/browser version, installation mode,
candidate SHA, deployment URL, date/time window, anonymized tester role,
sanitized observations, and evidence links. Never record a serial/device name,
account ID, route ID, address, coordinate, or raw log payload.

## Feature evidence ledger

Every row needs an exact green CI run or test artifact and a deployed-build
evidence link before the epic closes. A closed implementation issue is not by
itself production evidence. Keep `Pending` until a person has run and reviewed
the deployed flow.

| Feature issue | Automated validation | Deployed production evidence |
| --- | --- | --- |
| [#4121](https://github.com/gredice/gredice/issues/4121) mixed pickup preflight | [PR #4170](https://github.com/gredice/gredice/pull/4170) and [checks](https://github.com/gredice/gredice/pull/4170/checks) | [Verified deployed descendant](https://github.com/gredice/gredice/issues/4125#issuecomment-4980317995) |
| [#4122](https://github.com/gredice/gredice/issues/4122) persisted pickup nodes/slots | [PR #4172](https://github.com/gredice/gredice/pull/4172) and [checks](https://github.com/gredice/gredice/pull/4172/checks) | [Verified deployed descendant](https://github.com/gredice/gredice/issues/4125#issuecomment-4980317995) |
| [#4123](https://github.com/gredice/gredice/issues/4123) pickup/customer route plan | [PR #4174](https://github.com/gredice/gredice/pull/4174) and [checks](https://github.com/gredice/gredice/pull/4174/checks) | [Verified deployed descendant](https://github.com/gredice/gredice/issues/4125#issuecomment-4980317995) |
| [#4124](https://github.com/gredice/gredice/issues/4124) pickup manifests | [PR #4179](https://github.com/gredice/gredice/pull/4179) and [checks](https://github.com/gredice/gredice/pull/4179/checks) | [Verified deployed descendant](https://github.com/gredice/gredice/issues/4125#issuecomment-4980317995) |
| [#4125](https://github.com/gredice/gredice/issues/4125) exception outcomes/audit | [PR #4181](https://github.com/gredice/gredice/pull/4181) and [checks](https://github.com/gredice/gredice/pull/4181/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4125#issuecomment-4980317995) |
| [#4126](https://github.com/gredice/gredice/issues/4126) retry/reroute | [PR #4182](https://github.com/gredice/gredice/pull/4182) and [checks](https://github.com/gredice/gredice/pull/4182/checks) | [Exact API/app and delivery descendant](https://github.com/gredice/gredice/issues/4126#issuecomment-4981679742) |
| [#4127](https://github.com/gredice/gredice/issues/4127) recovery UX | [PR #4187](https://github.com/gredice/gredice/pull/4187) and [checks](https://github.com/gredice/gredice/pull/4187/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4127#issuecomment-4982492033) |
| [#4128](https://github.com/gredice/gredice/issues/4128) tracking privacy/retention | [PR #4190](https://github.com/gredice/gredice/pull/4190) and [checks](https://github.com/gredice/gredice/pull/4190/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4128#issuecomment-4982958711) |
| [#4129](https://github.com/gredice/gredice/issues/4129) GPS retry/sync state | [PR #4192](https://github.com/gredice/gredice/pull/4192) and [checks](https://github.com/gredice/gredice/pull/4192/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4129#issuecomment-4983531400) |
| [#4130](https://github.com/gredice/gredice/issues/4130) offline route/actions | [PR #4196](https://github.com/gredice/gredice/pull/4196) and [checks](https://github.com/gredice/gredice/pull/4196/checks) | [Verified deployed descendant](https://github.com/gredice/gredice/issues/4132#issuecomment-4986615548) |
| [#4131](https://github.com/gredice/gredice/issues/4131) visibility/wake lock | [PR #4198](https://github.com/gredice/gredice/pull/4198) and [checks](https://github.com/gredice/gredice/pull/4198/checks) | [Code deployed; physical tracking and battery evidence pending](https://github.com/gredice/gredice/issues/4131#issuecomment-4985469863) |
| [#4132](https://github.com/gredice/gredice/issues/4132) current-stop command center | [PR #4199](https://github.com/gredice/gredice/pull/4199) and [checks](https://github.com/gredice/gredice/pull/4199/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4132#issuecomment-4986615548) |
| [#4133](https://github.com/gredice/gredice/issues/4133) compact progress | [PR #4200](https://github.com/gredice/gredice/pull/4200) and [checks](https://github.com/gredice/gredice/pull/4200/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4133#issuecomment-4986667738) |
| [#4134](https://github.com/gredice/gredice/issues/4134) bulk/mobile accessibility | [PR #4204](https://github.com/gredice/gredice/pull/4204) and [CI run](https://github.com/gredice/gredice/actions/runs/29483868107) | [Code deployed; physical one-handed evidence pending](https://github.com/gredice/gredice/issues/4134#issuecomment-4989939719) |
| [#4135](https://github.com/gredice/gredice/issues/4135) customer-safe DTO | [PR #4216](https://github.com/gredice/gredice/pull/4216) and [checks](https://github.com/gredice/gredice/pull/4216/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4135#issuecomment-4990986564) |
| [#4136](https://github.com/gredice/gredice/issues/4136) ETA/progress/freshness | [PR #4219](https://github.com/gredice/gredice/pull/4219) and [checks](https://github.com/gredice/gredice/pull/4219/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4136#issuecomment-4992052356) |
| [#4137](https://github.com/gredice/gredice/issues/4137) active/upcoming/history | [PR #4220](https://github.com/gredice/gredice/pull/4220) and [checks](https://github.com/gredice/gredice/pull/4220/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4137#issuecomment-4992355307) |
| [#4138](https://github.com/gredice/gredice/issues/4138) cached/accessibility state | [PR #4221](https://github.com/gredice/gredice/pull/4221) and [checks](https://github.com/gredice/gredice/pull/4221/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4138#issuecomment-4993055466) |
| [#4139](https://github.com/gredice/gredice/issues/4139) notification lifecycle | [PR #4222](https://github.com/gredice/gredice/pull/4222) and [checks](https://github.com/gredice/gredice/pull/4222/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4139#issuecomment-4993726554) |
| [#4140](https://github.com/gredice/gredice/issues/4140) notification channels | [PR #4223](https://github.com/gredice/gredice/pull/4223) and [checks](https://github.com/gredice/gredice/pull/4223/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4140#issuecomment-4995657261) |
| [#4141](https://github.com/gredice/gredice/issues/4141) notification observability | [PR #4225](https://github.com/gredice/gredice/pull/4225), [checks](https://github.com/gredice/gredice/pull/4225/checks), and [main CI](https://github.com/gredice/gredice/actions/runs/29539025068) | [Exact production evidence](https://github.com/gredice/gredice/issues/4141#issuecomment-4997218230) |
| [#4142](https://github.com/gredice/gredice/issues/4142) handoff audit data | [PR #4201 checks](https://github.com/gredice/gredice/pull/4201/checks) and [corrective PR #4202 checks](https://github.com/gredice/gredice/pull/4202/checks) | [Exact corrective production evidence](https://github.com/gredice/gredice/issues/4142#issuecomment-4987340588) |
| [#4143](https://github.com/gredice/gredice/issues/4143) resilient handoff manifest | [PR #4203](https://github.com/gredice/gredice/pull/4203) and [checks](https://github.com/gredice/gredice/pull/4203/checks) | [Production deployment evidence](https://github.com/gredice/gredice/issues/4143#issuecomment-4987761051) |
| [#4144](https://github.com/gredice/gredice/issues/4144) customer handoff receipt | [PR #4206](https://github.com/gredice/gredice/pull/4206) and [checks](https://github.com/gredice/gredice/pull/4206/checks) | [Exact production evidence](https://github.com/gredice/gredice/issues/4144#issuecomment-4990821783) |
| [#4145](https://github.com/gredice/gredice/issues/4145) orchestration characterization | [PR #4168](https://github.com/gredice/gredice/pull/4168) and [checks](https://github.com/gredice/gredice/pull/4168/checks) | [Verified deployed descendant](https://github.com/gredice/gredice/issues/4125#issuecomment-4980317995) |
| [#4146](https://github.com/gredice/gredice/issues/4146) driver/customer journeys | [Owner-approved exact-tree local gate](https://github.com/gredice/gredice/pull/4226#issuecomment-4997376332) after a GitHub REST outage | [Exact production evidence](https://github.com/gredice/gredice/issues/4146#issuecomment-4997395607) |
| [#4147](https://github.com/gredice/gredice/issues/4147) observability/rollout | Operations projection/log privacy tests and this checklist | Pending until this change is merged and deployed |

Evidence is complete only when the linked artifact identifies the tested SHA
and the production record identifies the same deployed SHA. If they differ,
repeat the affected checks.
