# Redis Cache Expansion Plan (DB Load & Performance)

## Current Redis coverage

- `directoriesCached` currently caches directory entity payloads by entity id and entity type name, with 60s default TTL and explicit busting on entity/attribute writes.
- `grediceCached` currently caches weather/sensor keys.
- Most high-traffic schedule/admin/farm data paths use React `cache()` (per-process/request memoization) but not a shared cross-instance Redis layer.

## What to cache next (priority order)

## 1) Per-user schedule aggregates (highest impact)

### Why
- Farm/app schedule screens repeatedly load:
  - raised beds
  - operations (90-day windows)
  - per-day filtered views
- These are expensive joins/filtering and are likely revisited frequently by the same user/session.

### Candidate keys
- `schedule:farm:user:{userId}:raisedBeds:v1`
- `schedule:farm:user:{userId}:operations:{from}:{to}:v1`
- `schedule:farm:user:{userId}:day:{yyyy-mm-dd}:v1`
- `schedule:admin:raisedBeds:v1`
- `schedule:admin:operations:{from}:{to}:v1`
- `schedule:admin:day:{yyyy-mm-dd}:v1`

### TTL
- 30-120s for operations/day lists
- 2-5 min for mostly static reference subtrees (if separate)

### Invalidation
- On operation create/update/delete/complete => bust user operations/day keys (+ admin keys where applicable)
- On raised-bed/field changes => bust raisedBeds/day keys

---

## 2) Dashboard counters and summary cards

### Why
- Count/sum endpoints are cheap individually but expensive at scale under frequent refresh.

### Candidate keys
- `dashboard:admin:summary:v1`
- `dashboard:user:{userId}:summary:v1`
- `delivery:requests:summary:{dateBucket}:v1`

### TTL
- 15-60s (short staleness tolerated)

### Invalidation
- Event-driven bust on writes to operations/orders/delivery requests.

---

## 3) Entity reference lookups used in forms/search

### Why
- Repeated reads of entity type catalogs and reference data are common in admin forms.
- `getEntitiesFormatted` already caches broad lists; add finer-grained lists used by selectors/search.

### Candidate keys
- `entities:formatted:{entityTypeName}:state:{state}:locale:{locale}:v1`
- `entities:lookup:{entityTypeName}:q:{hash(query)}:v1`

### TTL
- 2-10 min for lookup/search
- 60-300s for formatted lists if invalidation is reliable

### Invalidation
- Reuse existing entity/attribute bust hooks to invalidate all dependent pattern keys.

---

## 4) Permission and role resolution snapshots

### Why
- Authenticated pages often recompute capability sets from role + account relationships.

### Candidate keys
- `authz:user:{userId}:capabilities:v1`
- `authz:account:{accountId}:members:v1`

### TTL
- 1-5 min

### Invalidation
- On membership/role updates, bust account + affected users.

---

## 5) Session-adjacent profile bundles

### Why
- App chrome frequently needs "current user + account + preferences + notification settings".

### Candidate keys
- `profile:bundle:user:{userId}:v1`

### TTL
- 60-300s

### Invalidation
- On user/account/preferences updates.

---

## 6) External API normalization results

### Why
- Weather is already cached; apply same pattern to other non-DB dependencies (if present), preventing burst fan-out.

### Candidate keys
- `ext:{provider}:{resource}:{paramsHash}:v1`

### TTL
- Provider-specific (30s to hours)

### Invalidation
- Mostly TTL-based.

## Data-shape strategy

- Prefer **cache read models** (already transformed payloads used by UI) for high-traffic pages to avoid recomputation.
- Keep keys versioned with suffix `:v1`; bump version when payload shape changes.
- Avoid single giant keys where partial updates are frequent.

## Invalidation model recommendation

- Keep existing explicit bust-on-write approach and standardize helper utilities:
  - `bustByPrefixes([...])`
  - `bustUserSchedule(userId)`
  - `bustEntityType(entityTypeName)`
- Add lightweight pub/sub or queue-based invalidation fan-out if multiple services write relevant tables.

## Operational safeguards

- Add jitter to TTL (±10-20%) to avoid stampedes.
- Use stale-while-revalidate pattern for expensive keys where possible.
- Add request coalescing/lock per key for hot misses.
- Enforce max payload size and compression for large schedule blobs.

## Rollout plan

1. Instrument baseline:
   - DB query count + p95/p99 latency for schedule/dashboard pages.
   - Cache hit ratio by key group.
2. Implement Redis wrapper for app/farm schedule data first.
3. Add bust hooks on operation/raised-bed mutations.
4. Expand to dashboard summaries and authz/profile bundles.
5. Review hit ratios weekly; retire low-value keys.

## Success metrics

- 30-60% reduction in DB reads on schedule/dashboard endpoints.
- p95 latency reduction of 20-40% on cached routes.
- Cache hit ratio >70% for schedule day keys during active hours.

