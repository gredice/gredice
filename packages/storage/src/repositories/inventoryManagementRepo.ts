import 'server-only';
import { and, eq } from 'drizzle-orm';
import {
    type InsertInventoryConfig,
    type InsertInventoryItem,
    type InsertInventoryItemEvent,
    type InsertInventoryItemFieldDefinition,
    inventoryConfigs,
    inventoryItemEvents,
    inventoryItemFieldDefinitions,
    inventoryItems,
    type UpdateInventoryConfig,
    type UpdateInventoryItem,
    type UpdateInventoryItemFieldDefinition,
} from '../schema';
import { storage } from '../storage';

// ==================== Inventory Configs ====================

export async function getInventoryConfigs() {
    return storage().query.inventoryConfigs.findMany({
        where: eq(inventoryConfigs.isDeleted, false),
        orderBy: (table, { asc }) => [asc(table.label)],
        with: {
            fieldDefinitions: {
                where: eq(inventoryItemFieldDefinitions.isDeleted, false),
                orderBy: (table, { asc }) => [asc(table.order)],
            },
        },
    });
}

export async function getInventoryConfig(id: number) {
    return storage().query.inventoryConfigs.findFirst({
        where: and(
            eq(inventoryConfigs.id, id),
            eq(inventoryConfigs.isDeleted, false),
        ),
        with: {
            fieldDefinitions: {
                where: eq(inventoryItemFieldDefinitions.isDeleted, false),
                orderBy: (table, { asc }) => [asc(table.order)],
            },
        },
    });
}

export async function getInventoryConfigByEntityTypeName(
    entityTypeName: string,
) {
    return storage().query.inventoryConfigs.findFirst({
        where: and(
            eq(inventoryConfigs.entityTypeName, entityTypeName),
            eq(inventoryConfigs.isDeleted, false),
        ),
        with: {
            fieldDefinitions: {
                where: eq(inventoryItemFieldDefinitions.isDeleted, false),
                orderBy: (table, { asc }) => [asc(table.order)],
            },
        },
    });
}

export async function createInventoryConfig(
    data: Omit<
        InsertInventoryConfig,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
) {
    const [created] = await storage()
        .insert(inventoryConfigs)
        .values(data)
        .returning({ id: inventoryConfigs.id });
    return created.id;
}

export async function updateInventoryConfig(data: UpdateInventoryConfig) {
    const { id, ...updates } = data;
    await storage()
        .update(inventoryConfigs)
        .set(updates)
        .where(eq(inventoryConfigs.id, id));
}

export async function deleteInventoryConfig(id: number) {
    await storage()
        .update(inventoryConfigs)
        .set({ isDeleted: true })
        .where(eq(inventoryConfigs.id, id));
}

// ==================== Inventory Item Field Definitions ====================

export async function getInventoryItemFieldDefinitions(
    inventoryConfigId: number,
) {
    return storage().query.inventoryItemFieldDefinitions.findMany({
        where: and(
            eq(
                inventoryItemFieldDefinitions.inventoryConfigId,
                inventoryConfigId,
            ),
            eq(inventoryItemFieldDefinitions.isDeleted, false),
        ),
        orderBy: (table, { asc }) => [asc(table.order)],
    });
}

export async function createInventoryItemFieldDefinition(
    data: Omit<
        InsertInventoryItemFieldDefinition,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
) {
    const [created] = await storage()
        .insert(inventoryItemFieldDefinitions)
        .values(data)
        .returning({ id: inventoryItemFieldDefinitions.id });
    return created.id;
}

export async function updateInventoryItemFieldDefinition(
    data: UpdateInventoryItemFieldDefinition,
) {
    const { id, ...updates } = data;
    await storage()
        .update(inventoryItemFieldDefinitions)
        .set(updates)
        .where(eq(inventoryItemFieldDefinitions.id, id));
}

export async function deleteInventoryItemFieldDefinition(id: number) {
    await storage()
        .update(inventoryItemFieldDefinitions)
        .set({ isDeleted: true })
        .where(eq(inventoryItemFieldDefinitions.id, id));
}

// ==================== Inventory Items ====================

export async function getInventoryItemsByConfig(inventoryConfigId: number) {
    return storage().query.inventoryItems.findMany({
        where: and(
            eq(inventoryItems.inventoryConfigId, inventoryConfigId),
            eq(inventoryItems.isDeleted, false),
        ),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
        with: {
            entity: true,
        },
    });
}

export async function getInventoryItem(id: number) {
    return storage().query.inventoryItems.findFirst({
        where: and(
            eq(inventoryItems.id, id),
            eq(inventoryItems.isDeleted, false),
        ),
        with: {
            inventoryConfig: {
                with: {
                    fieldDefinitions: {
                        where: eq(
                            inventoryItemFieldDefinitions.isDeleted,
                            false,
                        ),
                        orderBy: (table, { asc }) => [asc(table.order)],
                    },
                },
            },
            entity: true,
        },
    });
}

export async function createInventoryItem(
    data: Omit<
        InsertInventoryItem,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
) {
    const [created] = await storage()
        .insert(inventoryItems)
        .values(data)
        .returning({ id: inventoryItems.id });
    return created.id;
}

export async function updateInventoryItem(data: UpdateInventoryItem) {
    const { id, ...updates } = data;
    await storage()
        .update(inventoryItems)
        .set(updates)
        .where(eq(inventoryItems.id, id));
}

export async function deleteInventoryItem(
    id: number,
    inventoryConfigId: number,
) {
    await storage()
        .update(inventoryItems)
        .set({ isDeleted: true })
        .where(
            and(
                eq(inventoryItems.id, id),
                eq(inventoryItems.inventoryConfigId, inventoryConfigId),
            ),
        );
}

export async function getInventoryItemEvents(inventoryItemId: number) {
    return storage().query.inventoryItemEvents.findMany({
        where: and(
            eq(inventoryItemEvents.inventoryItemId, inventoryItemId),
            eq(inventoryItemEvents.isDeleted, false),
        ),
        orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    });
}

export async function createInventoryItemEvent(
    data: Omit<InsertInventoryItemEvent, 'id' | 'createdAt' | 'isDeleted'>,
) {
    const [created] = await storage()
        .insert(inventoryItemEvents)
        .values(data)
        .returning({ id: inventoryItemEvents.id });
    return created.id;
}

export async function deleteInventoryItemEvent(
    id: number,
    inventoryItemId: number,
) {
    const [deleted] = await storage()
        .update(inventoryItemEvents)
        .set({ isDeleted: true })
        .where(
            and(
                eq(inventoryItemEvents.id, id),
                eq(inventoryItemEvents.inventoryItemId, inventoryItemId),
                eq(inventoryItemEvents.isDeleted, false),
            ),
        )
        .returning({ id: inventoryItemEvents.id });
    return Boolean(deleted);
}

// ==================== Summary ====================

export type InventoryItemsSummary = {
    totalItems: number;
    totalQuantity: number;
    byTrackingType: {
        pieces: number;
        serialNumber: number;
    };
};

export function computeInventoryItemsSummary(
    items: { quantity: number; trackingType: string }[],
): InventoryItemsSummary {
    const totalQuantity = items.reduce(
        (sum, item) => sum + (item.quantity ?? 0),
        0,
    );
    const byPieces = items.filter((i) => i.trackingType === 'pieces').length;
    const bySerial = items.filter(
        (i) => i.trackingType === 'serialNumber',
    ).length;

    return {
        totalItems: items.length,
        totalQuantity,
        byTrackingType: {
            pieces: byPieces,
            serialNumber: bySerial,
        },
    };
}
