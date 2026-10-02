import 'server-only';

import type pg from 'pg';
import { type ActivityDelivery, activityDelivery } from './activityDelivery';
import { createLiveActivityPool } from './createLiveActivityPool';
import type { SystemActivityInput } from './ingestParsers';

let pool: pg.Pool | undefined;

function getPool() {
    const connectionString =
        process.env.GREDICE_LIVE_INGEST_DATABASE_URL?.trim();
    if (!connectionString) return null;
    pool ??= createLiveActivityPool(connectionString, 'ingest');
    return pool;
}

// Only events belonging to newly inserted delivery markers contribute to the
// aggregate. The marker and buckets commit together, including concurrent replay.
export const persistActivityBatchSql = `
    with incoming as (
        select * from jsonb_to_recordset($1::jsonb) as delivery(
            id text, source text, "receivedAt" timestamptz, events jsonb
        )
    ), accepted as (
        insert into status_live_ingest_deliveries (id, source)
        select id, source from incoming
        on conflict (id) do nothing
        returning id
    ), buckets as (
        select event.id, event.source, event.type, event."occurredAt",
            sum(event."eventCount")::bigint as event_count
        from incoming join accepted using (id)
        cross join lateral jsonb_to_recordset(incoming.events) as event(
            id text, source text, type text,
            "occurredAt" timestamptz, "eventCount" integer
        )
        group by event.id, event.source, event.type, event."occurredAt"
    ), persisted as (
        insert into status_live_events (id, source, type, occurred_at, event_count)
        select id, source, type, "occurredAt", least(event_count, 2147483647)::integer
        from buckets order by id
        on conflict (id) do update set
            event_count = least(
                status_live_events.event_count::bigint + excluded.event_count,
                2147483647
            )::integer,
            updated_at = now()
        returning id
    )
    select (select count(*)::integer from accepted) as deliveries,
        (select count(*)::integer from persisted) as buckets
`;

export const activityRetentionSql = `
    with deliveries as (
        delete from status_live_ingest_deliveries where id in (
            select id from status_live_ingest_deliveries
            where received_at < now() - interval '7 days'
            order by received_at limit 10000
        ) returning id
    ), events as (
        delete from status_live_events where id in (
            select id from status_live_events
            where occurred_at < now() - interval '24 hours'
            order by occurred_at limit 10000
        ) returning id
    )
    select (select count(*)::integer from deliveries) as deliveries,
        (select count(*)::integer from events) as events
`;

export async function storeActivityBatch(
    deliveries: ActivityDelivery[],
    { cleanup = false } = {},
) {
    // In buffered mode empty cron runs never open a PostgreSQL connection.
    if (deliveries.length === 0) return { deliveries: 0, buckets: 0 };
    const database = getPool();
    if (!database) return null;

    const client = await database.connect();
    let discardClient = false;
    const onConnectionError = () => {
        discardClient = true;
    };
    client.on('error', onConnectionError);
    try {
        await client.query("begin; set local statement_timeout = '20s'");
        const uniqueDeliveries = [
            ...new Map(
                deliveries.map((delivery) => [delivery.id, delivery]),
            ).values(),
        ];
        const result = await client.query<{
            deliveries: number;
            buckets: number;
        }>(persistActivityBatchSql, [JSON.stringify(uniqueDeliveries)]);
        if (cleanup) await client.query(activityRetentionSql);
        await client.query('commit');
        const counts = result.rows[0];
        if (!counts)
            throw new Error('Activity persistence returned no result.');
        return counts;
    } catch (error) {
        try {
            await client.query('rollback');
        } catch {
            discardClient = true;
        }
        throw error;
    } finally {
        client.release(discardClient);
        client.removeListener('error', onConnectionError);
    }
}

export async function pruneSystemActivity() {
    const database = getPool();
    if (!database) return null;
    const result = await database.query<{ deliveries: number; events: number }>(
        activityRetentionSql,
    );
    return result.rows[0] ?? null;
}

export async function storeSystemActivity(
    source: SystemActivityInput['source'],
    deliveryId: string,
    events: SystemActivityInput[],
) {
    // Keep direct persistence and its retention behavior until buffer rollout.
    const result = await storeActivityBatch(
        [activityDelivery(source, deliveryId, events)],
        { cleanup: true },
    );
    return result === null
        ? 'unavailable'
        : result.deliveries === 0
          ? 'duplicate'
          : 'stored';
}
