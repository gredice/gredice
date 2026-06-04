# In-App Surveys

## Summary

In-app surveys replace the delivery Typeform flow with auditable survey definitions, immutable versions, account/user assignments, sends, responses, and answers stored in `packages/storage`. Admins manage surveys in `apps/app/app/admin/surveys`, customers answer assignments in `apps/garden/app/ankete/[assignmentId]`, and the delivery survey cron sends assignment links from `apps/api/app/api/internal/cron/delivery-survey/route.ts`.

## Actors

- Internal admin: creates survey definitions, publishes versions, sends surveys, and reads response details.
- Customer: opens an assigned survey from email or in-app notification and submits answers.
- System cron: creates the monthly delivery satisfaction assignment and sends the link at the customer's local 08:00.

## Configuration

- `CRON_SECRET` authorizes the delivery survey cron.
- `GREDICE_GARDEN_APP_URL` sets the assignment link origin. The fallback origin is `https://vrt.gredice.com`.
- `GREDICE_DELIVERY_SURVEY_TYPEFORM_FALLBACK=true` temporarily re-enables the old Typeform destination for the delivery cron if the in-app flow must be bypassed.

## Entry Points

- Admin UI: `/admin/surveys`
- Runtime API: `/api/surveys/assignments`, `/api/surveys/assignments/:assignmentId`, `/start`, `/submit`
- Admin API: `/api/surveys/admin`, `/definitions`, `/sends`, `/:surveyId/results`
- Customer UI: `/ankete/:assignmentId`
- Delivery cron: `/api/internal/cron/delivery-survey`

## State Model

Survey definitions have draft, published, or archived status. Published survey versions are immutable; changing copy or questions creates a new version. Assignments are unique by version, target key, and context key, so a delivery account/month can only receive one assignment for a given version. Responses store the version/question IDs that the customer saw, preserving historical meaning even after a later version is published.

Question types in the first rollout are 0-10 opinion scale, long text, and optional contact info. Opinion questions carry score metadata with `internalScore` and `publicScore`; the delivery seed keeps public scoring disabled until a later reporting rollout defines public thresholds and sample-size rules.

## Delivery Survey Path

The cron keeps the existing 45-day lookback and account/month grouping from delivery request fulfillment events. It only processes groups when the account's timezone is at local 08:00. For each unsent account/month group it creates a survey send with context key `delivery:{accountId}:{monthKey}` and context fields for delivery request IDs, operation IDs, month key, fulfillment period, delivery count, and `sourceWorkflow=delivery_survey_cron`.

The generated customer URL is `/ankete/{assignmentId}` on the garden app. Email and in-app notifications both point to that assignment. When at least one channel succeeds, the cron writes the existing delivery survey sent events for every delivery request in the group so the month is not retried.

## Failure Handling

If a month was already marked as sent, the cron marks any remaining request IDs in the same account/month as sent without sending another survey. If assignment creation fails, the group is skipped and can retry on the next cron run. If email fails but notification succeeds, the month is marked sent, matching the previous partial-success behavior. Channel outcomes are recorded in `survey_send_deliveries` when the assignment has an associated send.

The customer API rejects unauthorized assignments, expired assignments, invalid answers, and duplicate submissions. Admin-only result endpoints include response details and contact fields; normal users can only load assignments scoped to their active account or user ID.

## Observability

Admin survey details show assignment counts, response counts, send history, duplicate skips, numeric aggregates, and recent response details. Delivery cron responses include delivery candidate count, email count, notification count, assignment created/skipped counts, Typeform fallback state, and timestamp.

## Validation

Recommended focused checks after survey changes:

- `pnpm --filter @gredice/storage test surveysRepo.node.spec.ts`
- `pnpm --filter @gredice/storage exec tsc --noEmit --pretty false`
- `pnpm --filter api exec tsc --noEmit --pretty false`
- `pnpm --filter garden run typecheck`
- `pnpm --filter app exec tsc --noEmit --pretty false`
- `git diff --check`
