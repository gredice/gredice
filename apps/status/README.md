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
GREDICE_LIVE_INGEST_MODE=direct
GREDICE_LIVE_BUFFER_REST_API_URL=
GREDICE_LIVE_BUFFER_REST_API_TOKEN=
GREDICE_LIVE_BUFFER_PREFIX=status-live
CRON_SECRET=
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
`status_live_events` and `status_live_ingest_deliveries`. Vercel log batches and GitHub webhook
deliveries are reduced to allowlisted source/type/minute/count pulses before
storage. PostgreSQL delivery markers prevent retry/replay double counting. Raw bodies are discarded
after HMAC verification. `GREDICE_LIVE_VERCEL_DRAIN_SECRET` verifies
`x-vercel-signature` with HMAC-SHA1, and
`GREDICE_LIVE_GITHUB_WEBHOOK_SECRET` verifies `x-hub-signature-256` with
HMAC-SHA256.

In direct mode the feed polls every 30 seconds and only includes the previous three hours. A
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

## Live database disconnects

The read and ingest connections use separate lazy `pg` pools with the same
error handling. Each background disconnect emits one bounded metadata record
with event `status.live.pool.error`, pool role (`read` or `ingest`), safe
SQLSTATE/transport code when available, and total/idle/waiting counts. Raw
errors, clients, connection configuration, names, messages, and stacks are
omitted. `pg` removes the failed idle client and opens a replacement on demand;
the handler does not restart the pool or retry work.

Ingest transactions also handle connection errors while a client is checked
out. Query and commit failures still reject; rollback failure preserves the
original error and discards the client. The route returns 503 on failure.
Delivery markers and event updates remain in one transaction, so redelivery
after rollback is retryable and a committed delivery is accepted without
counting it again.

Run `pnpm --filter status test:node` for the database-free tests. Run
`pnpm --filter status test:disconnect` for real disconnect regressions: it
requires Docker, starts a disposable `postgres:16-alpine` container bound only
to localhost, applies the existing live activity migration, and removes the
container afterward. It ignores configured database URLs. The suite exercises
both production pool call sites with the installed `pg` driver, repeated idle
disconnects (including abrupt TCP closure), active query/transaction termination,
failed rollback and commit, concurrent delivery deduplication, and signed ingest
failure/retry responses.
Only Next's cache is bypassed; database operations use real PostgreSQL.


## Buffered ingestion and rollout

`GREDICE_LIVE_INGEST_MODE=buffered` makes signed ingestion write only to a
persistent Upstash Redis buffer. It never falls back to PostgreSQL on buffer
failure. Missing configuration, full/aged storage, or failed writes return 503
so the source can retry. Default/unset mode remains `direct` during rollout;
direct mode bulk persists one delivery and retains bounded per-delivery cleanup.
An invalid mode fails closed.

Use the existing Gredice Silo capacity with the status-specific
`GREDICE_LIVE_BUFFER_REST_API_URL/TOKEN` environment names and the default
`status-live:production:v1` prefix. Do not share the Plants Silo credentials,
change provider eviction settings, or flush Redis globally. Preview keys include
the deployment URL and environment, so previews cannot acknowledge production
work. Configure production secrets only in production.

Before activation, verify provider persistence, `noeviction`, available capacity,
and command pricing. A read-only `INFO memory` check on 2026-10-02 found the
existing Gredice Silo at 476,146 bytes used, a 3,221,225,472-byte maximum, and
`maxmemory_policy:noeviction`. This is a capacity/policy snapshot, not a billing
plan confirmation. [Upstash durable storage](https://upstash.com/docs/redis/features/durability)
persists data; [eviction](https://upstash.com/docs/redis/features/eviction) must
remain disabled for acknowledged work.

The queue allows at most 2,048 pending deliveries, 128 sanitized events and
16 KiB per delivery (at most 32 MiB payload plus index/metadata). Once the oldest
pending receipt reaches 24 hours, new deliveries receive 503 until the worker
recovers. Pending work has **no expiry** and is never discarded to make room;
the 24-hour threshold is an admission bound. Repeated deliveries already pending
are accepted without changing their immutable contents.

Vercel cron calls authenticated `/api/live/flush` every ten minutes, reads at most
50 oldest deliveries at a time, and stops after ten batches or 40 seconds. Empty
or already-leased work does not open Postgres. A 60-second Redis lease reduces
concurrent work; PostgreSQL deduplication remains authoritative even when a lease
expires. Each batch uses three SQL round trips (`BEGIN` with a 20-second local
statement timeout, one marker/bulk bucket statement, and `COMMIT`). Counts for
new delivery markers are coalesced per source/type/minute and saturated at the
PostgreSQL integer maximum. A failed transaction, ambiguous commit, or failed
Redis acknowledgement leaves the same deliveries pending for replay. Markers
are retained for seven days after persistence; replay after that horizon has
never been guaranteed.

Authenticated `/api/live/retention` runs hourly at minute seven. One statement
removes at most 10,000 old rows from each table, keeping seven-day delivery and
24-hour event retention. At ordinary volume this adds at most one hour of
cleanup latency; a large backlog drains across subsequent runs. Buffered flushes
never run retention. The public three-hour feed still polls every 30 seconds,
with up to ten minutes plus scheduled-run duration/cache delay before new pulses
appear. Monitor `oldestAgeMs`, `batches`, `deliveries`, `duplicates`, and `buckets`
from the authenticated flush response; a bounded response or recurring 503
requires checking queue depth and cron/database health.

### Cost and acceptance

The audit baseline was 17,432 Vercel batches plus 368 GitHub deliveries per
72 hours. Ten-minute persistence bounds normal scheduled transactions at 432
per 72 hours (97.6% fewer than 17,800), provided batches stay within 50 deliveries.
Hourly retention reduces the two per-delivery deletes to 144 bounded table
cleanup operations (99.6% fewer than the Vercel-only 34,864 baseline).
These are cadence/round-trip bounds, **not measured production savings**.

[Upstash pay-as-you-go pricing](https://upstash.com/pricing/redis) lists $0.20
per 100,000 commands and the first 1 GB of storage free. Conservatively counting
EVAL and its nested commands, normal enqueue/read/ack work is approximately nine
commands per delivery, plus small per-flush overhead: about $3.20 per 30 days at
the audit rate in one primary region. Replicated read regions, retries, fixed
plans, and existing shared usage change the total. The account's actual plan and
combined Neon/Vercel bill must be read before claiming a net cost reduction;
do not buy a separate fixed-price database for this low volume.

Rollout: land validated code, configure Redis URL/token and `CRON_SECRET`, verify
an authenticated empty flush, then set `GREDICE_LIVE_INGEST_MODE=buffered` and
redeploy that exact merge SHA. Check signed ingestion, successful persistence,
duplicate replay, queue age/depth, and the live page. Compare a matched 72-hour
window of provider command costs, Postgres writes/retention/compute wakeups, and
visualization latency before accepting the cost target in #5084/#5089.

Rollback: stop incoming deliveries at the source, flush existing pending work,
confirm both queue structures are empty, then switch to direct mode and redeploy
before resuming sources. Never turn off the worker with acknowledged work still
pending; direct mode alone does not drain it.

Validation: `pnpm --filter status test:node`, `pnpm typecheck --filter status`,
`pnpm --filter status test:buffer` (disposable Redis), and
`pnpm --filter status test:disconnect` (disposable PostgreSQL). The latter also
checks 50-delivery bulk coalescing, mixed replay, integer saturation, and bounded
retention. Both integration suites ignore production connection variables and
remove their local Docker containers afterward.
