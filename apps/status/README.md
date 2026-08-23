# Gredice Status

Public status page for Gredice services. The app reads current monitor state from the Checkly Public API on the server side so the Checkly API key is never sent to the browser.

## Runtime environment

```bash
CHECKLY_API_KEY=
CHECKLY_ACCOUNT_ID=
CHECKLY_STATUS_TAG=gredice-status
GREDICE_LIVE_DATABASE_URL=
GREDICE_LIVE_INGEST_DATABASE_URL=
GREDICE_LIVE_VERCEL_DRAIN_SECRET=
GREDICE_LIVE_GITHUB_WEBHOOK_SECRET=
```

`CHECKLY_ACCOUNT_ID` is optional when the API key only has one Checkly account. Set it explicitly if the key can access multiple accounts.

`GREDICE_LIVE_DATABASE_URL` is a read-only PostgreSQL connection used by
`/live` and `/api/live`. Its database role must only have column-level `SELECT`
access to `events.id`, `events.type`, and `events.created_at`, plus `SELECT` on
`status_live_events`. The public feed maps allowlisted Gredice, Vercel, and
GitHub event types to privacy-safe Croatian descriptions. It never reads domain
event payloads or aggregate identifiers, and it never stores or renders Vercel
log text, request paths, hostnames, commit messages, branch names, repository
metadata, or actor details.

`GREDICE_LIVE_INGEST_DATABASE_URL` is a separate integration connection. Its
role is limited to idempotent writes and retention cleanup in
`status_live_events` and `status_live_ingest_deliveries`. Vercel log batches are
reduced to source/type/minute/count pulses before storage; GitHub webhook
deliveries become one allowlisted delivery pulse. Raw bodies are discarded
after HMAC verification. `GREDICE_LIVE_VERCEL_DRAIN_SECRET` verifies
`x-vercel-signature` with HMAC-SHA1, and
`GREDICE_LIVE_GITHUB_WEBHOOK_SECRET` verifies `x-hub-signature-256` with
HMAC-SHA256.

The feed polls every 30 seconds and only includes the previous three hours. A
short playback queue softens bursts, then becomes genuinely quiet until another
event arrives.

Production integrations target:

- Vercel Drain: `/api/live/ingest/vercel`, JSON encoding, production logs only,
  selected application projects, with sampling configured at the Drain.
- GitHub repository webhook: `/api/live/ingest/github`, `application/json`,
  subscribed only to the event families handled by the allowlist.

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
