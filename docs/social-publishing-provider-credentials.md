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

## 2) Provider-aware env var pattern

Use provider-prefixed server env vars so future platforms can reuse the same model:

- `SOCIAL_PROVIDER_<PROVIDER>_CLIENT_ID`
- `SOCIAL_PROVIDER_<PROVIDER>_CLIENT_SECRET`
- `SOCIAL_PROVIDER_<PROVIDER>_USER_AGENT`
- `SOCIAL_PROVIDER_<PROVIDER>_DEFAULT_DESTINATION`
- `SOCIAL_PROVIDER_<PROVIDER>_ALLOWED_DESTINATIONS`
- `SOCIAL_PROVIDER_<PROVIDER>_ENABLED`

For Reddit (`<PROVIDER>=REDDIT`):

- `SOCIAL_PROVIDER_REDDIT_CLIENT_ID`
- `SOCIAL_PROVIDER_REDDIT_CLIENT_SECRET`
- `SOCIAL_PROVIDER_REDDIT_USER_AGENT`
- `SOCIAL_PROVIDER_REDDIT_DEFAULT_DESTINATION`
- `SOCIAL_PROVIDER_REDDIT_ALLOWED_DESTINATIONS`
- `SOCIAL_PROVIDER_REDDIT_ENABLED`

### Why this pattern

- Keeps secrets server-side only (no `NEXT_PUBLIC_` prefix).
- Supports additional providers (for example Meta/X/LinkedIn) without changing naming rules.
- Lets us gate rollout per provider with an explicit enabled flag.

## 3) Required Reddit credential details

Create a Reddit app dedicated to `apps/app` in the team-owned Reddit account and record:

- client ID
- client secret
- app type used by the integration
- user agent string used by API requests
- approved redirect URI(s), if the selected auth flow requires them

Store credentials in deployment secret managers (never in git):

- local `.env` for dev-only testing
- Vercel/hosting project env vars for preview + production

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
- [ ] `SOCIAL_PROVIDER_REDDIT_ALLOWED_DESTINATIONS` includes the public subreddit.
- [ ] Product + Operations sign-off captured in launch ticket.
- [ ] Incident rollback path defined (set `SOCIAL_PROVIDER_REDDIT_ENABLED=false`).

## 5) Ownership and rotation

- **Credential owner:** Engineering (App platform) with Operations as backup owner.
- **Account owner:** Operations team for Reddit posting account and subreddit membership.
- **Rotation cadence:** rotate credentials on schedule and immediately after suspected exposure.
- **Rotation process:**
  1. Generate new Reddit app secret.
  2. Update secret manager values in preview + production.
  3. Run sandbox smoke test.
  4. Re-enable public destination.
  5. Revoke old secret.

## 6) Do/Don’t summary

- Do keep provider credentials in server environment variables only.
- Do keep MVP destination policy allowlist-based.
- Do require sandbox smoke tests before public destination use.
- Don’t commit production secrets.
- Don’t expose provider secrets via `NEXT_PUBLIC_*`.
- Don’t allow arbitrary user-entered subreddit targets in MVP.
