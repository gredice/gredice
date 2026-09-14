import assert from 'node:assert/strict';
import test from 'node:test';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    entityRevisions,
    entityTypes,
    getEntityAnchorPrices,
    getEntityPriceHistory,
    storage,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('getEntityPriceHistory derives the 30-day minimum and latest adjustment from entity revisions', async () => {
    createTestDb();
    const now = new Date('2026-07-11T10:00:00.000Z');
    const [entityType] = await storage()
        .insert(entityTypes)
        .values({
            name: 'priceHistoryTest',
            label: 'Price history test',
        })
        .returning({ name: entityTypes.name });
    const [priceDefinition] = await storage()
        .insert(attributeDefinitions)
        .values({
            entityTypeName: entityType.name,
            category: 'prices',
            name: 'amount',
            label: 'Price',
            dataType: 'number',
        })
        .returning({ id: attributeDefinitions.id });
    const [entity] = await storage()
        .insert(entities)
        .values({ entityTypeName: entityType.name })
        .returning({ id: entities.id });

    await storage()
        .insert(entityRevisions)
        .values([
            {
                entityId: entity.id,
                entityTypeName: entityType.name,
                action: 'attribute.updated',
                attributeDefinitionId: priceDefinition.id,
                previousValue: '20',
                nextValue: '17',
                createdAt: new Date('2026-05-01T10:00:00.000Z'),
            },
            {
                entityId: entity.id,
                entityTypeName: entityType.name,
                action: 'attribute.updated',
                attributeDefinitionId: priceDefinition.id,
                previousValue: '17',
                nextValue: '12.5',
                createdAt: new Date('2026-06-20T10:00:00.000Z'),
            },
            {
                entityId: entity.id,
                entityTypeName: entityType.name,
                action: 'attribute.updated',
                attributeDefinitionId: priceDefinition.id,
                previousValue: '12.5',
                nextValue: '15',
                createdAt: new Date('2026-07-05T10:00:00.000Z'),
            },
        ]);

    const result = await getEntityPriceHistory(
        [
            {
                key: 'test-price',
                entityId: entity.id,
                entityTypeName: entityType.name,
                attributeCategory: 'prices',
                attributeName: 'amount',
                currentPrice: 15,
            },
        ],
        { now },
    );

    assert.deepEqual(result['test-price'], {
        lowestPrice: 12.5,
        lastChangedAt: new Date('2026-07-05T10:00:00.000Z'),
    });
});

test('anchor lookup reads published prices before the reference day and excludes later changes from the 30-day minimum', async () => {
    createTestDb();
    const entityTypeName = 'anchorPriceTest';
    const before = new Date('2026-09-01T10:00:00Z');
    await storage()
        .insert(entityTypes)
        .values({ name: entityTypeName, label: 'Anchor price test' });
    const [definition] = await storage()
        .insert(attributeDefinitions)
        .values({
            entityTypeName,
            category: 'prices',
            name: 'amount',
            label: 'Amount',
            dataType: 'number',
        })
        .returning();
    const [entity] = await storage()
        .insert(entities)
        .values({
            entityTypeName,
            state: 'published',
            createdAt: before,
            publishedAt: before,
        })
        .returning();
    await storage()
        .insert(attributeValues)
        .values({
            entityId: entity.id,
            entityTypeName,
            attributeDefinitionId: definition.id,
            value: '7',
            createdAt: before,
            updatedAt: new Date('2026-09-15'),
        });
    await storage()
        .insert(entityRevisions)
        .values({
            entityId: entity.id,
            entityTypeName,
            attributeDefinitionId: definition.id,
            action: 'attribute.updated',
            previousValue: '5',
            nextValue: '7',
            createdAt: new Date('2026-09-15'),
        });
    const request = {
        key: 'anchor',
        entityId: entity.id,
        entityTypeName,
        attributeCategory: 'prices',
        attributeName: 'amount',
        currentPrice: 7,
    };
    const history = await getEntityPriceHistory([request], {
        now: new Date('2026-12-01'),
        anchorDate: '2026-09-10',
    });
    assert.deepEqual(history.anchor, {
        lowestPrice: 7,
        lastChangedAt: null,
        anchorPrice: { price: 5, date: '2026-09-10' },
    });
    assert.deepEqual(
        await getEntityAnchorPrices(
            [{ ...request, attributeName: 'missing' }],
            '2026-09-10',
        ),
        { anchor: null },
    );
});

test('getEntityPriceHistory falls back to the current price without a matching definition', async () => {
    createTestDb();

    const result = await getEntityPriceHistory([
        {
            key: 'missing-price',
            entityId: 999_999,
            entityTypeName: 'missingEntityType',
            attributeCategory: 'prices',
            attributeName: 'amount',
            currentPrice: 8.75,
        },
    ]);

    assert.deepEqual(result['missing-price'], {
        lowestPrice: 8.75,
        lastChangedAt: null,
    });
});
