# Gredice Status

Public status page for Gredice services. The app reads current monitor state from the Checkly Public API on the server side so the Checkly API key is never sent to the browser.

## Runtime environment

```bash
CHECKLY_API_KEY=
CHECKLY_ACCOUNT_ID=
CHECKLY_STATUS_TAG=gredice-status
GREDICE_LIVE_DATABASE_URL=
```

`CHECKLY_ACCOUNT_ID` is optional when the API key only has one Checkly account. Set it explicitly if the key can access multiple accounts.

`GREDICE_LIVE_DATABASE_URL` is a read-only PostgreSQL connection used by
`/live` and `/api/live`. Its database role must only have column-level `SELECT`
access to `events.id`, `events.type`, and `events.created_at`. The public feed
maps an allowlist of domain-event types to privacy-safe Croatian descriptions;
it never reads event payloads or aggregate identifiers. The feed polls every
30 seconds and only includes the previous three hours. A short playback queue
softens bursts, then becomes genuinely quiet until another event arrives.

The view can be pinned with `?view=orbit`, `?view=rain`, `?view=soil`, or
`?view=network`. Omit the parameter to cycle through all four compositions.

## Checkly checks

The Checkly account has API checks tagged with `gredice-status` for:

- `https://www.gredice.com/`
- `https://vrt.gredice.com/`
- `https://farma.gredice.com/`
- `https://app.gredice.com/`
- `https://storybook.dev.gredice.com/`
- `https://api.gredice.com/`

Keep these as API checks on a 30-minute schedule. With 6 API checks this uses about 8,640 runs per 30-day month, which stays below the 10,000 included API checks. Browser checks are not used, so the status page uses 0 of the 1,000 included browser checks.

The public JSON feed is available at `/api/status`.
