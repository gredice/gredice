import 'server-only';
import { randomUUID } from 'node:crypto';
import type { ActivityBuffer } from './activityBuffer';
import { MAX_FLUSH_BATCHES } from './activityDelivery';
import { storeActivityBatch } from './storeSystemActivity';

export async function flushSystemActivity(
    buffer: ActivityBuffer,
    persist = storeActivityBatch,
    now = Date.now,
) {
    const startedAt = now();
    const token = randomUUID();
    let batches = 0;
    let deliveries = 0;
    let buckets = 0;
    let duplicates = 0;
    let oldestAgeMs = 0;
    try {
        while (batches < MAX_FLUSH_BATCHES && now() - startedAt < 40_000) {
            const batch = await buffer.read(token);
            if (batch.status !== 'ready') {
                return {
                    status: batch.status,
                    batches,
                    deliveries,
                    buckets,
                    duplicates,
                    oldestAgeMs,
                };
            }
            const oldest = batch.deliveries[0];
            if (oldest)
                oldestAgeMs = Math.max(
                    oldestAgeMs,
                    now() - Date.parse(oldest.receivedAt),
                );
            const stored = await persist(batch.deliveries);
            if (stored === null)
                throw new Error('Activity persistence is unavailable.');
            // Failed/ambiguous commit or ACK leaves the same immutable delivery
            // queued. PostgreSQL's marker prevents counting a committed retry.
            await buffer.acknowledge(
                token,
                batch.deliveries.map(({ id }) => id),
            );
            batches += 1;
            deliveries += stored.deliveries;
            buckets += stored.buckets;
            duplicates += batch.deliveries.length - stored.deliveries;
        }
        return {
            status: 'bounded',
            batches,
            deliveries,
            buckets,
            duplicates,
            oldestAgeMs,
        };
    } finally {
        try {
            await buffer.release(token);
        } catch {
            // The 60-second lease expires; release failure cannot change ACK or
            // replace the original operation failure. No payload/error logging.
            console.warn('Unable to release status activity flush lease.');
        }
    }
}
