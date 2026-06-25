# Automations

Automations are configurable, trusted server-side workflows that react to
Gredice domain events or scheduled occurrences. The first workflows cover the
existing planting flow where a `raisedBedField.plantUpdate` event with
`data.status = "sowed"` queues seasonal watering operations asynchronously, and
daily, weekly, biweekly, and monthly schedules that can create recurring
operations. Operation
completion images can also be reviewed asynchronously for high-confidence plant
status changes that create pending admin approval requests. Verifying the
seedling transplanting operation also switches the targeted plant from
greenhouse sowing to direct sowing and queues 50L watering operations for the
next two days when that raised bed does not already have at least 50L of
watering scheduled on those days. Verifying the `Uklanjanje biljke` operation
marks the targeted raised-bed field plant status as `removed`, which closes the
plant cycle and frees the field for future planting. Plant field changes are
available as configurable action modules so new operation-driven plant-state
automations can be created from the admin graph editor without adding code. A
managed weekly schedule also creates `Fotografiranje gredice` operations every
Tuesday and Friday for active raised beds, reusing the existing operation
completion image flow and `photographyUpdate` visual reward handling.

## Ownership

- Persistence and execution live in `packages/storage`.
- The internal cron entrypoint lives in
  `apps/api/app/api/internal/cron/automations/route.ts`.
- The admin UI lives under `apps/app/app/admin/automations`.
- Farm and admin planting actions only create the domain event; follow-up
  operations are produced by the automation runner.

## Storage

The schema is defined in
`packages/storage/src/schema/automationsSchema.ts`.

- `automation_definitions` stores name, key, status, trigger metadata, graph
  JSON, max concurrent runs, metadata, and audit timestamps.
- `automation_runs` stores one async execution with source event/manual test
  context, graph snapshot, status, attempt count, dry-run flag, lock fields,
  input/output snapshots, and error fields.
- `automation_run_steps` stores per-node execution input, output, status, and
  error snapshots.
- `automation_event_cursors` stores the last processed domain event id for the
  event polling runner.

Event-triggered runs are idempotent through a partial unique index on
`automation_definition_id` and `source_event_id` for `source = 'event'`.
Schedule-triggered runs are idempotent through a partial unique index on
`automation_definition_id` and `source_aggregate_id` for schedule occurrence
event types. Manual, test, and replay runs can be repeated while still keeping
their source context.

Matching event-triggered runs are enqueued as part of `createEvent()`, so live
domain events do not need to wait for the polling cron before they appear in the
automation queue. The cursor-based polling runner remains as a safety net for
event writes that bypass immediate enqueueing, missed duplicate-safe enqueue
attempts, scheduled runs, and periodic queue execution.

## Runner Lifecycle

`runAutomations()` in `packages/storage/src/automations/runner.ts` performs
bounded phases:

1. Ensure default automation definitions exist.
2. Enqueue due scheduled automation runs, using deterministic occurrence keys so
   repeated cron ticks do not duplicate the same period.
3. Read new domain events after the cursor and enqueue matching enabled
   automation runs.
4. Recover stale running jobs.
5. Claim due queued/retryable runs up to each automation definition's
   concurrency cap and execute the claimed batch through the graph executor.
6. When a batch finishes quickly, claim another due batch in the same cron
   invocation. The runner measures batch duration and only starts another batch
   when the estimated next batch plus the safety margin still fits inside the
   processing budget.

When defaults are first installed, the runner initializes the event cursor to
the current latest domain event id if no cursor exists. This prevents the MVP
from backfilling historical sowing events and creating past-dated seasonal
watering operations on first cron execution.

The API cron route is protected with `CRON_SECRET` and is registered in
`apps/api/vercel.json` on a one-minute schedule:

```json
{ "path": "/api/internal/cron/automations", "schedule": "* * * * *" }
```

The cron remains bounded and idempotent: it enqueues missed schedule/event runs,
recovers stale locks, and claims limited batches of due queued/retrying runs.
The API cron currently allows up to 10 processing batches, with a 45-second
processing budget and a 5-second safety margin. This lets fast skipped/no-op
jobs drain without waiting for another cron tick, while slower batches naturally
pause for the next one.

## Module Registry

Trusted modules are registered in
`packages/storage/src/automations/modules.ts`. The registry exposes serializable
metadata for the admin UI and server-only `execute` functions for the runner.
User-authored code is not supported.

MVP modules:

- `trigger.domainEvent`: starts from a stored domain event and filters by event
  type.
- `trigger.schedule`: starts on a daily, weekly, biweekly, or monthly cadence.
  Weekly and biweekly schedules can target one weekday or a JSON array of
  selected weekdays. Biweekly schedules require an anchor date so alternating
  week parity stays explicit.
- `trigger.scheduleMonthly`: legacy monthly trigger that starts once per month
  on the configured local day.
- `condition.eventDataEquals`: compares a value in event data.
- `condition.operationMatches`: checks operation status, entity id, or
  operation application.
- `condition.plantStatusEquals`: checks current raised-bed field plant status.
- `action.queueSeasonalSowingOfferOperations`: queues seasonal free watering
  operations.
- `action.queuePostTransplantWateringOperations`: queues 50L raised-bed
  watering operations for the two days after seedling transplant verification,
  skipping days where active scheduled watering for that raised bed already
  totals at least 50L.
- `action.createOperation`: creates an operation for the event context.
- `action.createFarmInventoryOperations`: creates accepted, scheduled farm-level
  operations for every active farm from a JSON list in the automation
  definition.
- `action.createGreenhouseSeedlingWateringOperations`: creates at most one
  accepted, scheduled farm-level `Zalijevanje presadnica u stakleniku`
  operation per active farm and local schedule date. A farm is eligible when it
  has current greenhouse-located raised-bed fields, or when central outlet stock
  has active published non-expired offers with remaining quantity. Outlet offers
  are not farm-scoped in storage, so active outlet stock makes every active farm
  eligible for the daily care operation.
- `action.createRaisedBedOperations`: creates accepted, scheduled raised-bed
  operations for every active, non-deleted raised bed from a single operation
  entity config. It targets `raisedBedId` without `raisedBedFieldId`, skips
  inactive, deleted, and abandoned raised beds, and reports `recipientCount`,
  `projectedCreateCount`, and `skippedExistingCount` during dry runs.
- `action.updateRaisedBedFieldPlantAttributes`: writes plant status and/or
  sowing location events for the operation target field. Use this for new
  no-code plant-state automations.
- `action.createPlantStatusRequestsFromImageAnalysis`: reviews hosted
  raised-bed images from operation completion or raised-bed AI analysis events,
  then creates pending plant-status approval requests and field-level weed-state
  observations when the visual evidence passes the configured confidence
  threshold.
- `action.log`: records a no-op step for diagnostics.

The managed default `default.monthly-farm-inventory-operations` uses the shared
monthly `trigger.schedule` on day 1 in `Europe/Zagreb` and creates the published
internal farm inventory operation set (`inventoryRaisedBedBoards` through
`inventoryPlasticDeliveryBags`, operation entity ids 554-565) for each active
farm.

When adding a module, define metadata, config validation, dry-run behavior, and
the executor function in the registry. Prefer idempotent repository functions for
actions that mutate operations, plant state, notifications, or customer-visible
records.

Graphs can branch after a shared condition. For example, an `operation.verify`
trigger can flow into one `condition.operationMatches` node and then fan out to
separate plant-attribute, watering, notification, or operation-creation actions.
The executor records those sibling actions as separate steps; actions should
remain idempotent because replays and retries can run the same graph again.

The managed raised-bed photo automation uses `trigger.schedule` with
`daysOfWeek: ["tuesday", "friday"]` in the `Europe/Zagreb` time zone and
`action.createRaisedBedOperations` with operation entity `301`
(`raisedBedFullPhoto`, label `Fotografiranje gredice`). Duplicate prevention is
scoped to the raised bed, operation entity, and weekday occurrence date; existing
non-canceled/non-failed operations for the same day are counted as existing
skips.

## Graph Validation

`validateAutomationGraph()` in
`packages/storage/src/automations/executor.ts` enforces:

- exactly one trigger;
- no incoming edge to the trigger;
- supported module keys and matching module kinds;
- module-specific config validation;
- no missing edge endpoints;
- no cycles in the reachable graph;
- at least one action;
- every action is reachable from the trigger.

Invalid graphs are blocked before save in the admin UI and fail safely if an old
snapshot reaches the runner.

## Admin UI

Admins manage automations in `apps/app` at `/admin/automations`.

- The list page shows definition status, trigger summary, action summary, latest
  run status, recent failed-run count, a jobs queue table with run state,
  attempts, timing, and source context, and filters for definition status,
  trigger event type, run status, and failed-only runs.
- The detail page shows the editor, test controls, and expandable run logs with
  per-step input/output/error snapshots.
- The editor uses `@xyflow/react` and stores layout in the definition graph.
- The right panel is the module store and selected-node configuration surface.
- Manual test runs can use a recent matching event or synthetic event context.
  Dry-run is enabled by default. The admin app only enqueues these runs; the API
  automation runner executes them with the same queue path as event and schedule
  runs.
- Failed runs can be replayed as a new linked queued run.
- Definition details include a parallelism setting that controls how many runs
  from that automation can be in progress at the same time.

## Validation

For changes touching the automation engine or UI, run the narrowest applicable
commands from the repo root:

```bash
pnpm lint --filter @gredice/storage
pnpm test --filter @gredice/storage
pnpm build --filter api
pnpm build --filter app
git diff --check
```

For focused automation work, the storage test can be narrowed to:

```bash
pnpm --filter @gredice/storage test -- automationsRepo.node.spec.ts
```

If farm planting behavior changes, also run:

```bash
pnpm build --filter farm
```

Schema changes require:

```bash
pnpm db-generate
```

Do not run `pnpm db-push`. New migration files are coordinated with maintainers
before merging shared PRs.
