import 'server-only';

import { createHash } from 'node:crypto';
import type pg from 'pg';
import { createLiveActivityPool } from './createLiveActivityPool';
import type { SystemActivityInput } from './ingestParsers';
import { privateDeliveryId } from './ingestParsers';

type StoreSystemActivityResult = 'stored' | 'duplicate' | 'unavailable';

let pool: pg.Pool | undefined;

function getPool() {
    const connectionString =
        process.env.GREDICE_LIVE_INGEST_DATABASE_URL?.trim();
    if (!connectionString) {
        return null;
    }

    pool ??= createLiveActivityPool(connectionString, 'ingest');

    return pool;
}

function eventId(event: SystemActivityInput, deliveryId: string) {
    const identity =
        event.source === 'vercel'
            ? `${event.source}:${event.type}:${event.occurredAt.toISOString()}`
            : `${event.source}:${event.type}:${deliveryId}`;

    return createHash('sha256').update(identity).digest('base64url');
}

export async function storeSystemActivity(
    source: 'vercel' | 'github',
    deliveryId: string,
    events: SystemActivityInput[],
): Promise<StoreSystemActivityResult> {
    const database = getPool();
    if (!database) {
        return 'unavailable';
    }

    const client = await database.connect();
    let discardClient = false;
    // Checked-out clients have no pool error listener. pg still rejects pending
    // queries on disconnect; this listener prevents a second, uncaught error.
    const onConnectionError = () => {
        discardClient = true;
    };
    client.on('error', onConnectionError);
    try {
        await client.query('begin');
        const delivery = await client.query(
            `
                insert into status_live_ingest_deliveries (id, source)
                values ($1, $2)
                on conflict (id) do nothing
                returning id
            `,
            [privateDeliveryId(source, deliveryId), source],
        );

        if (delivery.rowCount === 0) {
            await client.query('rollback');
            return 'duplicate';
        }

        for (const event of events) {
            await client.query(
                `
                    insert into status_live_events (
                        id,
                        source,
                        type,
                        occurred_at,
                        event_count
                    )
                    values ($1, $2, $3, $4, $5)
                    on conflict (id) do update
                    set
                        event_count = least(
                            status_live_events.event_count + excluded.event_count,
                            2147483647
                        ),
                        updated_at = now()
                `,
                [
                    eventId(event, deliveryId),
                    event.source,
                    event.type,
                    event.occurredAt,
                    event.eventCount,
                ],
            );
        }

        await client.query(`
            delete from status_live_ingest_deliveries
            where received_at < now() - interval '7 days'
        `);
        await client.query(`
            delete from status_live_events
            where occurred_at < now() - interval '24 hours'
        `);
        await client.query('commit');
        return 'stored';
    } catch (error) {
        try {
            await client.query('rollback');
        } catch {
            // Preserve the operation's error if rollback also loses the connection.
            discardClient = true;
        }
        throw error;
    } finally {
        client.release(discardClient);
        client.removeListener('error', onConnectionError);
    }
}
