# News rendering and cache writes

Issue #5087 (epic #5089). Comparable production cost windows remain an acceptance step after activation; logical bytes below are not Vercel billed ISR units.

## Before-change attribution

Read-only snapshot at 2026-10-02 03:32 UTC, 202 published CMS news entries:

| Source | Logical UTF-8 JSON/body bytes | Refresh trigger |
| --- | ---: | --- |
| `news-published-source-pages-v2` | 317,138 | First read after 3,600 seconds; deployment |
| `news-published-source-pages-daily-v1` | 317,138 | First read after 86,400 seconds; deployment |
| Published CMS list in Silo | 292,715 | 300-second directory TTL; CMS cache bust |
| Public `/novosti` HTML | 271,132 | Every request (`force-dynamic`), observed `MISS` |
| Public `/novosti/sto-je-novo` HTML | 487,805 | Daily ISR, observed `HIT` |

The two Next data keys stored complete article sections/render settings even when only card/taxonomy summaries were needed. CMS actions called `revalidatePath` in App, which does not invalidate the separate News project's Next cache. No cross-project publication trigger existed; TTL/deployment provided the fallback.

The audit baseline recorded 2,868 index renders in 72 hours and 53,960 account-level billed ISR write units ($0.281) in three closed periods. Those billing units cannot be assigned wholly to these News keys: full-route HTML/RSC, image routes, and other projects also contribute. The new local production-mode index body is 269,748 bytes; its body size is largely unchanged. The main rendering win is reusing it rather than rerendering it on each anonymous read. The largest measured News response is the changelog archive. This PR preserves its rendering and daily cadence; avoid claiming a 67% reduction in total ISR billing from the smaller data payloads alone.

Run the aggregate audit without printing CMS bodies/secrets:

```sh
node --import ./packages/storage/node_modules/tsx/dist/loader.mjs \
  --conditions=react-server --env-file=apps/news/.env.production.local \
  apps/news/scripts/audit-news-cache.ts
```

Use a usable existing read-only build connection. Fresh Vercel pulls omit sensitive `POSTGRES_URL` values; do not mistake an empty exported value for a usable connection.

## Implementation

- Unfiltered `/novosti` uses hourly ISR. Config query rewrites route `category`, `type`, and `tag` requests to an internal dynamic archive; direct internal URLs redirect to the public root. Unrelated tracking parameters retain the cached root. Original category normalization, type/tag redirects, timeline composition, canonical metadata, and eager cover rules remain.
- `news-published-summaries-v3` (hourly) and `news-published-summaries-daily-v2` (daily) contain only card/taxonomy fields: 105,082 logical bytes each on the same snapshot, 66.9% smaller than the old keys. React request caching coalesces simultaneous blog/changelog reads. Summary construction avoids parsing article sections that it will discard.
- Tagged cache refill reads the durable published News source directly from Postgres; it has no 100-row API limit. Detail/metadata reads cache one published, nondeleted slug under `news-published-article-v1` with a separate per-slug tag and hourly TTL, plus React request deduplication. This explicit Next boundary retains shared public-detail reuse across render/metadata and Open Graph requests, with a narrow publication tag. Full-route ISR reuses rendered articles. This removes the extra five-minute Silo layer from publication-sensitive reads while retaining shared Next data caching.
- The 202 individual article JSON payloads total 314,511 bytes. If all are materialized, the two summary caches plus article data total 524,675 logical bytes versus 634,276 bytes for the old two full-source keys, a 17.3% reduction before provider overhead. Article keys avoid rewriting unrelated bodies on publication and avoid reading a full archive for one detail. Runtime traffic, key overhead and build writes still need provider measurement.
- Build page concurrency is bounded to reduce direct-read connection bursts. Builds perform one public-detail query per generated article/render context; measure this additional build work together with the runtime reduction.
- Published create/update/autosave/publish/unpublish/revision-restore actions call the authenticated News endpoint once for deduplicated old/new normalized slugs. Draft-only changes do not trigger it. An unpublished or deleted page cannot be returned by the durable source.
- News invalidation expires the shared summary tag and affected per-article tags immediately (`expire: 0`, no stale-while-revalidate) and the affected article/image paths. Next paths omit the `/novosti` basePath; production-mode tests verify article and archive `HIT → MISS → HIT`, detecting wrong-path invalidation.

## Durable failed-invalidation retries

A failed request after a real public-content mutation stores only normalized old/new slugs and random generation tokens in the existing durable, `noeviction` Silo database. Dedicated key: `cms-news:production:revalidation:v1`. No content, account identifiers, raw requests, or secrets are stored. No new paid resource is provisioned.

| Project | Route | Cadence (UTC) | Empty run |
| --- | --- | --- | --- |
| News | `/novosti/api/revalidate` (authenticated GET) | `13 * * * *` | One bounded Redis EVAL/read, no PG reads and no invalidation |

The hash is deduplicated and bounded to 512 slugs (each at most 200 characters); admission is atomic and fails when full. Pending entries have no expiry. The worker invalidates first and acknowledges only matching generation tokens, so a concurrent failure cannot be erased by an older retry. Outages/failures retain pending work. Invalidation and retry admission failures are logged without remote response bodies/credentials; an already saved CMS mutation remains successful. If both immediate delivery and durable admission fail, pre-existing hourly/daily TTL fallback remains (not immediate visibility recovery). This limit must remain explicit operationally.

The hourly retry adds 72 function calls/Redis reads per 72 hours, versus the baseline 2,868 dynamic index renders; it does not wake the database when idle. Publication failures add bounded enqueue/internal Redis commands. Actual command cost depends on the existing plan and replication; include it in the comparable-window calculation.

## Configuration and rollout

Configure only server-side production variables, using existing Silo capacity and the existing API `CRON_SECRET` value:

| Variable | App | News |
| --- | --- | --- |
| `GREDICE_NEWS_REVALIDATE_SECRET` | Same secret | Same secret |
| `GREDICE_NEWS_REVALIDATE_REST_API_URL` / `_TOKEN` | Existing Silo | Same existing Silo |
| `CRON_SECRET` | Existing value | Existing value for retry auth |
| `GREDICE_NEWS_REVALIDATE_URL` | Optional origin override, production defaults to `https://novosti.gredice.com` | — |
| `GREDICE_NEWS_REVALIDATE_KEY` | Production default above | Same; explicit isolated key required outside production |

Keep previews isolated; production-only default origin prevents ordinary preview mutations from targeting production. After CI and merge, deploy both App and News at the merge SHA with these variables. Verify unauthenticated rejection, authenticated empty retry, canonical/filter redirects, public metadata/images, cold/warm cache reuse, and authenticated expiration of an existing public article/archive. Do not publish disposable test content to production. Publication state transitions are tested against a disposable database; production invalidation probes use existing public content without modifying it.

Observe a comparable 72-hour production window after activation. Compare News root render frequency/CPU, PG reads/build queries, logical cache payloads, Vercel ISR write units/bytes, and Redis/provider cost. The issue's net-cost acceptance stays open until this evidence exists.

## Validation

- News lint, typecheck, unit/static-data tests and production build.
- Production-mode HTTP test: archive/article cache reuse and immediate expiration, category/type/tag/internal-route redirects, unchanged canonical/Open Graph/Twitter metadata and distinct 1200×630 PNG previews.
- Disposable CMS source tests: published→draft→deleted visibility, archive completeness beyond 100 rows.
- Redis integration: no TTL, failed read recovery, deduplication, concurrent token-safe acknowledgement, atomic capacity bound.
- App helper tests: successful request performs no retry write; failures queue deduplicated slugs; retry outage preserves save success.
