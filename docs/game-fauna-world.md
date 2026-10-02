# Fauna world

`packages/game/src/entities/animals/faunaWorld.ts` owns fauna presence and
debug state for one game root. Each `GameStateStore` creates one `faunaWorld`
and disposes it with the store, so two Canvas roots never share actors.

## Presence

Actors still report presence at their existing cadence
(`animalPresenceUpdateIntervalSeconds`, or the beach ball's 0.2 s cadence).
The report now writes into slot-stable packed storage (`x`, `y`, `z`,
`updatedAt`), not into the zustand store. Removed slots go on a free list, so
mount/unmount churn reuses storage and capacity grows only with the live actor
count.

Readers use one of two queries:

- `getSpeciesPresences(species)` returns a cached, id-sorted snapshot that is
  rebuilt only after that species reports or loses an actor. Per-frame
  neighbor reads (cow herd spacing, sheep flocking) no longer allocate when
  nothing changed.
- `queryPresences({ species, behavior, center, radius, now, maxAgeSeconds })`
  resolves spatial queries through a four-unit X/Z grid, then applies the
  exact 3D distance check. Avatar petting and beach-ball kicks use it.

Both keep the previous id ordering and freshness rules
(`freshAnimalPresences`, 3.5 s petting and 0.6 s beach-ball windows), so the
seeded target choices stay the same.

Cats and dogs no longer subscribe to presence or debug arrays through React.
They read dog, cat, and ground-bird state from the world only when they choose
a target, so a report from another animal no longer re-renders every cat and
dog.

## Debug snapshots

`reportDebug` keeps the latest entry per actor. The world publishes
`animalDebugEntries` to the store in one sorted batch at most every
`faunaDebugPublishIntervalSeconds` (0.5 s), and only when an entry changed
semantically. A report that changes only the timestamp does not publish.
Removals during unmounts coalesce into one trailing write. Previously every
actor copied and sorted the shared array with its own store write.

`getDebugEntries()` exposes the live entries for in-scene consumers that must
not wait for the HUD batch.

## Instrumentation

`window.__grediceGameProfile.faunaWorld` receives coalesced counters after
membership changes, debug publications, and at most once per scene second of
reports: actor count, presence capacity, presence reports and queries,
snapshot rebuilds, debug reports, published versus skipped debug batches, and
actors whose last record was removed.

## Remaining work

This first step of #4720 centralizes presence, spatial lookup, and HUD/debug
publication. Behavior, path, and movement loops still run in each species
component under its existing scheduler lease. Moving those loops onto a world
fixed-step, sleeping settled or offscreen actors, and per-species instanced
skinning are follow-up migrations. Each needs behavior-parity fixtures for
its species.
