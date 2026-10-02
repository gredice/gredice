import 'server-only';
import { configuredActivityBuffer } from './activityBuffer';
import { activityDeliveryChunks } from './activityDelivery';
import type { SystemActivityInput } from './ingestParsers';
import { storeSystemActivity } from './storeSystemActivity';

export async function acceptSystemActivity(
    source: SystemActivityInput['source'],
    deliveryId: string,
    events: SystemActivityInput[],
) {
    const mode = process.env.GREDICE_LIVE_INGEST_MODE?.trim() || 'direct';
    if (mode === 'direct')
        return storeSystemActivity(source, deliveryId, events);
    // An invalid mode/configuration fails closed instead of waking PG on error.
    if (mode !== 'buffered' || !process.env.CRON_SECRET?.trim())
        return 'unavailable';
    const buffer = configuredActivityBuffer();
    if (!buffer) return 'unavailable';
    let accepted = false;
    for (const delivery of activityDeliveryChunks(source, deliveryId, events)) {
        const result = await buffer.enqueue(delivery);
        if (result === 'full' || result === 'stale') return 'unavailable';
        if (result === 'buffered') accepted = true;
    }
    return accepted ? 'buffered' : 'duplicate';
}
