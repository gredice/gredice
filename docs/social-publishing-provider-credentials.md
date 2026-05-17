# Social publishing provider credentials

`apps/app` publishes directly to each provider from server-side code. Do not add
external bridge URLs, webhook relay services, browser automation, or
`NEXT_PUBLIC_*` secrets for publishing.

The admin setup guide lives in `apps/app/app/admin/social-publishing` and renders
provider-specific setup instructions from
`apps/app/src/social/providers/setupGuide.ts`.

## Env naming

Every provider uses this base pattern:

- `SOCIAL_PROVIDER_<PROVIDER>_ENABLED`
- `SOCIAL_PROVIDER_<PROVIDER>_DEFAULT_DESTINATION`
- `SOCIAL_PROVIDER_<PROVIDER>_ALLOWED_DESTINATIONS`

For multiple managed accounts, insert the account key before the final field:

```text
SOCIAL_PROVIDER_INSTAGRAM_BRAND_MAIN_ENABLED=true
SOCIAL_PROVIDER_INSTAGRAM_BRAND_MAIN_ACCESS_TOKEN
SOCIAL_PROVIDER_LINKEDIN_FIELD_OPS_ACCESS_TOKEN
```

The generic lookup first tries the account-specific key, then falls back to the
provider-level key. Keep `ALLOWED_DESTINATIONS` narrow.

## Direct provider requirements

| Provider | Direct mechanism | Required primary env |
| --- | --- | --- |
| Reddit | OAuth submit API | `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `USER_AGENT` or `ACCESS_TOKEN` |
| Instagram | Meta Graph media container and `media_publish` | `ACCESS_TOKEN`, optional `GRAPH_VERSION` |
| Facebook | Meta Page feed/photos/videos APIs | `ACCESS_TOKEN`, optional `GRAPH_VERSION` |
| Google Business | Business Profile `localPosts.create` | `ACCESS_TOKEN` or OAuth refresh credentials |
| X | X API v2 posts and media upload | `ACCESS_TOKEN` |
| TikTok | Content Posting API Direct Post | `ACCESS_TOKEN`, `PRIVACY_LEVEL` |
| Threads | Threads container and `threads_publish` | `ACCESS_TOKEN` |
| LinkedIn | Versioned Posts API plus Images/Videos upload | `ACCESS_TOKEN`, `API_VERSION` |
| WhatsApp | Cloud API Messages | `ACCESS_TOKEN`, `PHONE_NUMBER_ID` |

See `apps/app/.env.example` for the complete checked-in variable list.

## Destination formats

- Reddit: subreddit without `r/`.
- Instagram: Instagram professional account ID.
- Facebook: Facebook Page ID.
- Google Business: `accounts/{accountId}/locations/{locationId}`.
- X: profile handle, used for the permalink.
- TikTok: operational label or handle; publishing uses the authorized token owner.
- Threads: Threads user ID or `me`.
- LinkedIn: `urn:li:organization:{id}` or `urn:li:person:{id}`.
- WhatsApp: recipient phone number in international format without `+`.

## Media behavior

- Media URLs must be public and fetchable by either `apps/app` or the provider.
- Instagram, Facebook, TikTok, Threads, Google Business, and WhatsApp can pull
  public media URLs directly.
- X and LinkedIn media is downloaded by `apps/app` and uploaded to the provider
  before the post is created.
- LinkedIn direct publishing supports one media item per organic post in the
  current adapter. Organic carousel is not enabled because LinkedIn documents
  carousel publishing as sponsored-only.
- WhatsApp support is direct Cloud API messaging. It is not public Status or
  Channel publishing.

## Launch guardrails

1. Keep every provider disabled until credentials and destination allowlists are
   configured in the target environment.
2. Use sandbox, private, or self-only visibility where the provider supports it.
3. Publish one low-risk smoke-test post per provider.
4. Verify provider-side visibility and returned post/message IDs.
5. Enable public destinations only after Operations and Engineering sign off.

Rollback is provider-local: set `SOCIAL_PROVIDER_<PROVIDER>_ENABLED=false`.
