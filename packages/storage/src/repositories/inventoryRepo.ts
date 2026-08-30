import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { events } from '../schema';
import { storage } from '../storage';
import { withAccountDeletionFenceTransaction } from './accountDeletionFenceRepo';
import {
    createEvent,
    getAllEvents,
    knownEvents,
    knownEventTypes,
} from './events';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
export type GardenBoxInventoryTransaction = TransactionClient;
type DatabaseClient = TransactionClient | StorageClient;

const checkoutInventorySourcePrefix = 'shoppingCartItem:';
const inventoryLockTails = new Map<string, Promise<void>>();

export const GARDEN_BOX_BLOCK_STACK_LIMIT = 6;
export const GARDEN_BOX_BLOCK_STACK_SIZE = 10;

type InventoryItemEventPayload = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    source?: string | null;
};

type InventoryItemFields = Pick<
    InventoryItemEventPayload,
    'entityTypeName' | 'entityId' | 'amount'
>;

export type CheckoutInventoryConsumption = {
    cartItemId: number;
    source: string;
    entityTypeName: string;
    entityId: string;
    amount: number;
};

export class InventoryConsumptionSourceConflictError extends Error {
    override name = 'InventoryConsumptionSourceConflictError';

    constructor(
        readonly source: string,
        message: string,
    ) {
        super(message);
    }
}

export class GardenBoxInventoryLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GardenBoxInventoryLimitError';
    }
}

export class GardenBoxInventoryInsufficientError extends Error {
    override readonly name = 'GardenBoxInventoryInsufficientError';

    constructor(
        readonly availableAmount: number,
        readonly requestedAmount: number,
    ) {
        super('Nedovoljno predmeta u vrtnoj kutiji');
    }
}

const INVENTORY_PREFIX = 'inventory:';

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

async function withInventoryInProcessLock<T>(
    key: string,
    callback: () => Promise<T>,
) {
    const previous = inventoryLockTails.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    inventoryLockTails.set(key, tail);

    await previous;
    try {
        return await callback();
    } finally {
        release();
        if (inventoryLockTails.get(key) === tail) {
            inventoryLockTails.delete(key);
        }
    }
}

function getInventoryAggregateId(accountId: string) {
    return `${INVENTORY_PREFIX}${accountId}`;
}

export type InventoryItem = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    updatedAt: Date;
};

export type InventoryItemInput = Omit<InventoryItemEventPayload, 'source'>;

export async function addInventoryItem(
    accountId: string,
    payload: InventoryItemEventPayload,
    db: DatabaseClient = storage(),
) {
    await createEvent(
        knownEvents.inventory.addedV1(
            getInventoryAggregateId(accountId),
            payload,
        ),
        db,
    );
}

function getGardenBoxInventoryAggregateId({
    accountId,
    gardenId,
    blockId,
}: {
    accountId: string;
    gardenId: number;
    blockId: string;
}) {
    return `${INVENTORY_PREFIX}${accountId}:gardenBox:${gardenId.toString()}:${blockId}`;
}

function inventoryItemKey(
    item: Pick<InventoryItem, 'entityTypeName' | 'entityId'>,
) {
    return `${item.entityTypeName}-${item.entityId}`;
}

function normalizeGardenBoxInventoryItems(items: InventoryItemFields[]) {
    const totals = new Map<string, InventoryItemFields>();

    for (const item of items) {
        if (item.amount <= 0) {
            continue;
        }

        const key = inventoryItemKey(item);
        const existing = totals.get(key);
        totals.set(key, {
            entityTypeName: item.entityTypeName,
            entityId: item.entityId,
            amount: (existing?.amount ?? 0) + item.amount,
        });
    }

    return Array.from(totals.values());
}

function validateGardenBoxInventoryItems(items: InventoryItemFields[]) {
    const normalizedItems = normalizeGardenBoxInventoryItems(items);
    const nonBlockItem = normalizedItems.find(
        (item) => item.entityTypeName !== 'block',
    );
    if (nonBlockItem) {
        throw new GardenBoxInventoryLimitError(
            'Vrtna kutija može sadržavati samo blokove.',
        );
    }

    if (normalizedItems.length > GARDEN_BOX_BLOCK_STACK_LIMIT) {
        throw new GardenBoxInventoryLimitError(
            `Vrtna kutija može sadržavati najviše ${GARDEN_BOX_BLOCK_STACK_LIMIT.toString()} različitih blokova.`,
        );
    }

    const overfilledItem = normalizedItems.find(
        (item) => item.amount > GARDEN_BOX_BLOCK_STACK_SIZE,
    );
    if (overfilledItem) {
        throw new GardenBoxInventoryLimitError(
            `U vrtnoj kutiji može biti najviše ${GARDEN_BOX_BLOCK_STACK_SIZE.toString()} blokova iste vrste.`,
        );
    }
}

async function lockInventoryAggregate(aggregateId: string, db: DatabaseClient) {
    await db.execute(
        sql`select pg_advisory_xact_lock(hashtext(${aggregateId}));`,
    );
}

/**
 * Run account-inventory work while holding the same aggregate lock used by
 * checkout consumption. Acquire this lock before any cart-row locks so
 * normalization and consumption have one stable lock order.
 */
export async function withInventoryAccountTransaction<T>(
    accountId: string,
    callback: (db: TransactionClient) => Promise<T>,
    transaction?: TransactionClient,
) {
    const aggregateId = getInventoryAggregateId(accountId);
    const runInTransaction = async (db: TransactionClient) => {
        if (!isPgliteTestDatabase()) {
            await lockInventoryAggregate(aggregateId, db);
        }
        return callback(db);
    };
    const run = () =>
        transaction
            ? runInTransaction(transaction)
            : storage().transaction(runInTransaction);

    return isPgliteTestDatabase()
        ? withInventoryInProcessLock(aggregateId, run)
        : run();
}

/**
 * Serialize mutations for one physical GardenBox inventory aggregate. Callers
 * that also change garden placement must acquire this lock first, then pass
 * the same transaction to the garden placement lock.
 */
export async function withGardenBoxInventoryTransaction<T>(
    accountId: string,
    gardenId: number,
    blockId: string,
    callback: (db: GardenBoxInventoryTransaction) => Promise<T>,
    transaction?: GardenBoxInventoryTransaction,
) {
    const aggregateId = getGardenBoxInventoryAggregateId({
        accountId,
        gardenId,
        blockId,
    });
    const runInTransaction = async (db: GardenBoxInventoryTransaction) => {
        if (!isPgliteTestDatabase()) {
            await lockInventoryAggregate(aggregateId, db);
        }
        return withAccountDeletionFenceTransaction(accountId, callback, db);
    };
    const run = () =>
        transaction
            ? runInTransaction(transaction)
            : storage().transaction(runInTransaction);

    return isPgliteTestDatabase()
        ? withInventoryInProcessLock(aggregateId, run)
        : run();
}

async function getInventoryForAggregateIds(
    aggregateIds: string[],
    db: DatabaseClient = storage(),
) {
    if (aggregateIds.length === 0) {
        return [];
    }

    const inventoryEvents = await getAllEvents(
        [knownEventTypes.inventory.add, knownEventTypes.inventory.consume],
        aggregateIds,
        { db },
    );

    const totals = new Map<string, InventoryItem>();

    for (const event of inventoryEvents) {
        const data = event.data as InventoryItemEventPayload | null;
        if (!data) continue;

        const key = inventoryItemKey(data);
        const existing = totals.get(key) ?? {
            entityTypeName: data.entityTypeName,
            entityId: data.entityId,
            amount: 0,
            updatedAt: event.createdAt,
        };

        const delta =
            event.type === knownEventTypes.inventory.consume
                ? -data.amount
                : data.amount;

        totals.set(key, {
            ...existing,
            amount: existing.amount + delta,
            updatedAt: event.createdAt,
        });
    }

    return Array.from(totals.values()).filter((item) => item.amount > 0);
}

function checkoutCartItemIdFromSource(source: string) {
    if (!source.startsWith(checkoutInventorySourcePrefix)) {
        return null;
    }
    const value = source.slice(checkoutInventorySourcePrefix.length);
    const cartItemId = Number(value);
    if (
        !Number.isSafeInteger(cartItemId) ||
        cartItemId <= 0 ||
        value !== cartItemId.toString()
    ) {
        throw new InventoryConsumptionSourceConflictError(
            source,
            'Checkout inventory consumption source has an invalid cart item id.',
        );
    }
    return cartItemId;
}

function checkoutInventoryConsumptionFromPayload(
    payload: InventoryItemEventPayload,
): CheckoutInventoryConsumption | null {
    if (typeof payload.source !== 'string') {
        return null;
    }
    const cartItemId = checkoutCartItemIdFromSource(payload.source);
    if (cartItemId === null) {
        return null;
    }
    if (
        payload.entityTypeName.length === 0 ||
        payload.entityId.length === 0 ||
        !Number.isSafeInteger(payload.amount) ||
        payload.amount <= 0
    ) {
        throw new InventoryConsumptionSourceConflictError(
            payload.source,
            'Checkout inventory consumption payload is malformed.',
        );
    }
    return {
        cartItemId,
        source: payload.source,
        entityTypeName: payload.entityTypeName,
        entityId: payload.entityId,
        amount: payload.amount,
    };
}

function parseCheckoutInventoryConsumption(
    data: unknown,
): CheckoutInventoryConsumption | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return null;
    }
    const payload = data as Record<string, unknown>;
    if (
        typeof payload.source !== 'string' ||
        !payload.source.startsWith(checkoutInventorySourcePrefix)
    ) {
        return null;
    }
    if (
        typeof payload.entityTypeName !== 'string' ||
        typeof payload.entityId !== 'string' ||
        typeof payload.amount !== 'number'
    ) {
        throw new InventoryConsumptionSourceConflictError(
            payload.source,
            'Checkout inventory consumption payload is malformed.',
        );
    }
    return checkoutInventoryConsumptionFromPayload({
        source: payload.source,
        entityTypeName: payload.entityTypeName,
        entityId: payload.entityId,
        amount: payload.amount,
    });
}

function assertMatchingCheckoutInventoryConsumption(
    existing: CheckoutInventoryConsumption,
    expected: CheckoutInventoryConsumption,
) {
    if (
        existing.cartItemId !== expected.cartItemId ||
        existing.entityTypeName !== expected.entityTypeName ||
        existing.entityId !== expected.entityId ||
        existing.amount !== expected.amount
    ) {
        throw new InventoryConsumptionSourceConflictError(
            expected.source,
            'Checkout inventory consumption source has conflicting item data.',
        );
    }
}

async function readCheckoutInventoryConsumptions(
    accountId: string,
    sources: readonly string[],
    db: DatabaseClient,
) {
    if (sources.length === 0) {
        return new Map<string, CheckoutInventoryConsumption>();
    }
    const consumptionEvents = await db.query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.inventory.consume),
            eq(events.aggregateId, getInventoryAggregateId(accountId)),
            inArray(sql<string>`${events.data}->>'source'`, [...sources]),
        ),
        orderBy: (events, { asc }) => [asc(events.id)],
    });
    const bySource = new Map<string, CheckoutInventoryConsumption>();
    for (const event of consumptionEvents) {
        const consumption = parseCheckoutInventoryConsumption(event.data);
        if (!consumption) {
            continue;
        }
        const existing = bySource.get(consumption.source);
        if (existing) {
            assertMatchingCheckoutInventoryConsumption(existing, consumption);
            throw new InventoryConsumptionSourceConflictError(
                consumption.source,
                'Checkout inventory consumption source has multiple events.',
            );
        }
        bySource.set(consumption.source, consumption);
    }
    return bySource;
}

export async function getCheckoutInventoryConsumptions(
    accountId: string,
    cartItemIds: readonly number[],
    db: DatabaseClient = storage(),
): Promise<CheckoutInventoryConsumption[]> {
    const requestedSources = new Set(
        cartItemIds.map((cartItemId) => {
            if (!Number.isSafeInteger(cartItemId) || cartItemId <= 0) {
                const source = `${checkoutInventorySourcePrefix}${cartItemId.toString()}`;
                throw new InventoryConsumptionSourceConflictError(
                    source,
                    'Checkout cart item id must be a positive safe integer.',
                );
            }
            return `${checkoutInventorySourcePrefix}${cartItemId.toString()}`;
        }),
    );
    if (requestedSources.size === 0) {
        return [];
    }

    const consumptions = await readCheckoutInventoryConsumptions(
        accountId,
        [...requestedSources],
        db,
    );
    return Array.from(consumptions.values()).filter((consumption) =>
        requestedSources.has(consumption.source),
    );
}

export async function getCheckoutInventorySnapshot(
    accountId: string,
    cartItemIds: readonly number[],
) {
    return withInventoryAccountTransaction(accountId, async (db) => {
        // Keep these reads ordered inside the locked transaction. Under READ
        // COMMITTED, the aggregate lock prevents checkout consumption from
        // committing between the balance and source projections.
        const inventory = await getInventory(accountId, db);
        const consumptions = await getCheckoutInventoryConsumptions(
            accountId,
            cartItemIds,
            db,
        );
        return { inventory, consumptions };
    });
}

async function consumeInventoryItemInTransaction(
    accountId: string,
    payload: InventoryItemEventPayload,
    db: DatabaseClient,
) {
    const expectedCheckoutConsumption =
        checkoutInventoryConsumptionFromPayload(payload);
    if (expectedCheckoutConsumption) {
        const existingConsumptions = await readCheckoutInventoryConsumptions(
            accountId,
            [expectedCheckoutConsumption.source],
            db,
        );
        const existing = existingConsumptions.get(
            expectedCheckoutConsumption.source,
        );
        if (existing) {
            assertMatchingCheckoutInventoryConsumption(
                existing,
                expectedCheckoutConsumption,
            );
            return;
        }
    }

    const inventory = await getInventoryForAggregateIds(
        [getInventoryAggregateId(accountId)],
        db,
    );
    const currentAmount =
        inventory.find(
            (item) =>
                item.entityTypeName === payload.entityTypeName &&
                item.entityId === payload.entityId,
        )?.amount ?? 0;

    if (currentAmount < payload.amount) {
        throw new Error('Nedovoljno predmeta u ruksaku');
    }

    await createEvent(
        knownEvents.inventory.consumedV1(
            getInventoryAggregateId(accountId),
            payload,
        ),
        db,
    );
}

export async function consumeInventoryItem(
    accountId: string,
    payload: InventoryItemEventPayload,
    db?: DatabaseClient,
) {
    if (db) {
        await consumeInventoryItemInTransaction(accountId, payload, db);
        return;
    }

    await withInventoryAccountTransaction(accountId, (transaction) =>
        consumeInventoryItemInTransaction(accountId, payload, transaction),
    );
}

export async function getInventory(
    accountId: string,
    db: DatabaseClient = storage(),
) {
    return getInventoryForAggregateIds(
        [getInventoryAggregateId(accountId)],
        db,
    );
}

export async function getGardenBoxInventory(
    accountId: string,
    gardenId: number,
    blockId: string,
    db: DatabaseClient = storage(),
) {
    return getInventoryForAggregateIds(
        [getGardenBoxInventoryAggregateId({ accountId, gardenId, blockId })],
        db,
    );
}

export async function addGardenBoxInventoryItem(
    accountId: string,
    gardenId: number,
    blockId: string,
    payload: InventoryItemEventPayload,
    db?: GardenBoxInventoryTransaction,
) {
    if (!db) {
        await withGardenBoxInventoryTransaction(
            accountId,
            gardenId,
            blockId,
            (tx) =>
                addGardenBoxInventoryItem(
                    accountId,
                    gardenId,
                    blockId,
                    payload,
                    tx,
                ),
        );
        return;
    }

    const aggregateId = getGardenBoxInventoryAggregateId({
        accountId,
        gardenId,
        blockId,
    });
    await lockInventoryAggregate(aggregateId, db);
    const currentInventory = await getInventoryForAggregateIds(
        [aggregateId],
        db,
    );
    validateGardenBoxInventoryItems([...currentInventory, payload]);

    await createEvent(knownEvents.inventory.addedV1(aggregateId, payload), db);
}

export async function consumeGardenBoxInventoryItem(
    accountId: string,
    gardenId: number,
    blockId: string,
    payload: InventoryItemEventPayload,
    db?: GardenBoxInventoryTransaction,
) {
    if (!db) {
        await withGardenBoxInventoryTransaction(
            accountId,
            gardenId,
            blockId,
            (transaction) =>
                consumeGardenBoxInventoryItem(
                    accountId,
                    gardenId,
                    blockId,
                    payload,
                    transaction,
                ),
        );
        return;
    }

    const aggregateId = getGardenBoxInventoryAggregateId({
        accountId,
        gardenId,
        blockId,
    });
    await lockInventoryAggregate(aggregateId, db);
    const inventory = await getInventoryForAggregateIds([aggregateId], db);
    const currentAmount =
        inventory.find(
            (item) =>
                item.entityTypeName === payload.entityTypeName &&
                item.entityId === payload.entityId,
        )?.amount ?? 0;

    if (currentAmount < payload.amount) {
        throw new GardenBoxInventoryInsufficientError(
            currentAmount,
            payload.amount,
        );
    }

    await createEvent(
        knownEvents.inventory.consumedV1(aggregateId, payload),
        db,
    );
}

export async function setGardenBoxInventory(
    accountId: string,
    gardenId: number,
    blockId: string,
    items: InventoryItemInput[],
) {
    const aggregateId = getGardenBoxInventoryAggregateId({
        accountId,
        gardenId,
        blockId,
    });
    const requestedTotals = new Map<string, InventoryItemInput>();

    for (const item of items) {
        if (item.amount <= 0) {
            continue;
        }

        const key = inventoryItemKey(item);
        const existing = requestedTotals.get(key);
        requestedTotals.set(key, {
            entityTypeName: item.entityTypeName,
            entityId: item.entityId,
            amount: (existing?.amount ?? 0) + item.amount,
        });
    }

    validateGardenBoxInventoryItems(Array.from(requestedTotals.values()));

    await withGardenBoxInventoryTransaction(
        accountId,
        gardenId,
        blockId,
        async (tx) => {
            const currentInventory = await getInventoryForAggregateIds(
                [aggregateId],
                tx,
            );
            const currentTotals = new Map(
                currentInventory.map((item) => [inventoryItemKey(item), item]),
            );
            const inventoryKeys = new Set([
                ...currentTotals.keys(),
                ...requestedTotals.keys(),
            ]);

            for (const key of inventoryKeys) {
                const current = currentTotals.get(key);
                const requested = requestedTotals.get(key);
                const currentAmount = current?.amount ?? 0;
                const requestedAmount = requested?.amount ?? 0;
                const delta = requestedAmount - currentAmount;

                if (delta > 0 && requested) {
                    await addGardenBoxInventoryItem(
                        accountId,
                        gardenId,
                        blockId,
                        {
                            entityTypeName: requested.entityTypeName,
                            entityId: requested.entityId,
                            amount: delta,
                            source: 'gardenBox:set',
                        },
                        tx,
                    );
                } else if (delta < 0 && current) {
                    await createEvent(
                        knownEvents.inventory.consumedV1(
                            getGardenBoxInventoryAggregateId({
                                accountId,
                                gardenId,
                                blockId,
                            }),
                            {
                                entityTypeName: current.entityTypeName,
                                entityId: current.entityId,
                                amount: Math.abs(delta),
                                source: 'gardenBox:set',
                            },
                        ),
                        tx,
                    );
                }
            }
        },
    );

    return getGardenBoxInventory(accountId, gardenId, blockId);
}

export async function getLastInventoryUpdate(accountId: string) {
    const aggregateId = getInventoryAggregateId(accountId);
    const [latestEvent] = await storage().query.events.findMany({
        where: and(
            eq(events.aggregateId, aggregateId),
            gte(events.createdAt, new Date('2024-01-01')),
        ),
        orderBy: (events, { desc }) => [desc(events.createdAt)],
        limit: 1,
    });

    return latestEvent?.createdAt ?? null;
}
