# Reddit posting MVP: credentials and launch guardrails

This document defines the non-code launch setup for the Reddit posting MVP in `apps/app`.

## Launch decision (MVP)

- **Posting account owner:** Operations team service account `u/gredice-social` (non-personal account).
- **Initial target policy:** One fixed subreddit in production: `r/gredice`.
- **Manual smoke-test target:** Private/non-public test subreddit `r/gredice-internal-test`.
- **Future expansion:** Allowlist can be extended only after moderation and policy review.

## Required server-side environment variables

Set these values in server runtime environments for `apps/app` only (local, preview, production):

| Variable | Required | Notes |
| --- | --- | --- |
| `REDDIT_CLIENT_ID` | Yes | Reddit app client ID from the selected Reddit app. |
| `REDDIT_CLIENT_SECRET` | Yes | Reddit app client secret. Keep server-only. |
| `REDDIT_REFRESH_TOKEN` | Yes | Refresh token for the posting account authorization. |
| `REDDIT_USERNAME` | Yes | Expected posting account username (for guardrail checks). |
| `REDDIT_ALLOWED_SUBREDDITS` | Yes | Comma-separated allowlist. MVP production value must be `gredice`. |
| `REDDIT_SMOKE_TEST_SUBREDDIT` | Yes | Subreddit name used for manual smoke tests before public posting. |
| `REDDIT_USER_AGENT` | Yes | Stable app user agent string (for API compliance/traceability). |

### Secret handling rules

- Never commit real values to this repository.
- Do not expose these variables with `NEXT_PUBLIC_` prefixes.
- Store all values in deployment secret stores and local `.env.local` files only.
- Restrict access to least privilege (ops + on-call owners).

## Environment matrix

- **Local dev:** Test app credentials and smoke-test subreddit only.
- **Preview/staging:** Shared non-production credentials and smoke-test subreddit only.
- **Production:** Production credentials + fixed production subreddit (`r/gredice`).

## Manual smoke-test checklist

Run this before first production enablement and after credential rotation:

1. Verify `REDDIT_ALLOWED_SUBREDDITS` includes `gredice-internal-test` in non-production.
2. Publish a test post from `apps/app` into `r/gredice-internal-test`.
3. Confirm post author is `u/gredice-social`.
4. Confirm logs include request metadata and no secret values.
5. Delete/archive the test post following moderation policy.
6. Only then enable public posting path to `r/gredice`.

## Ownership and rotation

- **Credential owner:** Operations (primary) + Engineering on-call (backup).
- **Rotation cadence:** Every 90 days or immediately on suspected exposure.
- **Rotation runbook minimum:**
  1. Rotate in Reddit app settings.
  2. Update secret manager values for preview + production.
  3. Redeploy `apps/app`.
  4. Run smoke-test checklist against `r/gredice-internal-test`.
  5. Confirm production posting health.

## Implementation dependency

- This guardrail doc supports adapter implementation issue **GRE-358**.
