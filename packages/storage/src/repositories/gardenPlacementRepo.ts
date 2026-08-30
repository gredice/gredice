import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { gardenBlocks, gardenStacks, gardens } from '../schema';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
export type GardenPlacementTransaction = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = GardenPlacementTransaction | StorageClient;

const gardenPlacementLockTails = new Map<string, Promise<void>>();

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

function gardenPlacementLockKey(gardenId: number) {
    return `garden-placement:${gardenId.toString()}`;
}

function assertGardenId(gardenId: number) {
    if (!Number.isSafeInteger(gardenId) || gardenId <= 0) {
        throw new RangeError('Garden placement lock requires a positive ID');
    }
}

async function withGardenPlacementInProcessLock<T>(
    key: string,
    callback: () => Promise<T>,
) {
    const previous = gardenPlacementLockTails.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    gardenPlacementLockTails.set(key, tail);

    await previous;
    try {
        return await callback();
    } finally {
        release();
        if (gardenPlacementLockTails.get(key) === tail) {
            gardenPlacementLockTails.delete(key);
        }
    }
}

/**
 * Serialize every footprint-changing command for one garden. Callers that
 * also mutate account inventory or currency must acquire those account locks
 * first and pass their transaction here, preserving the global lock order.
 */
export async function withGardenPlacementTransaction<T>(
    gardenId: number,
    callback: (transaction: GardenPlacementTransaction) => Promise<T>,
    transaction?: GardenPlacementTransaction,
) {
    assertGardenId(gardenId);
    const key = gardenPlacementLockKey(gardenId);
    const runInTransaction = async (db: GardenPlacementTransaction) => {
        if (!isPgliteTestDatabase()) {
            await db.execute(
                sql`select pg_advisory_xact_lock(hashtext(${key}));`,
            );
        }
        return callback(db);
    };
    const run = () =>
        transaction
            ? runInTransaction(transaction)
            : storage().transaction(runInTransaction);

    return isPgliteTestDatabase()
        ? withGardenPlacementInProcessLock(key, run)
        : run();
}

export type GardenPlacementSnapshot = Readonly<{
    garden: Readonly<{
        id: number;
        accountId: string;
        isSandbox: boolean;
    }>;
    stacks: readonly (typeof gardenStacks.$inferSelect)[];
    blocks: readonly (typeof gardenBlocks.$inferSelect)[];
}>;

/**
 * Read the placement authority through one transaction client after the
 * garden lock is held. This intentionally avoids the broader getGarden query,
 * whose unrelated relation reads may use other database clients.
 */
export async function getGardenPlacementSnapshot(
    gardenId: number,
    db: DatabaseClient,
): Promise<GardenPlacementSnapshot | null> {
    assertGardenId(gardenId);
    const garden = (
        await db
            .select({
                id: gardens.id,
                accountId: gardens.accountId,
                isSandbox: gardens.isSandbox,
            })
            .from(gardens)
            .where(and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)))
            .limit(1)
    )[0];
    if (!garden) {
        return null;
    }

    const stacks = await db
        .select()
        .from(gardenStacks)
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.isDeleted, false),
            ),
        )
        .orderBy(asc(gardenStacks.id));
    const blocks = await db
        .select()
        .from(gardenBlocks)
        .where(
            and(
                eq(gardenBlocks.gardenId, gardenId),
                eq(gardenBlocks.isDeleted, false),
            ),
        )
        .orderBy(asc(gardenBlocks.id));

    return { garden, stacks, blocks };
}

/**
 * Lock and read the complete active placement authority for one garden.
 * Locks are acquired in a deterministic order: garden row, stack rows by ID,
 * then block rows by ID. The caller must provide the transaction that owns
 * the surrounding account and garden-placement locks.
 */
export async function getGardenPlacementSnapshotForUpdate(
    gardenId: number,
    db: GardenPlacementTransaction,
): Promise<GardenPlacementSnapshot | null> {
    assertGardenId(gardenId);
    const garden = (
        await db
            .select({
                id: gardens.id,
                accountId: gardens.accountId,
                isSandbox: gardens.isSandbox,
            })
            .from(gardens)
            .where(and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)))
            .for('update')
            .limit(1)
    )[0];
    if (!garden) {
        return null;
    }

    const stacks = await db
        .select()
        .from(gardenStacks)
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.isDeleted, false),
            ),
        )
        .orderBy(asc(gardenStacks.id))
        .for('update');
    const blocks = await db
        .select()
        .from(gardenBlocks)
        .where(
            and(
                eq(gardenBlocks.gardenId, gardenId),
                eq(gardenBlocks.isDeleted, false),
            ),
        )
        .orderBy(asc(gardenBlocks.id))
        .for('update');

    return { garden, stacks, blocks };
}
