# Social publishing provider credentials and Reddit launch guardrails

This runbook defines the MVP provider setup for publishing from `apps/app`.
It is written for server-side execution only and keeps secrets out of browser bundles.

## 1) Reddit MVP launch decision

- **Posting account owner:** Gredice Operations (shared team-managed account).
- **MVP destination policy:** allow posting only to a controlled subreddit list.
- **Initial allowlist:**
  - `u_gredice_private_sandbox` (private/test subreddit for smoke tests)
  - `u_gredice_public_launch` (public subreddit enabled only after launch sign-off)
- **Default runtime mode:** sandbox-only. Public subreddit remains disabled until a manual go/no-go decision.

> Keep the allowlist intentionally small. Add new subreddit targets through config review, not ad-hoc input.

## 2) DB-backed provider settings

Configure social provider integrations in `apps/app` admin settings:

- Page: `Postavke` > `Integracije` > `Društvene platforme`
- Storage key: `settings.key = 'integrations.social_publishing'`
- Stored value: per-provider enabled flag, provider credentials, bridge endpoint,
  default destination, and allowed destinations

Provider credentials are operational settings like Google Calendar credentials.
Do not store Reddit, Meta, X, LinkedIn, TikTok, Threads, or WhatsApp publishing
secrets in deployment environment variables.

### Why this pattern

- Keeps secrets out of browser bundles and source control.
- Lets administrators rotate provider credentials without redeploying.
- Supports additional providers through the same settings value.
- Lets us gate rollout per provider with an explicit enabled flag.

## 3) Required Reddit credential details

Create a Reddit app dedicated to `apps/app` in the team-owned Reddit account and record:

- client ID
- client secret
- app type used by the integration
- user agent string used by API requests
- approved redirect URI(s), if the selected auth flow requires them

Store credentials in DB-backed admin settings (never in git or env files):

- `settings.key = 'integrations.social_publishing'` for preview + production
- local database settings for dev-only testing

## 4) Destination guardrails and smoke testing

### Manual smoke-test path (required before public posting)

1. Enable Reddit provider with sandbox destination only.
2. Trigger a post from `apps/app` using mocked/low-risk content.
3. Verify the post appears in `u_gredice_private_sandbox`.
4. Validate moderation/account policy checks (title format, link policy, rate limits).
5. Record result in release notes.

### Public launch unlock checklist

- [ ] Smoke test passed in private/test subreddit.
- [ ] Posting account has required subreddit permissions.
- [ ] Reddit allowed destinations in admin Settings include the public subreddit.
- [ ] Product + Operations sign-off captured in launch ticket.
- [ ] Incident rollback path defined (disable Reddit in admin Settings).

## 5) Ownership and rotation

- **Credential owner:** Engineering (App platform) with Operations as backup owner.
- **Account owner:** Operations team for Reddit posting account and subreddit membership.
- **Rotation cadence:** rotate credentials on schedule and immediately after suspected exposure.
- **Rotation process:**
  1. Generate new Reddit app secret.
  2. Update the Reddit integration in admin Settings for preview + production.
  3. Run sandbox smoke test.
  4. Re-enable public destination.
  5. Revoke old secret.

## 6) Do/Don’t summary

- Do keep provider credentials in DB-backed admin settings only.
- Do keep MVP destination policy allowlist-based.
- Do require sandbox smoke tests before public destination use.
- Don’t commit production secrets.
- Don’t expose provider secrets via `NEXT_PUBLIC_*` or provider-specific env vars.
- Don’t allow arbitrary user-entered subreddit targets in MVP.
