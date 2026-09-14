import assert from 'node:assert/strict';
import test from 'node:test';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    entityTypes,
    events,
    getAttributeDefinitions,
    getPublicPriceCatalog,
    getPublishedPriceList,
    getPublishedPriceLists,
    publishPublicPriceList,
    storage,
} from '@gredice/storage';
import { eq, inArray } from 'drizzle-orm';
import { createTestDb } from './testDb';

test('publication supports parentless sorts, deduplicates prices and preserves older downloads after changes', async (t) => {
    createTestDb();
    const entityTypeName = 'plantSort';
    const incompleteTypes = [
        'plant',
        'plantSort',
        'operation',
        'hqLocations',
    ];
    await storage()
        .insert(entityTypes)
        .values(incompleteTypes.map((name) => ({ name, label: name })))
        .onConflictDoNothing();
    const incomplete = await storage()
        .insert(entities)
        .values(
            incompleteTypes.map((name) => ({
                entityTypeName: name,
                state: 'published',
            })),
        )
        .returning();
    t.after(async () => {
        await storage()
            .delete(entities)
            .where(
                inArray(
                    entities.id,
                    incomplete.map((entry) => entry.id),
                ),
            );
    });
    const catalog = await getPublicPriceCatalog();
    assert.ok(
        incomplete.every(
            (entry) => !catalog.some((price) => price.entityId === entry.id),
        ),
    );
    const existingDefinitions = await getAttributeDefinitions(entityTypeName);
    const definitions = [];
    for (const definition of [
        { category: 'information', name: 'name', dataType: 'text' },
        { category: 'prices', name: 'perPlant', dataType: 'number' },
    ]) {
        const existing = existingDefinitions.find(
            (entry) =>
                entry.category === definition.category &&
                entry.name === definition.name,
        );
        if (existing) {
            definitions.push(existing);
        } else {
            const [created] = await storage()
                .insert(attributeDefinitions)
                .values({
                    ...definition,
                    entityTypeName,
                    label: definition.name,
                })
                .returning();
            definitions.push(created);
        }
    }
    const [sort] = await storage()
        .insert(entities)
        .values({
            entityTypeName,
            state: 'published',
        })
        .returning();
    t.after(async () => {
        await storage()
            .delete(attributeValues)
            .where(eq(attributeValues.entityId, sort.id));
        await storage().delete(entities).where(eq(entities.id, sort.id));
    });
    const [, price] = await storage()
        .insert(attributeValues)
        .values(
            definitions.map((definition) => ({
                entityId: sort.id,
                entityTypeName,
                attributeDefinitionId: definition.id,
                value:
                    definition.name === 'name'
                        ? 'Samostalna sorta za cjenik'
                        : '2.50',
            })),
        )
        .returning();
    const first = await publishPublicPriceList();
    const again = await publishPublicPriceList();
    assert.equal(first.id, again.id);
    assert.equal(first.csv, again.csv);
    assert.ok(first.filename.endsWith('.csv'));
    assert.ok(first.csv.includes('Uzgoj: Samostalna sorta za cjenik'));
    assert.deepEqual(await getPublishedPriceList(first.id), first);
    await storage()
        .update(attributeValues)
        .set({ value: '3.50' })
        .where(eq(attributeValues.id, price.id));
    const changed = await publishPublicPriceList();
    assert.notEqual(changed.id, first.id);
    assert.notEqual(changed.csv, first.csv);
    assert.deepEqual(await getPublishedPriceList(), changed);
    assert.deepEqual(await getPublishedPriceList(first.id), first);
});

test('archive lists 30 days and downloads can only read price-list events', async () => {
    createTestDb();
    const [old, current, privateEvent] = await storage()
        .insert(events)
        .values([
            {
                type: 'pricing.catalog.published',
                aggregateId: 'public-service-price-list',
                version: 1,
                data: { csv: 'old', day: '2026-01-01' },
                createdAt: new Date('2026-01-01'),
            },
            {
                type: 'pricing.catalog.published',
                aggregateId: 'public-service-price-list',
                version: 1,
                data: { csv: 'current', day: '2026-01-30' },
                createdAt: new Date('2026-01-30'),
            },
            {
                type: 'account.private',
                aggregateId: 'private',
                version: 1,
                data: { secret: 'never public' },
            },
        ])
        .returning();
    const archive = await getPublishedPriceLists(new Date('2026-02-01'));
    assert.ok(!archive.some((entry) => entry.id === old.id));
    assert.ok(archive.some((entry) => entry.id === current.id));
    assert.equal((await getPublishedPriceList(old.id))?.csv, 'old');
    assert.equal(await getPublishedPriceList(privateEvent.id), null);
});
