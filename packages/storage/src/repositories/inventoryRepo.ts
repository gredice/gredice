import { and, eq, gte, sql } from 'drizzle-orm';
import { events } from '../schema';
import { storage } from '../storage';
import { createEvent, getEvents, knownEvents, knownEventTypes } from './events';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

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

export class GardenBoxInventoryLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GardenBoxInventoryLimitError';
    }
}

const INVENTORY_PREFIX = 'inventory:';

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

async function getInventoryForAggregateIds(
    aggregateIds: string[],
    db: DatabaseClient = storage(),
) {
    if (aggregateIds.length === 0) {
        return [];
    }

    const inventoryEvents = await getEvents(
        [knownEventTypes.inventory.add, knownEventTypes.inventory.consume],
        aggregateIds,
        0,
        5000,
        db,
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

export async function consumeInventoryItem(
    accountId: string,
    payload: InventoryItemEventPayload,
    db: DatabaseClient = storage(),
) {
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

export async function getInventory(accountId: string) {
    return getInventoryForAggregateIds([getInventoryAggregateId(accountId)]);
}

export async function getGardenBoxInventory(
    accountId: string,
    gardenId: number,
    blockId: string,
) {
    return getInventoryForAggregateIds([
        getGardenBoxInventoryAggregateId({ accountId, gardenId, blockId }),
    ]);
}

export async function addGardenBoxInventoryItem(
    accountId: string,
    gardenId: number,
    blockId: string,
    payload: InventoryItemEventPayload,
    db?: DatabaseClient,
) {
    if (!db) {
        await storage().transaction((tx) =>
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
    db: DatabaseClient = storage(),
) {
    const inventory = await getInventoryForAggregateIds(
        [getGardenBoxInventoryAggregateId({ accountId, gardenId, blockId })],
        db,
    );
    const currentAmount =
        inventory.find(
            (item) =>
                item.entityTypeName === payload.entityTypeName &&
                item.entityId === payload.entityId,
        )?.amount ?? 0;

    if (currentAmount < payload.amount) {
        throw new Error('Nedovoljno predmeta u vrtnoj kutiji');
    }

    await createEvent(
        knownEvents.inventory.consumedV1(
            getGardenBoxInventoryAggregateId({ accountId, gardenId, blockId }),
            payload,
        ),
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

    await storage().transaction(async (tx) => {
        await lockInventoryAggregate(aggregateId, tx);

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
    });

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
