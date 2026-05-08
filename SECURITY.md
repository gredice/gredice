# Security Guide

Use this guide for auth, secrets, validation, payments, private data, and unsafe rendering.

## Auth and authorization

- Use the existing Signalco auth helpers and app-local `auth` wrappers.
- Enforce authorization on the server for pages, route handlers, and Server Actions.
- Do not rely on hidden UI, disabled buttons, or client checks for access control.
- Admin workflows must require the appropriate role before reading or mutating data.
- Preserve impersonation and session handling patterns where they already exist.

## Secrets and environment variables

- Never hardcode secrets, tokens, connection strings, webhook secrets, or private keys.
- Only expose variables with `NEXT_PUBLIC_` when the value is safe for the browser.
- Do not log secrets, auth headers, cookies, full webhook payloads, or payment credentials.
- Use `pnpm env:pull` to populate local env files instead of inventing placeholder production values.

## Input validation

- Validate request bodies, query params, route params, webhook metadata, and Server Action input at the server boundary.
- Use existing Zod, Valibot, Hono validator, or local validation patterns.
- Treat external service metadata as untrusted.
- Prefer allowlists for enum-like values, entity types, statuses, and sort/filter keys.

## Data exposure

- Send the client only the data needed for the rendered view or interaction.
- Avoid exposing internal IDs when a route already uses public aliases or slugs.
- Be careful with account, user, address, delivery, invoice, transaction, and email data.
- Do not add broad `select *` style payloads to API or client helpers.

## Payments and webhooks

- Verify Stripe webhook signatures before processing.
- Keep payment amounts, currency, line items, customer IDs, and cart/account relationships consistent.
- Treat checkout processing as retryable and idempotent.
- Do not trust Stripe product metadata without validating required fields and reconciling with local cart/account data.

## Rendering and XSS

- Avoid `dangerouslySetInnerHTML`.
- If HTML or JSON-LD injection is required, keep it limited to trusted generated content and include a clear Biome ignore comment that explains why it is safe.
- Sanitize or structurally validate user-authored content before rendering.
- Do not render raw error objects or stack traces to users.

## Dependencies

- Prefer existing dependencies.
- Add new dependencies only to the workspace that uses them.
- Avoid packages that duplicate platform or existing helper behavior.
