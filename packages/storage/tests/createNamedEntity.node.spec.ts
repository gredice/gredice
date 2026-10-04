import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    attributeValues,
    createAttributeDefinition,
    entities,
    entityRevisions,
    upsertEntityType,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createNamedEntity } from '../scripts/lib/createNamedEntity';
import { createTestDb } from './testDb';

test('named entity creation is atomic with its identifying attribute', async () => {
    const database = createTestDb();
    const suffix = randomUUID();
    const entityTypeName = `named-entity-${suffix}`;
    const actor = { id: 'test', name: 'Test' };

    await upsertEntityType({
        name: entityTypeName,
        label: `Named entity ${suffix}`,
    });
    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName,
        dataType: 'text',
        order: 'a',
    });

    await assert.rejects(
        createNamedEntity({
            actor,
            entityTypeName,
            name: 'Must roll back',
            nameDefinition: {
                id: -1,
                order: 'a',
            },
        }),
    );

    const entitiesAfterFailedNameWrite = await database
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.entityTypeName, entityTypeName));
    assert.deepEqual(entitiesAfterFailedNameWrite, []);

    const entityId = await createNamedEntity({
        actor,
        entityTypeName,
        name: 'Durable name',
        nameDefinition: {
            id: nameDefinitionId,
            order: 'a',
        },
    });
    const [storedName] = await database
        .select({ value: attributeValues.value })
        .from(attributeValues)
        .where(eq(attributeValues.entityId, entityId));
    assert.equal(storedName?.value, 'Durable name');

    const revisions = await database
        .select({ action: entityRevisions.action })
        .from(entityRevisions)
        .where(eq(entityRevisions.entityId, entityId));
    assert.deepEqual(revisions.map((revision) => revision.action).sort(), [
        'attribute.created',
        'entity.created',
    ]);
});
