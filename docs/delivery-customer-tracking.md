# Customer delivery promise and tracking

The delivery customer dashboard answers three separate questions with separate,
data-minimized fields:

1. What time window did Gredice promise?
2. What is the current ETA and how trustworthy is it?
3. How far through the physical route is this delivery?

The UI must not present an incoming route leg as the remaining time to a
customer. Driver-only distance and leg-duration fields stay outside the
customer DTO.

## Dashboard organization and owned context

Each customer request carries a server-derived `lifecycle` value. Deliveries
on an active run remain `active` even when their detailed progress fails closed
to unavailable; unresolved requests are `upcoming`; completed, cancelled, and
non-recoverable failed requests are `history`. A failed request with an active
HQ pickup window remains upcoming so its deadline is not buried. Pickup
requests are upcoming or history and never create live-driver expectations.

The dashboard renders the sections in this order:

1. active delivery, including every account-owned harvest at the current bulk
   stop and the authorized map when available;
2. upcoming requests and required recovery actions, earliest first;
3. completed history, newest first, while request-specific recovery entries
   remain ahead of ordinary receipts.

Only the first six full history cards are mounted initially. The customer can
progressively reveal the remainder and collapse back to the initial page.
Empty states are scoped to their section instead of replacing useful content
from the other sections.

The customer delivery DTO includes only the account-owned recipient name,
formatted destination address and optional address label. Customer-entered
delivery instructions remain visible. Phone numbers, driver notes, other
recipients in a bulk stop, stop identifiers, and run identifiers remain
excluded. Delivery, pickup, receipt, and recovery support links prefill the
exact owned request and harvest/trace reference without adding destination or
recipient data to the message.

## Cached dashboard and announcements

The customer dashboard keeps the last successful React Query response mounted
during an offline period or transient background refresh failure. This is an
authenticated, in-memory session cache only: customer recipient, destination,
harvest, and tracking data are not persisted to local storage. The query key is
scoped to the authenticated user, and logout removes delivery-dashboard query
data before another session can render.

A full-screen error is reserved for the initial request when no dashboard has
ever loaded. When last-known content exists, a customer-specific warning shows
the server-provided `refreshedAt` time and offers an in-place retry without
unmounting active, upcoming, or historical requests. Invalid refresh timestamps
fail the runtime response guard. Reconnecting keeps the warning visible until a
newer server response succeeds; a cached or paused query cannot produce a false
recovery. A cold offline customer request goes directly to the initial error,
while drivers get a bounded grace period for their persisted route to load.
Successful automatic recovery is announced politely without moving focus;
recovery after a customer-triggered retry moves focus to the confirmation so
the completed action is unambiguous.

Routine ETA, progress, and tracking-state changes use polite status regions.
Polling-only GPS timestamps and ETA calculation timestamps remain visible as
ordinary `<time>` content outside those live regions, so a refresh does not
reannounce an otherwise unchanged state. Driver arrival and loss of a usable
dashboard remain assertive. These announcement rules do not extend exact-map
retention: an already-rendered map still unmounts at the server-calculated TTL.

## Promised window

Every delivery card renders the complete `slotStartAt`–`slotEndAt` window. A
malformed legacy record renders an explicit unavailable message rather than
hiding the row.

## ETA contract

Customer delivery responses expose an `eta` object:

- `source`: `traffic-route`, `route-plan`, or `promised-window`;
- `calculatedAt`: server calculation time when a route estimate is used;
- `freshness`: `fresh`, `stale`, `fallback`, or `unavailable`;
- `confidence`: `high`, `approximate`, or `none`;
- absolute range boundaries and remaining minimum/maximum seconds.

A fresh traffic-aware Google estimate on a legacy route is presented as a
deterministic display range from five minutes before to ten minutes after the
point estimate. The lower boundary never precedes the current server projection
time, and the range always retains at least five minutes. This is a display
policy, not a statistical confidence interval.

The traffic-aware state is derived only from constructible persisted evidence.
For a legacy-format run, a GPS refresh or reroute through Google Routes must
have left a marked, reversible encoded-polyline artifact, tracking must have an
accepted location and must still be live or delayed, and the estimate
calculation must still be fresh. Initial and unmarked legacy polylines are never
treated as traffic provenance. The local estimator never creates the marker
and explicitly clears any older Google artifact when its fallback is persisted.
A legacy route without the marked artifact therefore falls back to the promised
window. Pickup-aware Google plans use the separate approximate route-plan state.

Pickup-aware route plans are not recalculated after every GPS update. Their
fresh Google estimate is therefore labeled as an approximate `route-plan`, even
while GPS is live. Local, legacy, stale, rerouting, unknown, and malformed
estimates fall back conservatively to the complete promised window. A genuinely
late fresh ETA is never clamped back into that window.

Once the promised window has passed, it remains visible as the original promise
but is no longer reused as a current ETA. The customer instead sees that the
term has passed and that a new estimate is unavailable. Cross-day promised and
ETA ranges include enough date context to avoid presenting next-day times as if
they were on the same day. Stale route timestamps are labeled as the last route
calculation, not as the calculation time of the substituted promised window.

The shared exact-location TTL is also the route-estimate freshness horizon:
two minutes from the server calculation timestamp. Future timestamps fail
closed. Consuming a short-lived prepared route preserves the preparation's
original calculation time instead of resetting freshness at activation.

## Privacy-safe progress

The `progress` object exposes only a phase, a nonnegative `stopsAhead` count,
and a delayed flag. The count comes from authoritative unfinished execution
checkpoints before the customer checkpoint:

- one same-address/time-slot bulk group counts once;
- pickup and retry checkpoints count as generic stops;
- completed checkpoints do not count;
- no stop ID, checkpoint kind, address, customer identity, route polyline, or
  coordinate is exposed.

The server uses only the presence of the marked persisted route artifact as
internal provenance evidence. The polyline and marker are not included in the
customer DTO.

Only a server-confirmed current physical customer group can receive the exact
map proxy. Later customers receive the safe count and ETA without another
customer's location.

## Tracking freshness

Tracking remains orthogonal to ETA and progress:

- `live`: accepted by the server within 30 seconds;
- `delayed`: older than 30 seconds but still within the two-minute exact-data
  TTL;
- `offline`: past the TTL, with the exact map suppressed;
- `unavailable`: no accepted active-run location.

Customer responses include only status, last accepted time, map availability,
and the server-calculated milliseconds remaining before exact-location expiry.
Raw latitude, longitude, accuracy, heading, and speed remain behind the
authorized current-stop map proxy.

The customer client independently unmounts an already-rendered exact map after
the server-calculated TTL remainder. It subtracts request, response, and render
elapsed time using a monotonic request timer, with a nonnegative wall-time delta
only as a conservative sleep fallback. Absolute customer device time is never
compared with a server timestamp, and a delayed response cannot extend exact
location visibility. The same elapsed-time calculation changes a cached `live`
snapshot to `delayed` at the 30-second boundary even when dashboard polling
stalls. Malformed tracking or ETA timestamps, impossible tracking states,
numeric ranges, or illegal source/freshness/confidence combinations fail the
runtime response guard before rendering.

Dashboard and map responses use `Cache-Control: private, no-store`.
