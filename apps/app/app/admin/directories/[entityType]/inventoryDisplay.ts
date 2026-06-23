import type {
    getEntitiesRaw,
    getInventoryItemsByConfig,
} from '@gredice/storage';

type Entity = Awaited<ReturnType<typeof getEntitiesRaw>>[number];
type InventoryItem = Awaited<
    ReturnType<typeof getInventoryItemsByConfig>
>[number];

export type EntityInventoryItem = {
    entityId: number | null;
    quantity: number;
    lowCountThreshold: number | null;
};

function parseEntityId(value: string | null | undefined) {
    const normalized = value?.trim();
    if (!normalized || !/^\d+$/.test(normalized)) {
        return null;
    }

    return Number.parseInt(normalized, 10);
}

function addThreshold(current: number | null, next: number | null | undefined) {
    if (next === null || typeof next === 'undefined') {
        return current;
    }

    return (current ?? 0) + next;
}

export function aggregateRelatedInventoryItems({
    sourceAttributeDefinitionId,
    sourceEntities,
    inventoryItems,
}: {
    sourceAttributeDefinitionId: number;
    sourceEntities: Entity[];
    inventoryItems: Pick<
        InventoryItem,
        'entityId' | 'quantity' | 'lowCountThreshold'
    >[];
}): EntityInventoryItem[] {
    const parentEntityIdBySourceEntityId = new Map<number, number>();

    for (const sourceEntity of sourceEntities) {
        const parentEntityId = parseEntityId(
            sourceEntity.attributes.find(
                (attribute) =>
                    attribute.attributeDefinitionId ===
                    sourceAttributeDefinitionId,
            )?.value,
        );

        if (parentEntityId !== null) {
            parentEntityIdBySourceEntityId.set(sourceEntity.id, parentEntityId);
        }
    }

    const inventoryByParentEntityId = new Map<number, EntityInventoryItem>();

    for (const item of inventoryItems) {
        if (item.entityId === null) {
            continue;
        }

        const parentEntityId = parentEntityIdBySourceEntityId.get(
            item.entityId,
        );
        if (typeof parentEntityId === 'undefined') {
            continue;
        }

        const current = inventoryByParentEntityId.get(parentEntityId) ?? {
            entityId: parentEntityId,
            quantity: 0,
            lowCountThreshold: null,
        };

        inventoryByParentEntityId.set(parentEntityId, {
            ...current,
            quantity: current.quantity + item.quantity,
            lowCountThreshold: addThreshold(
                current.lowCountThreshold,
                item.lowCountThreshold,
            ),
        });
    }

    return Array.from(inventoryByParentEntityId.values());
}
