# Premium notification taxonomy and preference matrix

This contract defines the canonical notification taxonomy for premium user controls,
channel defaults, and payload requirements. It is intended to unblock
schema/API/UI/router/bulk implementation for:

- GRE-312 (storage model)
- GRE-314 (rich payload)
- GRE-315 (preference-aware router)
- GRE-316 (bulk campaign delivery)
- GRE-322 (privacy and safety hardening)

## 1) Canonical dimensions

Every notification must carry the following dimensions:

- `domain`: `garden` | `weather_alerts` | `account_security` | `billing_order_delivery` | `reminders` | `digests` | `admin_campaigns` | `promotional`
- `eventType`: stable machine key for a concrete trigger.
- `priority`: `critical` | `high` | `normal` | `low`.
- `audienceType`: `single_user` | `segment` | `all_users`.
- `required`: boolean. `true` means user cannot disable all delivery for the event.
- `userDisableable`: boolean.
- `digestEligible`: boolean.
- `quietHoursEligible`: boolean.
- `marketing`: boolean (must be `false` for security/account-required events).

## 2) Channel policy model

Supported channels:

- `in_app`
- `email`
- `push`
- `digest`
- `bulk_campaign`

Per eventType, each channel gets one of:

- `required`: must attempt delivery if channel is available.
- `default_on`: enabled by default, user can opt out if event is disableable.
- `default_off`: disabled by default, user can opt in.
- `never`: channel is not valid for this event.

## 3) Preference matrix

| Domain | Event type (examples) | Priority | Required | User-disableable | Digest-eligible | Quiet-hours eligible | In-app | Email | Push | Digest | Bulk campaign |
|---|---|---|---:|---:|---:|---:|---|---|---|---|---|
| `account_security` | `auth_new_sign_in`, `auth_password_changed`, `auth_recovery_used`, `auth_mfa_changed` | critical | ✅ | ❌ | ❌ | ❌ | required | required | required | never | never |
| `account_security` | `legal_policy_update`, `privacy_incident_notice` | high | ✅ | ❌ | ❌ | ❌ | required | required | default_on | never | never |
| `billing_order_delivery` | `payment_failed`, `payment_refund_issued`, `invoice_ready` | high | ✅ | ❌ | ❌ | ❌ | required | required | default_on | never | never |
| `billing_order_delivery` | `delivery_status_changed`, `delivery_delay`, `delivery_ready` | high | ❌ | ✅ | ❌ | ✅ | default_on | default_on | default_on | never | never |
| `billing_order_delivery` | `order_confirmation` | high | ✅ | ❌ | ❌ | ❌ | required | required | default_on | never | never |
| `garden` | `operation_scheduled`, `operation_rescheduled`, `operation_completed`, `operation_canceled` | high | ❌ | ✅ | ✅ | ✅ | default_on | default_on | default_on | default_on | never |
| `garden` | `garden_health_alert` | high | ❌ | ✅ | ❌ | ❌ | default_on | default_on | default_on | never | never |
| `weather_alerts` | `weather_risk_alert` | high | ❌ | ✅ | ❌ | ❌ | default_off | default_off | default_off | never | never |
| `garden` | `harvest_ready`, `harvest_window_ending` | normal | ❌ | ✅ | ✅ | ✅ | default_on | default_on | default_on | default_on | never |
| `reminders` | `task_reminder`, `cart_abandonment_reminder`, `subscription_renewal_reminder` | normal | ❌ | ✅ | ✅ | ✅ | default_on | default_on | default_off | default_on | never |
| `digests` | `daily_digest`, `weekly_digest`, `monthly_digest` | low | ❌ | ✅ | ❌ | ✅ | default_on | default_on | never | required | never |
| `admin_campaigns` | `service_announcement`, `feature_release_note`, `maintenance_window` | normal | ❌* | ✅* | ✅ | ✅ | default_on | default_on | default_off | default_on | default_on |
| `promotional` | `upsell_offer`, `seasonal_campaign`, `reengagement_campaign` | low | ❌ | ✅ | ✅ | ✅ | default_on | default_off | default_off | default_on | default_on |

`*` For `admin_campaigns`, specific events may be flagged `required=true` when they are operationally critical (for example emergency downtime instructions). If so, they must be reclassified to `marketing=false` and follow non-marketing consent rules.

## 4) Premium controls (user-facing)

Premium preferences should support:

1. **Global channel toggles** per user (`in_app`, `email`, `push`, `digest`).
2. **Domain-level overrides** (for example, all `garden` push off).
3. **Event-level overrides** for high-volume events (task reminders, delivery updates, campaigns).
4. **Quiet hours** window and timezone; applies only when `quietHoursEligible=true`.
5. **Digest cadence** (`hourly` / `daily` / `weekly`) for digest-eligible domains.
6. **Frequency caps** for marketing and campaign traffic (for example max sends per week).
7. **Required-message transparency**: UI labels events that cannot be disabled.

Garden settings currently expose domain-level controls for the canonical
preference categories that are safe to adjust from the customer UI:

- `garden`
- `weather_alerts`
- `reminders`
- `admin_campaigns`
- `promotional`

`account_security` and the required portions of `billing_order_delivery` are
shown as always-on explanatory rows instead of toggles. Event-level controls for
mixed domains, such as delivery-status updates versus required billing/order
messages, should be added only after the storage/API contract supports
event-level overrides.

Weather risk alerts are opt-in before notification creation. The weather alert
producer must create user-scoped notification rows only for users with an enabled
`weather_alerts` + `push` preference. Missing preferences default to off, and an
account-scoped preference overrides the user's global weather-alert preference
for that account.

## 5) Separation of required/security vs promotional

Rules:

- `required=true` implies `marketing=false`.
- `promotional` domain is always `marketing=true`, `required=false`, `userDisableable=true`.
- Security and legal-account notices are never bundled into digest and never suppressed by quiet hours.
- Promotional/campaign messages must respect opt-out and frequency caps before routing.

## 6) Rich web push payload contract

All push-capable events must map to this payload shape:

- `title` (required): concise headline.
- `body` (required): short summary text.
- `icon` (optional): monochrome/small app mark URL.
- `image` (optional): rich media URL for expanded display.
- `url` (required): safe deep-link target.
- `actions` (optional): array of quick actions (`id`, `title`, optional `url`).
- `tag` (optional): grouping key for collapse/replace semantics.
- `collapseKey` (optional): platform-agnostic collapse identifier.
- `threadId` (optional): notification center threading key.
- `urgency` (required): `very-low` | `low` | `normal` | `high`.
- `ttlSeconds` (required): delivery time-to-live.
- `analytics` (required object):
  - `notificationId`
  - `eventType`
  - `domain`
  - `campaignId` (optional)
  - `experimentId` (optional)
  - `sentAt`

Guardrails:

- Do not include sensitive personal data in `title`, `body`, `image`, or `url` query params.
- `url` must pass allowlist/safe-redirect validation before enqueue.
- `actions` cannot target unsafe external hosts.

## 7) Router precedence contract

Delivery router order for a single event:

1. Validate event policy (`required`, `marketing`, allowed channels).
2. Load user/global/domain/event preferences.
3. Apply legal and required overrides (cannot disable required).
4. Apply quiet-hours and digest deferral logic.
5. Apply frequency caps for campaign/promotional traffic.
6. Resolve final channel set and enqueue with idempotency key.
7. Emit delivery audit records for attempted, skipped, deferred, and sent outcomes.

## 8) Minimal implementation fields for downstream tickets

To implement this matrix, storage/API should support at least:

- Notification catalog table: `eventType`, `domain`, `priority`, flags, channel defaults.
- User preference table: per-user channel/domain/event overrides and quiet-hours settings.
- Device subscription table: push endpoint metadata, capabilities, consent status.
- Delivery audit table: per-attempt channel outcome, reason codes, latency, provider response.
- Campaign table: audience filter, schedule window, frequency cap policy, approval metadata.

This document is the source contract for GRE-312, GRE-314, GRE-315, GRE-316, and GRE-322 implementation alignment.
