import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const preMigrationSchema = `
CREATE TABLE delivery_runs (
    id text PRIMARY KEY,
    state text NOT NULL,
    time_slot_id integer NOT NULL,
    route_revision integer DEFAULT 0 NOT NULL,
    reroute_required_at timestamp,
    completed_at timestamp,
    current_latitude double precision,
    current_longitude double precision,
    current_location_accuracy double precision,
    current_location_heading double precision,
    current_location_speed double precision,
    current_location_recorded_at timestamp
);
CREATE TABLE delivery_run_stops (
    id integer PRIMARY KEY,
    run_id text NOT NULL REFERENCES delivery_runs(id),
    delivery_request_id text NOT NULL,
    state text NOT NULL,
    stop_key text,
    formatted_address text NOT NULL,
    sequence integer NOT NULL,
    delivered_at timestamp,
    exception_reason text,
    exception_note text,
    exception_occurred_at timestamp,
    exception_recorded_by_user_id text,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT delivery_run_stops_outcome_shape_check CHECK (true)
);
CREATE UNIQUE INDEX delivery_run_stops_delivery_request_id_unique
    ON delivery_run_stops(delivery_request_id);
CREATE TABLE events (
    id integer PRIMARY KEY,
    aggregate_id text NOT NULL,
    type text NOT NULL,
    created_at timestamp NOT NULL
);
`;

const seedSql = `
INSERT INTO delivery_runs (id, state, time_slot_id, route_revision) VALUES
    ('legacy', 'active', 10, 0),
    ('partial-cancel', 'active', 20, 5),
    ('full-cancel', 'active', 30, 1),
    ('completed-failed', 'completed', 40, 2);

INSERT INTO delivery_run_stops (
    id, run_id, delivery_request_id, state, stop_key, formatted_address,
    sequence, exception_reason, exception_note, exception_occurred_at,
    exception_recorded_by_user_id, created_at, updated_at
) VALUES
    (1, 'legacy', 'legacy-early', 'deferred', null, 'Avenija 1, Zagreb', 1,
        'customer-unavailable', null, '2026-07-15 11:00:00', 'driver-1',
        '2026-07-15 08:00:00', '2026-07-15 11:00:00'),
    (2, 'legacy', 'legacy-bulk-1', 'deferred', null, 'Ilica 1, Zagreb', 3,
        'address-inaccessible', null, '2026-07-15 09:00:00', 'driver-1',
        '2026-07-15 08:00:00', '2026-07-15 09:00:00'),
    (3, 'legacy', 'legacy-bulk-2', 'deferred', null, '  ilica 1 ,   zagreb ', 4,
        'address-inaccessible', null, '2026-07-15 09:01:00', 'driver-1',
        '2026-07-15 08:00:00', '2026-07-15 09:01:00'),
    (4, 'partial-cancel', 'partial-cancelled', 'pending', 'partial-1', 'P 1', 1,
        null, null, null, null, '2026-07-15 08:00:00', '2026-07-15 08:00:00'),
    (5, 'partial-cancel', 'partial-ready', 'pending', 'partial-2', 'P 2', 2,
        null, null, null, null, '2026-07-15 08:00:00', '2026-07-15 08:00:00'),
    (6, 'full-cancel', 'full-cancelled', 'pending', 'full-1', 'F 1', 1,
        null, null, null, null, '2026-07-15 08:00:00', '2026-07-15 08:00:00'),
    (7, 'completed-failed', 'completed-failed-request', 'failed', 'failed-1', 'C 1', 1,
        'operational-other', 'audit note', '2026-07-15 08:30:00', 'driver-2',
        '2026-07-15 08:00:00', '2026-07-15 08:30:00');

INSERT INTO events (id, aggregate_id, type, created_at) VALUES
    (1, 'partial-cancelled', 'delivery.request.ready', '2026-07-15 08:00:00'),
    (2, 'partial-cancelled', 'delivery.request.user_cancelled', '2026-07-15 09:00:00'),
    (3, 'partial-ready', 'delivery.request.ready', '2026-07-15 08:00:00'),
    (4, 'full-cancelled', 'delivery.request.ready', '2026-07-15 08:00:00'),
    (5, 'full-cancelled', 'delivery.request.cancelled', '2026-07-15 09:30:00');
`;

test('0073 keeps legacy bulk retries together and reconciles active cancellation projections', async () => {
    const database = new PGlite();
    await database.exec(preMigrationSchema);
    await database.exec(seedSql);
    const migration = await readFile(
        new URL(
            '../src/migrations/0073_overrated_sleepwalker.sql',
            import.meta.url,
        ),
        'utf8',
    );
    for (const statement of migration.split('--> statement-breakpoint')) {
        if (statement.trim()) await database.exec(statement);
    }

    const legacy = await database.query<{
        id: number;
        retry_lane_rank: number;
        retry_attempt: number;
    }>(`
        SELECT id, retry_lane_rank, retry_attempt
        FROM delivery_run_stops
        WHERE run_id = 'legacy'
        ORDER BY id
    `);
    assert.deepEqual(legacy.rows, [
        { id: 1, retry_lane_rank: 1, retry_attempt: 1 },
        { id: 2, retry_lane_rank: 2, retry_attempt: 1 },
        { id: 3, retry_lane_rank: 2, retry_attempt: 1 },
    ]);

    const partialRun = await database.query<{
        state: string;
        route_revision: number;
        reroute_required_at: Date | null;
    }>(`
        SELECT state, route_revision, reroute_required_at
        FROM delivery_runs WHERE id = 'partial-cancel'
    `);
    assert.equal(partialRun.rows[0]?.state, 'active');
    assert.equal(partialRun.rows[0]?.route_revision, 6);
    assert.ok(partialRun.rows[0]?.reroute_required_at);
    const partialStops = await database.query<{
        delivery_request_id: string;
        state: string;
        released_at: Date | null;
    }>(`
        SELECT delivery_request_id, state, released_at
        FROM delivery_run_stops
        WHERE run_id = 'partial-cancel'
        ORDER BY id
    `);
    assert.equal(partialStops.rows[0]?.state, 'cancelled');
    assert.ok(partialStops.rows[0]?.released_at);
    assert.equal(partialStops.rows[1]?.state, 'pending');
    assert.equal(partialStops.rows[1]?.released_at, null);

    const fullRun = await database.query<{
        state: string;
        route_revision: number;
        reroute_required_at: Date | null;
    }>(`
        SELECT state, route_revision, reroute_required_at
        FROM delivery_runs WHERE id = 'full-cancel'
    `);
    assert.equal(fullRun.rows[0]?.state, 'completed');
    assert.equal(fullRun.rows[0]?.route_revision, 2);
    assert.equal(fullRun.rows[0]?.reroute_required_at, null);

    const failed = await database.query<{
        state: string;
        exception_reason: string;
        exception_note: string;
        released_at: Date | null;
    }>(`
        SELECT state, exception_reason, exception_note, released_at
        FROM delivery_run_stops WHERE id = 7
    `);
    assert.deepEqual(
        {
            state: failed.rows[0]?.state,
            reason: failed.rows[0]?.exception_reason,
            note: failed.rows[0]?.exception_note,
        },
        {
            state: 'failed',
            reason: 'operational-other',
            note: 'audit note',
        },
    );
    assert.ok(failed.rows[0]?.released_at);
    await database.close();
});
