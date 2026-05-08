import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createEntity, getEntityRoots, updateEntity } from '@gredice/storage';
import { createTestDb } from './testDb';

test('getEntityRoots returns root entities for an entity type', async () => {
    createTestDb();
    const entityTypeName = `entity-hierarchy-roots-${randomUUID()}`;
    const rootEntityId = await createEntity(entityTypeName);
    const childEntityId = await createEntity(entityTypeName);

    await updateEntity({
        id: childEntityId,
        parentId: rootEntityId,
    });

    const roots = await getEntityRoots(entityTypeName);

    assert.deepStrictEqual(
        roots.map((entity) => entity.id),
        [rootEntityId],
    );
});

test('updateEntity rejects changing type when an existing parent has a different type', async () => {
    createTestDb();
    const originalEntityTypeName = `entity-hierarchy-original-${randomUUID()}`;
    const nextEntityTypeName = `entity-hierarchy-next-${randomUUID()}`;
    const parentEntityId = await createEntity(originalEntityTypeName);
    const childEntityId = await createEntity(originalEntityTypeName);

    await updateEntity({
        id: childEntityId,
        parentId: parentEntityId,
    });

    await assert.rejects(
        updateEntity({
            id: childEntityId,
            entityTypeName: nextEntityTypeName,
        }),
        /Parent entity must have the same entity type as the child\./,
    );
});
