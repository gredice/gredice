import { sql } from 'drizzle-orm';
import 'server-only';
import { bustDeliveryRequestsCache } from '../cache/scheduleCache';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
export type DeliveryDispatchDatabaseClient = StorageClient | TransactionClient;

const deliveryDispatchLockKey = 'gredice:delivery-dispatch';

export async function acquireDeliveryDispatchLock(
    db: DeliveryDispatchDatabaseClient,
) {
    await db.execute(
        sql`select pg_advisory_xact_lock(hashtext(${deliveryDispatchLockKey}));`,
    );
}

export async function withDeliveryDispatchTransaction<T>(
    callback: (db: TransactionClient) => Promise<T>,
) {
    const result = await storage().transaction(async (tx) => {
        await acquireDeliveryDispatchLock(tx);
        return await callback(tx);
    });
    await bustDeliveryRequestsCache();
    return result;
}
