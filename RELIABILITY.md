# Reliability Guide

Use this guide for database, storage, background jobs, payments, notifications, generated assets, and failure handling.

## Data ownership

- Database schema and repository code live in `packages/storage`.
- API route behavior lives mainly in `apps/api`.
- Shared API client behavior lives in `packages/client`.
- Payments live in `packages/stripe` and API checkout/Stripe processing code.
- Notifications live in `packages/notifications`, `packages/slack`, `packages/email`, and `packages/transactional`.
- Game and visual garden state live in `packages/game`, `apps/garden`, and generated assets.

## Database changes

- Edit schema under `packages/storage`.
- Run `pnpm db-generate` after modifying schema.
- Do not run `pnpm db-push`.
- For shared PRs, leave new migration files out of version control unless explicitly requested.
- Coordinate with maintainers before merging schema work so migrations can be ordered manually.
- Repository changes should preserve existing event/history semantics and avoid silent data loss.

## Consistency and idempotency

- Payment, checkout, delivery, inventory, notification, and cron code must be safe to retry.
- Prefer idempotent updates keyed by durable IDs from Stripe, carts, operations, notifications, or events.
- Validate external metadata before trusting it.
- Log enough context to diagnose failures without logging secrets or unnecessary personal data.
- Keep partial failure behavior explicit: skipped, retryable, failed, or completed.

## Background and cron work

- Cron routes live in app route handlers and Vercel config where applicable.
- Protect cron/internal routes with the established auth or secret pattern for that route.
- Make cron work bounded and observable.
- Handle empty work as a successful no-op.
- Avoid making cron jobs depend on fragile client-side state.

## External services

- Stripe webhooks must verify signatures before processing events.
- Email and Slack sending should tolerate missing optional configuration by using existing skipped-result patterns when available.
- Vercel Blob, S3/R2, PostHog, OpenTelemetry, Redis, and external APIs should be called through existing helper packages or app-local wrappers.
- Network failures should not corrupt local state.

## Generated assets and models

- Use existing scripts for generated game assets and model types.
- Do not hand-edit generated model output unless the script output itself is broken and the fix is explicitly temporary.
- Keep generated files deterministic when possible.

## Observability

- Preserve existing PostHog, Vercel Analytics, and OpenTelemetry instrumentation patterns.
- Add event names and properties that match `apps/api/posthog-setup-report.md` or nearby analytics code.
- Use logs for operational diagnostics, not user-facing control flow.
