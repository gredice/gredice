# Delivery notification lifecycle

This contract defines the customer-safe facts that can become delivery updates.
It does not send customer messages by itself. Croatian templates, deep links,
and channel producers consume these events in the next implementation slice.
Internal Slack notifications remain a separate workflow.

## Milestones and authoritative triggers

| Milestone | Authoritative trigger | Idempotency scope |
|---|---|---|
| `route-started` | Delivery run enters its started state | delivery request + run |
| `near-arrival` | The route's maximum ETA first enters 30 minutes or less | delivery request + run + retry attempt |
| `next-stop` | The request's physical stop becomes next (`stopsAhead` enters zero) | delivery request + run + retry attempt |
| `delayed` | Route lateness first reaches 15 minutes | delivery request + run + retry attempt |
| `arrived` | The server applies the driver's arrival operation | delivery request + run + retry attempt |
| `delivered` | The server fulfills the delivery request | delivery request + run |
| `exception` | The server applies a bounded stop exception outcome and reason | delivery request + run + retry attempt |
| `recovery` | The server opens the next retry attempt for an excepted stop | delivery request + run + new retry attempt |

Every event uses the optional `delivery_updates` preference category. Its
in-app, email, and push defaults are enabled, non-required, and non-digestible.
Configured quiet hours defer delivery through the existing notification router.
Customer-facing controls remain hidden until the templates and producers ship,
so this contract does not promise messages before the next slice is enabled.

## Ordering, thresholds, and retries

Route progress is ignored before `route-started`, while an exception is active,
and after arrival or delivery. Arrival must precede delivery, and delivery is
terminal. Recovery is valid only for the next retry attempt and resets the
near-arrival, next-stop, and delay threshold latches for that attempt.

Near-arrival emits once when the maximum ETA is at most 30 minutes. Delay enters
at 15 minutes late and clears only after lateness falls to 5 minutes or less.
The stable idempotency key still permits at most one notification for each
threshold and retry attempt, so ETA oscillation cannot repeatedly notify a
customer. A source replay produces the same key; ETA values, source identifiers,
timestamps, and route revisions are deliberately excluded from it.

`route-started` and `delivered` keys span all attempts. The remaining keys add
the retry attempt. All keys include opaque account, run, stop, and delivery
request identifiers with a versioned milestone. The storage repository hashes
this key into a bounded notification ID and reuses the first row on a repeated
domain event. The repository serializes the notification row, router attempts,
and push queue attempts under one database advisory lock. Concurrent retries
and replays therefore reuse one customer notification and one attempt per
channel.

## Minimal payload and retention

The event envelope contains only:

- contract version and milestone;
- opaque account, request, run, and stop identifiers;
- retry attempt and canonical occurrence timestamp;
- opaque authoritative source ID, source kind, and source version;
- the bounded exception outcome and reason for `exception` only;
- the idempotency key.

It must not contain coordinates, an address, access instructions, customer or
driver contact details, raw QR values, harvest trace tokens, or data about other
customers. Templates resolve any needed display data only at the authenticated
delivery boundary.

Notification delivery attempts and delivery events use the existing 180-day
cleanup policy. Notification rows continue to follow the platform's existing
notification-retention behavior; this contract does not claim or add a new row
deletion schedule.

Before producers are enabled, the rollout must materialize the new defaults for
existing users. Newly inserted delivery preferences inherit the user's newest
complete global quiet-hours window, while existing delivery overrides remain
untouched. The backfill also preserves legacy master email opt-outs; runtime
fallback defaults alone do not consult the legacy email setting.
