import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { farms, gardenBlocks, gardenStacks, gardens } from '../schema';
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

export type GardenMutationAuthority = Readonly<{
    accountId: string;
    id: number;
    isDeleted: boolean;
    isSandbox: boolean;
}>;

export type GardenPlacementLocation = Readonly<{
    lat: number;
    lon: number;
}>;

/**
 * Read the garden farm coordinates through the transaction that owns the
 * placement lock. This avoids acquiring a second pooled connection from
 * inside a long-running purchase transaction.
 */
export async function getGardenPlacementLocation(
    gardenId: number,
    db: DatabaseClient,
): Promise<GardenPlacementLocation | null> {
    assertGardenId(gardenId);
    return (
        (
            await db
                .select({
                    lat: farms.latitude,
                    lon: farms.longitude,
                })
                .from(gardens)
                .innerJoin(farms, eq(gardens.farmId, farms.id))
                .where(
                    and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)),
                )
                .limit(1)
        )[0] ?? null
    );
}

/**
 * Lock the owning garden row before consulting a garden-scoped mutation
 * receipt. Soft-deleted rows remain valid authorization authorities so exact
 * retries can replay a committed receipt. Hard deletion cascades receipts.
 */
export async function getGardenMutationAuthorityForUpdate(
    gardenId: number,
    db: GardenPlacementTransaction,
): Promise<GardenMutationAuthority | null> {
    assertGardenId(gardenId);
    return (
        (
            await db
                .select({
                    accountId: gardens.accountId,
                    id: gardens.id,
                    isDeleted: gardens.isDeleted,
                    isSandbox: gardens.isSandbox,
                })
                .from(gardens)
                .where(eq(gardens.id, gardenId))
                .for('update')
                .limit(1)
        )[0] ?? null
    );
}

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
