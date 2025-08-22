# FEAT00001 – Delivery Feature Specification

## 1. Summary

Enable users to receive (or personally pick up) deliverable items purchased through the platform by: (a) storing reusable delivery addresses, (b) selecting an available 2‑hour delivery (or pickup) time slot during checkout (Game modal flow), and (c) managing delivery requests operationally in the internal app. Built on Next.js (App Router) with Drizzle (PostgreSQL) and event sourcing for delivery request aggregate changes.

## 2. Goals / Success Criteria

| Goal | Metric (indicative) |
|------|---------------------|
| Users can add & reuse addresses | < 2 mins first add, < 15s reuse |
| Time slot chosen in checkout step | < 30s median |
| Ops can view & update delivery requests | < 5s load for next 24h |

## 3. Scope (In)

* CRUD delivery addresses (per account / user)
* Definition + scheduling of 2h delivery and pickup time slots
* Checkout integration: conditional second step if cart contains deliverable items
* Creation of a Delivery Request tying order -> address (or pickup location) -> chosen slot
* Back-office (app) pages: manage time slots + delivery requests
* Public reference page (www) listing upcoming available slots (read‑only)

## 4. Out of Scope (Initial Phase)

* Route optimization / driver assignment
* Partial order splits across multiple slots
* Notifications beyond existing generic email and in-app notifications infrastructure

## 5. Personas

* User (end user via game / consumer UI)
* Administrators (internal app)

## 6. Glossary

* Delivery Address – Saved structured address belonging to an account.
* Time Slot – 2h bucket representing either Delivery or Pickup at a specific Location.
* Location – Physical site (warehouse / pickup point) hosting pickup or dispatch operations.
* Delivery Request – Reservation generated from an order indicating fulfillment slot & address or pickup location.

## 7. Functional Requirements

### 7.1 Delivery Addresses

1. Users can create, edit, delete, list their own addresses (soft delete recommended for historical requests integrity).
2. Validate required fields (country, city, postal code, street, contact name, phone).
3. Mark one address as default.

### 7.2 Time Slots

1. Slots have: id, locationId, type (delivery|pickup), startAt, endAt (duration fixed 2h), status (scheduled|closed|archived). (Schema: `time_slots` table via Drizzle).
2. Delivery and pickup maintain distinct slot sets (no mixing types in one row).
3. Ops can bulk create future slots (e.g., generate next 14 days) with per-day patterns - with day holes, eg. only 2 days in a week.
4. Closing a slot (status=closed) disallows new bookings but preserves existing ones.
5. Archiving hides past slots from standard queries.
6. Prevent booking when status != scheduled.

### 7.3 Delivery Requests (Aggregate + Events)

1. Aggregate root: DeliveryRequest (identified by delivery_request_id UUID or snowflake). Creation triggered when an operation that is marked deliverable is created / paid (hook inside checkout finalize service).
2. Required inputs: operationId (foreign key to operations), slotId, addressId (nullable if pickup), locationId (if pickup), mode (delivery|pickup), optional notes.
3. State machine: pending -> scheduled -> fulfilled | cancelled. (scheduled on creation by default unless awaiting payment – configurable hook.)
4. Event sourcing: append-only events persisted to `events` table with aggregateId = delivery_request_id. Projection table `delivery_requests` (read model) updated by replay in-process (synchronous) after each event.
5. Users (Game) can cancel their own delivery request while in pending or scheduled state and before cutoff time (default: 12h prior to slot start). After cutoff only admins can cancel (operational issues).
6. Cancellation captured by DeliveryRequestCancelled event storing: cancelled_at (UTC), actorType (user|admin|system), reason_code (enum), optional note (in event.data only; not necessarily projected unless needed).

### 7.4 Checkout Integration (Game / Other Frontend)

1. If any cart line has deliverable=true, replace Pay Now CTA in Game `OverviewModal` (or equivalent) with a Delivery Step CTA that switches the modal's content view to Delivery Information.
2. Step allows: pick fulfillmentMode (delivery vs pickup), then either choose existing address or add new, then choose available slot filtered by mode and (optionally) geography.
3. Validation blocking order completion until a valid selection is persisted.
4. Display link to public slots page for available delivery times.
5. Allow editing before final payment confirmation.

### 7.5 Address Management UI (Modal / Section)

* List addresses, mark default, add/edit with inline validation, delete (soft) using API
  * Mounted under account management section of `OverviewModal` using existing tab/section pattern.

### 7.6 Public Slots Page (www)

* Displays upcoming (e.g., next 7–14 days) slots (delivery vs pickup tabs).
* Does not expose private numbers; only relative status (Available / Not available).

### 7.7 Back Office (Internal App)

1. Time Slot Management: list view, create/bulk generate, close/archive implemented as Next.js server actions + React table (existing table component) with optimistic updates.
2. Delivery Requests: filter by date range, slot, status, location; update status (scheduled->fulfilled / cancelled), view address summary. Use server actions for state transitions and event appends.

### 7.8 User Cancellation (Game UI)

1. Entry points: a) Order / Operation detail view, b) Delivery section of account / recent deliveries list.
2. Show current delivery request summary (mode, address/pickup location, slot window, status, cutoff countdown if applicable).
3. Display Cancel Delivery action if (state in {pending, scheduled}) AND (now < slot.start_at - cutoffHours) AND (not already cancelling).
4. Confirmation modal: explain impact (slot freed, irreversible), show slot window and address. Require explicit confirmation.
5. On confirm: call cancel endpoint; optimistic UI sets status to cancelling; upon success show toast and update to cancelled.
6. On failure (cutoff passed race condition) show informative message and refresh request.
7. Audit event persisted through existing event sourcing pipeline.

## 8. Data Model (Conceptual)

Tables (indicative names):

* delivery_addresses (id, account_id, label, contact_name, phone, street1, street2, city, postal_code, is_default, deleted_at, created_at, updated_at)
* pickup_locations (id, name, address_fields..., is_active, created_at, updated_at)
* time_slots (id, location_id, type, start_at, end_at, status, created_at, updated_at)
* delivery_requests (id, operation_id, slot_id, address_id, location_id, mode, state, created_at, updated_at, cancelled_at, cancelled_by, cancel_reason_code)
* events (id, type, version, aggregate_id = delivery_request_id, data, created_at)

## 9. API / Server Actions Contract (Draft)

Base path (internal): /api/delivery

* GET /addresses – list current user addresses (user restricted)
* POST /addresses – create (user restricted)
* PATCH /addresses/:id – update (user restricted)
* DELETE /addresses/:id – soft delete (user restricted)
* GET /slots?type=delivery|pickup&from=&to=&locationId= – list available slots (public)
* GET /requests?filters – list (user restricted)
* POST /requests – create (validates order & slot, user restricted)
* PATCH /requests/:id/cancel – user/admin cancellation (provides optional reason_code, free-text note)

Server Actions (preferred internal invocation):

* createDeliveryRequest({ operationId, slotId, addressId?, mode }): returns projection
* cancelDeliveryRequest({ requestId, cancelReason?, note? }): returns updated projection or idempotent status
* fulfillDeliveryRequest({ requestId }): returns updated projection
* bulkGenerateTimeSlots({ startDate, daysAhead, windows[], type, locationId }): returns counts

## 10. Validation Rules

* Address: country_code ISO 3166-1 alpha-2; postal_code length 3–10; phone E.164.
* Slot creation: end_at = start_at + 2h enforced.
* Slot start_at must align to 1h boundary (00:00, 01:00, ... 23:00) – assumption (configurable).
* User cancellation allowed only if now < (slot.start_at - cutoffHours) AND request.state in (pending, scheduled).
* Admin/system cancellation may ignore cutoff but must supply reason_code.

## 11. Slot Generation Logic (Bulk)

Input: date range or (startDate + daysAhead), list of daily windows (e.g., ['08:00','10:00','12:00','14:00']), locationId, type.

Process: For each day/window create start_at = day + window, end_at = start_at + 2h; skip if overlapping existing slot (same start_at & location & type).

Return: summary counts (created, skippedExisting).

## 12. Delivery Request State Transitions (Event Sourced)

pending (optional) -> scheduled -> fulfilled
scheduled -> cancelled
pending -> cancelled

Cancellation Sources (actorType):

* user (self-service before cutoff)
* admin (operational override)
* system (automatic e.g., payment failure, item unavailable)

Rules:

* Only scheduled can become fulfilled.
* Cannot cancel if already fulfilled.

## 13. Edge Cases

* User deletes address after booking: retain address snapshot in request (denormalize or historical copy) OR prevent deletion while active requests reference it (decision: snapshot minimal fields in request for audit; address_id remains for linkage unless hard deleted after all fulfilled).
* Time zone shifts / DST: store all timestamps UTC; UI localizes.
* Overlapping slot definitions rejected.
* Order updated post-booking removing deliverable items: auto-cancel request (emit event) OR keep (requires manual intervention) – choose auto-cancel for consistency.
* User initiates cancellation just after cutoff boundary: backend rejects with CUTOFF_EXPIRED error; UI must refresh and hide cancel button.
* Duplicate cancel requests (double-click / race): endpoint idempotent; second attempt returns already_cancelled status without error.

## 14. Security / Auth

* Address endpoints: authenticated user; access limited to own account_id.
* Ops endpoints (slot CRUD, requests listing beyond own) - not API endpoints. User server-side feature of nextjs.
* Input sanitized & validated server-side; audit trail for state transitions with event sourcing.

## 15. Performance / Limits

* Slot listing typical window: next 14 days -> expected rows: locations × types × (14 days × ~6 windows/day) – keep < 100 for a single query.
* Add pagination for large ranges (limit=200 default).
* Don't query via API or public listing slots from the past.

## 16. Observability

Logs:

* Event appends (type, aggregate_id, version) with correlation id (operation_id, request_id).
* Cancellation attempts including actor and outcome (accepted/rejected cutoff).

## 17. Events (Domain Event Types)

* delivery.request.created { requestId, operationId, slotId, mode }
* delivery.request.slot.changed { requestId, previousSlotId, newSlotId }
* delivery.request.address.changed { requestId, addressId }
* delivery.request.cancelled { requestId, actorType, cancelReason }
* delivery.request.fulfilled { requestId }
* delivery.request.user_cancelled { requestId, cutoffRemainingMinutes }

## 18. Open Questions

1. Do we need geo proximity filtering of slots by address postal code? (Future?)
    * not currently
2. Should we allow user to change slot after booking (before cutoff)? Need cutoff rule (e.g., 12h before start).
    * we should
3. Are pickup locations limited or dynamic (multi-tenant)?
    * all pickup locations are currently available to all users
4. Do we snapshot address fields into request table or separate history table?
    * snapshot into request table for simplicity

## 19. Implementation Phases

1. Core data model + address CRUD + slot CRUD + events.
2. Checkout integration + request creation.
3. In-game UI for delivery and cancellation
4. Back-office management UI.
5. Public slot reference page.
6. Verify MVP acceptance criteria is achievable.

## 20. Acceptance Criteria (MVP)

* User can add address, place order with deliverable item, select slot, confirm; request stored linking order+slot+address.
* Ops can list tomorrow's requests filtered by slot.
* Public page shows upcoming slots with availability status.
* User can cancel a scheduled delivery request prior to cutoff; UI reflects cancellation within 2s.

---

Document owner: Delivery / Fulfillment domain

Revision: 2025-08-11 (initial comprehensive rewrite)
Revision: 2025-08-11.1 (add user self-cancellation feature)
Revision: 2025-08-11.2 (align with Next.js, Drizzle, event sourcing & UI component conventions)
