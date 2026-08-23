import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    attributeValues,
    createAccount,
    createAttributeDefinition,
    createGardenBlock,
    getGardenBlock,
    upsertEntityType,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { createNamedEntity } from '../scripts/lib/createNamedEntity';
import { renameBlockEntityAndPlacements } from '../scripts/lib/renameBlockEntityAndPlacements';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('block rename preserves the entity ID and migrates placements idempotently', async () => {
    const database = createTestDb();
    const suffix = randomUUID();
    const entityTypeName = `renamed-block-${suffix}`;
    const fromName = `Block_Stone_Stairs_Half_${suffix}`;
    const toName = `Block_Stone_Stairs_Corner_${suffix}`;
    const actor = { id: 'test', name: 'Test' };

    await upsertEntityType({
        name: entityTypeName,
        label: `Renamed block ${suffix}`,
    });
    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName,
        dataType: 'text',
        order: 'a',
    });
    const nameDefinition = { id: nameDefinitionId, order: 'a' };
    const entityId = await createNamedEntity({
        actor,
        entityTypeName,
        name: fromName,
        nameDefinition,
    });

    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createGardenBlock(gardenId, fromName);

    const result = await renameBlockEntityAndPlacements({
        actor,
        entityId,
        entityTypeName,
        fromName,
        nameDefinition,
        toName,
    });
    assert.deepEqual(result, {
        renamedAttribute: true,
        renamedGardenBlocks: 1,
    });

    const [storedName] = await database
        .select({
            entityId: attributeValues.entityId,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, entityId),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.isDeleted, false),
            ),
        );
    assert.deepEqual(storedName, { entityId, value: toName });
    assert.equal((await getGardenBlock(gardenId, blockId))?.name, toName);

    const retry = await renameBlockEntityAndPlacements({
        actor,
        entityId,
        entityTypeName,
        fromName,
        nameDefinition,
        toName,
    });
    assert.deepEqual(retry, {
        renamedAttribute: false,
        renamedGardenBlocks: 0,
    });
    assert.equal((await getGardenBlock(gardenId, blockId))?.name, toName);

    const lateLegacyBlockId = await createGardenBlock(gardenId, fromName);
    const recovery = await renameBlockEntityAndPlacements({
        actor,
        entityId,
        entityTypeName,
        fromName,
        nameDefinition,
        toName,
    });
    assert.deepEqual(recovery, {
        renamedAttribute: false,
        renamedGardenBlocks: 1,
    });
    assert.equal(
        (await getGardenBlock(gardenId, lateLegacyBlockId))?.name,
        toName,
    );
});

test('block rename rejects a duplicate target without changing the source', async () => {
    const database = createTestDb();
    const suffix = randomUUID();
    const entityTypeName = `duplicate-block-${suffix}`;
    const fromName = `Block_Old_${suffix}`;
    const toName = `Block_New_${suffix}`;
    const actor = { id: 'test', name: 'Test' };

    await upsertEntityType({
        name: entityTypeName,
        label: `Duplicate block ${suffix}`,
    });
    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName,
        dataType: 'text',
        order: 'a',
    });
    const nameDefinition = { id: nameDefinitionId, order: 'a' };
    const sourceEntityId = await createNamedEntity({
        actor,
        entityTypeName,
        name: fromName,
        nameDefinition,
    });
    const targetEntityId = await createNamedEntity({
        actor,
        entityTypeName,
        name: toName,
        nameDefinition,
    });

    await assert.rejects(
        renameBlockEntityAndPlacements({
            actor,
            entityId: sourceEntityId,
            entityTypeName,
            fromName,
            nameDefinition,
            toName,
        }),
        new RegExp(`target belongs to entity ${targetEntityId.toString()}`),
    );

    const [sourceName] = await database
        .select({ value: attributeValues.value })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, sourceEntityId),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.isDeleted, false),
            ),
        );
    assert.equal(sourceName?.value, fromName);
});
