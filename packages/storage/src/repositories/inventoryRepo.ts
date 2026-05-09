import { and, eq, gte } from 'drizzle-orm';
import { events } from '../schema';
import { storage } from '../storage';
import { createEvent, getEvents, knownEvents, knownEventTypes } from './events';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

type InventoryItemEventPayload = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    source?: string | null;
};

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

export async function consumeInventoryItem(
    accountId: string,
    payload: InventoryItemEventPayload,
    db: DatabaseClient = storage(),
) {
    const inventory = await getInventory(accountId);
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
    const aggregateId = getInventoryAggregateId(accountId);
    const inventoryEvents = await getEvents(
        [knownEventTypes.inventory.add, knownEventTypes.inventory.consume],
        [aggregateId],
        0,
        5000,
    );

    const totals = new Map<string, InventoryItem>();

    for (const event of inventoryEvents) {
        const data = event.data as InventoryItemEventPayload | null;
        if (!data) continue;

        const key = `${data.entityTypeName}-${data.entityId}`;
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
