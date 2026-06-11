# Automations

Automations are configurable, trusted server-side workflows that react to
Gredice domain events or scheduled occurrences. The first workflows cover the
existing planting flow where a `raisedBedField.plantUpdate` event with
`data.status = "sowed"` queues seasonal watering operations asynchronously, and
monthly schedules that can create recurring farm operations. Operation
completion images can also be reviewed asynchronously for high-confidence plant
status changes that create pending admin approval requests. Verifying the
seedling transplanting operation also switches the targeted plant from
greenhouse sowing to direct sowing and queues 50L watering operations for the
next two days when that raised bed does not already have at least 50L of
watering scheduled on those days. Verifying the `Uklanjanje biljke` operation
marks the targeted raised-bed field plant status as `removed`, which closes the
plant cycle and frees the field for future planting.

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
`automation_definition_id` and `source_event_id` for `source = 'event'`. Manual,
test, and replay runs can be repeated while still keeping their source event
context.

## Runner Lifecycle

`runAutomations()` in `packages/storage/src/automations/runner.ts` performs four
bounded phases:

1. Ensure default automation definitions exist.
2. Enqueue due scheduled automation runs, using deterministic occurrence keys so
   repeated cron ticks do not duplicate the same period.
3. Read new domain events after the cursor and enqueue matching enabled
   automation runs.
4. Recover stale running jobs, claim due queued/retryable runs up to each
   automation definition's concurrency cap, and execute the claimed batch
   through the graph executor.

When defaults are first installed, the runner initializes the event cursor to
the current latest domain event id if no cursor exists. This prevents the MVP
from backfilling historical sowing events and creating past-dated seasonal
watering operations on first cron execution.

The API cron route is protected with `CRON_SECRET` and is registered in
`apps/api/vercel.json` on a five-minute schedule:

```json
{ "path": "/api/internal/cron/automations", "schedule": "*/5 * * * *" }
```

Five minutes is the MVP tradeoff: follow-up work is asynchronous and visible in
run logs without adding a high-frequency cron job.

## Module Registry

Trusted modules are registered in
`packages/storage/src/automations/modules.ts`. The registry exposes serializable
metadata for the admin UI and server-only `execute` functions for the runner.
User-authored code is not supported.

MVP modules:

- `trigger.domainEvent`: starts from a stored domain event and filters by event
  type.
- `trigger.scheduleMonthly`: starts once per month on the configured local day.
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
- `action.updateRaisedBedFieldPlantStatus`: writes a
  `raisedBedField.plantUpdate` event for an operation target, including the
  default plant-removal workflow that sets `targetStatus = "removed"`.
- `action.updateRaisedBedFieldSowingLocation`: writes a
  `raisedBedField.plantSchedule` event for an operation target, preserving the
  scheduled date while changing `sowingLocation`.
- `action.createPlantStatusRequestsFromImageAnalysis`: reviews hosted
  raised-bed images from operation completion or raised-bed AI analysis events,
  then creates pending plant-status approval requests when the visual evidence
  passes the configured confidence threshold.
- `action.log`: records a no-op step for diagnostics.

When adding a module, define metadata, config validation, dry-run behavior, and
the executor function in the registry. Prefer idempotent repository functions for
actions that mutate operations, plant state, notifications, or customer-visible
records.

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
