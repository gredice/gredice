import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    getEntitiesRaw,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { aggregateRelatedInventoryItems } from './inventoryDisplay';

type Entity = Awaited<ReturnType<typeof getEntitiesRaw>>[number];
type InventoryItem = Awaited<
    ReturnType<typeof getInventoryItemsByConfig>
>[number];

const plantSortAttributeDefinitionId = 45;

function sourceEntity(id: number, plantSortId: string | null): Entity {
    return {
        id,
        attributes:
            plantSortId === null
                ? []
                : [
                      {
                          attributeDefinitionId: plantSortAttributeDefinitionId,
                          value: plantSortId,
                      },
                  ],
    } as Entity;
}

function inventoryItem(
    entityId: number | null,
    quantity: number,
    lowCountThreshold: number | null = null,
): Pick<InventoryItem, 'entityId' | 'quantity' | 'lowCountThreshold'> {
    return { entityId, quantity, lowCountThreshold };
}

test('aggregateRelatedInventoryItems rolls child inventory up to parent entities', () => {
    const aggregated = aggregateRelatedInventoryItems({
        sourceAttributeDefinitionId: plantSortAttributeDefinitionId,
        sourceEntities: [
            sourceEntity(10, '100'),
            sourceEntity(11, '100'),
            sourceEntity(12, '200'),
            sourceEntity(13, null),
            sourceEntity(14, 'not-a-number'),
        ],
        inventoryItems: [
            inventoryItem(10, 3, 1),
            inventoryItem(11, 4, 2),
            inventoryItem(12, 7),
            inventoryItem(13, 9),
            inventoryItem(14, 8),
            inventoryItem(null, 6),
            inventoryItem(999, 5),
        ],
    });

    assert.deepEqual(
        aggregated.sort(
            (left, right) => (left.entityId ?? 0) - (right.entityId ?? 0),
        ),
        [
            {
                entityId: 100,
                quantity: 7,
                lowCountThreshold: 3,
            },
            {
                entityId: 200,
                quantity: 7,
                lowCountThreshold: null,
            },
        ],
    );
});
