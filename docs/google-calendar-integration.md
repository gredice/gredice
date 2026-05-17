# Google Calendar delivery sync

The Google Calendar integration mirrors selected delivery request lifecycle
events to an operations calendar. It is implemented by `@gredice/google` and is
currently wired from `apps/api/app/api/[...route]/deliveryRoutes.ts` through
`apps/api/lib/delivery/calendarSync.ts`.

## Configuration

The preferred configuration path is the internal admin UI:

- Page: `apps/app` admin settings, `Postavke` > `Integracije` >
  `Google kalendar`
- Storage key: `settings.key = 'integrations.google_calendar'`
- Stored value: service account email, private key, and calendar ID

`apps/app` writes the setting, and `apps/api` reads the same setting before
calling `@gredice/google`. There are no Google Calendar service-account env vars
for this workflow; do not add the private key, calendar ID, or service account
email to `.env.example`, app Turbo env lists, or `NEXT_PUBLIC_*` variables.

The event time zone comes from the general backoffice/admin setting:

- Page: `apps/app` admin settings, `Postavke` > `Općenito` > `Backoffice`
- Storage key: `settings.key = 'admin.general'`
- Stored value: `timeZone`

If `admin.general` has not been saved yet, `apps/api` uses `Europe/Zagreb`.

The Google service account must be able to write to the target calendar. Share
the Google Calendar with the service account email before enabling sync in a
shared environment.

## Entry points

When a user creates a delivery request through
`POST /delivery/requests`, `apps/api` starts a fire-and-forget calendar sync
after `createDeliveryRequest` succeeds. The calendar event uses:

- event ID: `delivery-${requestId}`
- summary: `Delivery window scheduled` or `Pickup window scheduled`
- description: delivery request ID, operation ID, mode, account ID, contact,
  address or pickup location, and request notes when available
- location: delivery address or pickup location address
- start/end: the selected delivery slot

When a user cancels a delivery request through
`PATCH /delivery/requests/:id/cancel`, `apps/api` starts a fire-and-forget delete
for the same event ID.

Current source wiring is limited to those API routes. Other delivery request
paths, such as checkout automation in
`apps/api/lib/stripe/processCheckoutSession.ts` or admin status changes in
`apps/app/app/admin/delivery/requests/actions.ts`, must call the calendar sync
helpers explicitly if they should create, update, or delete calendar events.

## Google API behavior

`@gredice/google` authenticates with Google's OAuth token endpoint using a
service-account JWT assertion scoped to
`https://www.googleapis.com/auth/calendar`.

Calendar event creation is idempotent for the local event ID:

- `POST /calendar/v3/calendars/{calendarId}/events` creates the event.
- If Google returns `409`, the integration patches the existing event instead.
- Delete treats Google `404` as success because the local request is already
  absent from the calendar.

Access tokens are cached in memory and refreshed before expiry. Changing the
service account, calendar ID, or private key invalidates the cached token.

## Failure handling

Missing Google Calendar configuration skips sync without failing the delivery
request flow. Missing delivery slots are logged and skipped.

Google token, create, patch, or delete failures are caught and logged by
`apps/api/lib/delivery/calendarSync.ts`. These failures do not roll back the
primary delivery request creation or cancellation flow.

## Validation

For docs or env declaration changes, run:

```bash
git diff --check
```

For source changes to the sync workflow, run the narrow checks that cover the
changed workspace:

```bash
pnpm lint --filter api
pnpm test --filter api
pnpm build --filter api
```
