---
name: gredice-domain-workflow-docs
description: Use for documenting Gredice workflows: delivery, checkout, payments, notifications, inventory, operations, crons, env, and failures across apps/packages.
---

# Gredice Domain Workflow Docs

## Overview

Write workflow documentation that traces real behavior across UI, API, storage, background work, notifications, and external services. Make state transitions and failure behavior explicit.

## Ownership Map

Start from `RELIABILITY.md` and `PRODUCT_SENSE.md`, then trace the owning files:

- Database schema and repositories: `packages/storage`.
- API behavior: `apps/api`.
- Shared API clients: `packages/client`.
- Public/content flows: `apps/www`.
- Customer garden/game flows: `apps/garden`, `packages/game`.
- Farm operations: `apps/farm`.
- Internal admin operations: `apps/app`.
- Payments: `packages/stripe`, `apps/api/lib/stripe`, API checkout and webhook routes.
- Notifications: `packages/notifications`, `packages/slack`, `packages/email`, `packages/transactional`, notification APIs and admin settings.
- Generated assets and models: `assets`, `packages/game`, `packages/cdn`, `apps/garden/public`.

## Trace Workflow

For any workflow doc:

1. Identify actors: public visitor, customer, farm operator, internal admin, system cron, webhook, external service.
2. Find entry points: page action, API route, Server Action, cron route, webhook, background script.
3. Trace storage reads/writes and event history.
4. Trace side effects: notifications, email, Slack, Stripe, PostHog, Redis/cache busting, revalidation.
5. List state transitions and terminal states.
6. Document retries, idempotency keys, skipped work, and partial failure behavior.
7. Record required environment variables and admin settings.
8. Include exact file paths and commands for validation.

Use `rg` with business terms and event/status names. Do not rely on a single UI file when the source of truth lives in storage or API code.

## Recommended Document Shape

Use this structure for workflow docs unless nearby docs use a stronger established pattern:

```markdown
# Workflow name

## Summary

## Actors

## Configuration

## Entry points

## State model

## Happy path

## Failure handling

## Observability

## Validation
```

For short docs, collapse sections but keep configuration, entry points, and failure handling visible.

## Domain Rules

Follow current Gredice product and reliability expectations:

- Preserve domain meaning. Use "raised bed", "field", "operation", "delivery request", "cart", "invoice", and "account" precisely.
- Keep money, inventory, delivery, fiscalization, and scheduled operation behavior explicit and auditable.
- Treat payment, checkout, delivery, inventory, notification, and cron work as retryable.
- Validate external metadata before trusting it.
- Do not log or document secrets, auth headers, full webhook payloads, or private user data.
- Explain whether missing configuration skips work, fails work, or retries later.

## Notification Example Facts

For Slack notification docs, use current keys and behavior from `docs/notification-workflows.md` and source:

- `SLACK_BOT_TOKEN` provides the bot token.
- Delivery channel setting key: `slack.delivery.channel`.
- New user channel setting key: `slack.new_users.channel`.
- Shopping channel setting key: `slack.shopping.channel`.
- Farm-specific Slack channel lives on `farms.slack_channel_id`.
- Missing channel configuration skips the notification and logs the omission.
- Slack delivery errors are logged and should not interrupt the primary business flow.

## Validation

Use the smallest checks for the source you documented, usually storage/API tests plus app builds for changed admin, farm, or garden behavior. Docs-only changes need `git diff --check`.

Query Linear, GitHub, the API, or the database only when documenting current operational state, open work, live configuration, or production data that cannot be inferred from source.
