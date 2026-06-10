# Raised-bed field-state snapshots

Plan 011 investigated whether raised-bed field state should move from event
replay on every read to a cached or materialized read model. This is a spike
result, not a production implementation.

## Scope and drift check

The issue plan was written at commit `17aca58ba`. The required drift check was:

```bash
git diff --stat 17aca58ba..HEAD -- packages/storage/src/repositories/gardensRepo.ts packages/storage/src/cache
```

On current `main` (`42216ad7`) this reports changes in
`packages/storage/src/repositories/gardensRepo.ts`, so the current
`getRaisedBedFieldsWithEvents` implementation was re-read before measuring.
The function now groups fetched events by aggregate id before reducing each
field, but it still fetches and replays all matching field events for the bed
with `getEvents(..., 0, 100000)` on every read.

`plans/README.md` does not exist on current `main`, so there was no status row
to update for this plan.

## Baseline

Measurement used the storage disposable test database on Docker Postgres 16,
Node `v24.15.0`, and pnpm `11.5.0`. The benchmark seeded one garden with one
raised bed and 18 fields for each scenario, then inserted synthetic lifecycle
events across those fields. Times are milliseconds over nine measured samples
after one warm-up call.

Command shape:

```bash
cd packages/storage
bash ./tests/startTestDb.sh
bash ./tests/migrateTestDb.sh
node --import tsx --env-file=.env.test --conditions=react-server --input-type=module <benchmark>
bash ./tests/stopTestDb.sh
```

| Field events fetched | `getRaisedBedFieldsWithEvents` median / p95 | `getGarden` median / p95 | `getAccountGardens` median / p95 |
| ---: | ---: | ---: | ---: |
| 0 | 1.24 / 1.43 | 2.01 / 3.51 | 1.93 / 2.21 |
| 900 | 3.06 / 3.92 | 3.64 / 5.57 | 3.88 / 4.71 |
| 9,000 | 17.76 / 19.09 | 19.23 / 20.07 | 18.72 / 19.27 |
| 27,000 | 57.40 / 61.21 | 55.40 / 57.10 | 56.90 / 61.14 |

DB round-trips were counted from the current repository call graph because the
Drizzle client is not wired with query-count instrumentation by default:

| Path | Round-trips for one garden with one bed | Scaling |
| --- | ---: | --- |
| `getRaisedBedFieldsWithEvents(raisedBedId)` | 2 | one field-row query plus one event query |
| `getGarden(gardenId)` | 4 | garden query, raised-bed query, then 2 per raised bed |
| `getAccountGardens(accountId)` | 4 | account gardens query, raised-bed query per garden, then 2 per raised bed |

The local numbers confirm linear replay cost as event history grows, but they
do not show a current local cliff for a single raised bed. They also do not
replace production p95/p99 data: this checkout does not include representative
production event distributions, multi-garden accounts, or live endpoint timing.

## Approaches

| Approach | Shape | Pros | Cons |
| --- | --- | --- | --- |
| Redis read-model cache | Cache reduced field state at `raisedBedFields:{raisedBedId}:v1`, reuse `redisCached`, and bust by prefix on raised-bed field lifecycle events. | No migration, matches `redis-cache-planning.md`, fast to roll out behind a flag, easy to discard on payload/version changes. | Cold misses still replay the full stream, invalidation must cover every write path, shared cache needs production hit-rate and payload-size telemetry. |
| Materialized snapshot table | Add a durable `raisedBedFieldSnapshots` read model keyed by raised bed and field, with `materializedAtEventId` and replay fallback. | O(1) reads after backfill, resilient to cache misses, better once event histories are very large. | Requires coordinated schema migration, backfill, event-shape versioning, replay fallback, and careful multi-writer consistency. |

The measured baseline favors deferring a production structural change today. If
production telemetry later crosses the trigger below, prototype the Redis
read-model cache first because the current measured cost is replay latency, not
yet a proven need for a durable table. Reserve the materialized table for a
follow-up plan if cold-miss replay remains too expensive or invalidation
correctness becomes too broad for Redis-only caching.

## Decision gate

Decision: defer production field-state snapshots and do not create the
throwaway prototype branch yet.

Reason:

- Local synthetic scaling is visible, but even 27,000 events for one raised bed
  measured at 61.21 ms p95 for the direct field replay path.
- No representative production p95/p99 endpoint timing or real event-count
  distribution was available in this checkout.
- Shipping a cache or snapshot prototype now would risk optimizing from
  synthetic data instead of observed production pressure.

Revisit when one of these triggers is met:

- production p95 for `getRaisedBedFieldsWithEvents` is above 100 ms for a
  sustained period,
- garden-detail or account-garden p95 exceeds 150 ms and field replay is the
  attributed bottleneck,
- a real raised bed exceeds 50,000 relevant field lifecycle events and a replay
  benchmark on that shape exceeds the 100 ms p95 threshold,
- schedule/dashboard production cache work from `redis-cache-planning.md`
  already needs field-state invalidation, making a Redis field read model a
  low-incremental-cost addition.

## Rollout sketch if triggered

1. Add production-safe instrumentation around field replay: event count, replay
   wall time, call origin, and raised-bed/garden cardinality. Avoid logging
   account names, plant notes, or private event payloads.
2. Prototype Redis read-model caching on `spike/011-field-snapshots` behind an
   opt-in guard. Use `redisCached`, key `raisedBedFields:{raisedBedId}:v1`,
   max payload sizing, and `bustRedisCacheByPrefixes`.
3. Bust the field cache on all raised-bed field lifecycle writes:
   `create`, `delete`, `plantPlace`, `plantSchedule`, `plantUpdate`, and
   `plantReplaceSort`.
4. Measure cold miss, warm hit, and invalidation behavior against the same
   event-count buckets used above plus representative production buckets.
5. Only consider a materialized table after Redis cold misses or invalidation
   gaps remain above threshold. Coordinate any schema work through
   `RELIABILITY.md`; do not generate a production migration as part of this
   spike.

## Open questions

- What are the current production p95/p99 timings for garden detail, account
  garden list, and schedule reads when broken down by raised-bed count?
- What is the current distribution of relevant field lifecycle event counts per
  raised bed?
- Should field-state caching be folded into `redis-cache-planning.md` item 1
  or tracked as a separate read model?
- Which write paths outside `gardensRepo.ts` can emit field lifecycle events
  and must participate in invalidation?
- If a durable table becomes necessary, what snapshot versioning and backfill
  policy should handle event-shape changes?
- Does multi-instance invalidation need pub/sub fan-out before field-state
  caching is enabled in production?
