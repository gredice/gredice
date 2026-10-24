# Featured garden summary reads

The homepage calls `GET /api/gardens/public/featured/summaries` once. Its ten
items contain only the garden ID/name, the first permitted public member's
public ID/display name/avatar/achievement count, and current day/night preview
URLs. The existing carousel opens a full public scene only when needed.

## Shared read model

The existing Gredice Redis namespace caches ranked IDs and compact
`[gardenId, activePlantCount]` pairs for 45 minutes. Existing TTL jitter puts
expiry between approximately 38 and 52 minutes, within the issue's 30–60 minute
window. Keys are versioned and environment scoped. No field/event/scene graph
is stored in the cache.

Ranking retains the existing likes, canonical active-field plant count, update
time and ID ordering. Cutoff like ties are resolved before taking ten gardens.
Counts use the canonical lifecycle reducer: harvested/died fields remain
occupied until removal, and replanting/reactivation/replacement semantics stay
unchanged. A cold count-cache rebuild uses the existing paginated history
reader once across current public gardens. Warm reads never fetch that history.
This is a cache-backed projection, not a new database schema or a guarantee of
zero history work after eviction. Missing/unavailable Redis retains a correct
uncached fallback, so live cache configuration and hit rates must be verified.

Field lifecycle, bed placement/deletion and garden events invalidate the compact
read model. Likes invalidate ranking; visibility/name changes invalidate both
keys. Concurrent fills or failed invalidation can leave bounded-age ranking,
but public metadata never relies on that cache.

## Visibility and previews

Every response uses three bounded SQL reads: current nondeleted public garden
metadata, at most one nontemporary public owner per selected account, and
current preview URLs. The owner query uses the same membership ordering and
public-field formatting as public garden details. It returns no email, raw
user ID, account ID or other members. Preview removal/replacement and owner
changes are visible without waiting for cache expiry.

The API and homepage summary fetch use `no-store`; do not add a browser/CDN or
WWW data cache around the final response. The current visibility gate omits
unpublished/deleted gardens even if Redis returns an obsolete ranked ID. A
stale list may contain fewer than ten gardens until its ranking refreshes.
Independent API/WWW deployment overlap retains an empty homepage fallback if
the summary endpoint is not available; it never restores detail fan-out.

Public plant statistics also share a 45-minute Redis cache. Placement events
invalidate the planted-plant statistic; directory totals can age until expiry.
Weather's existing cache is unchanged.

## Evidence and rollout checks

Focused real-PostgreSQL tests assert canonical ranking parity, lifecycle
invalidation, a warm read with two metadata SELECTs plus one owner
SELECT DISTINCT ON, and zero field/event-history reads. They also simulate a
missed invalidation and check immediate visibility removal, removed previews
and temporary-owner exclusion. API fixtures assert a ten-garden response below
10 KB; WWW tests assert exactly one summary request and bounded failure/timeout
behavior. These are local source/test measurements, not live cost savings.

After the exact API and WWW deployments are ready:

- Record ten-garden response bytes, `Server-Timing: featured-summaries`,
  configured cache availability, misses/rebuilds and warm SQL reads/bytes.
- Repeat anonymous homepage loads and confirm no ten public-detail requests
  occur before opening a garden. Verify current visibility and preview changes
  through the approved mutation flow.
- Compare a matching 72-hour window against #5082's audit: featured/detail
  request counts, Postgres reads/bytes, Redis operations and total Vercel/Neon
  usage. Record cold-rebuild cost separately from warm traffic.

Do not derive measured Neon egress or monthly savings from the old API JSON
byte estimate. Cost acceptance remains with the post-rollout measurements in
#5089.
