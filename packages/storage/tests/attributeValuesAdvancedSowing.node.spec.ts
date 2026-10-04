import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyAdvancedSowingAttributeValueBatch,
    createAttributeDefinition,
    createAttributeValueMutationSideEffects,
    createEntity,
    deleteAttributeDefinition,
    deleteAttributeValue,
    deleteEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { attributeValues } from '../src/schema';
import { createTestDb } from './testDb';

test('Advanced Sowing attributes preserve one valid supported plant spacing range', async (t) => {
    const db = createTestDb();
    await upsertEntityType({ name: 'plant', label: 'Biljka' });

    const optimalDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        dataType: 'number',
        entityTypeName: 'plant',
        label: 'Preporučeni razmak',
        name: 'seedingDistance',
    });
    const minDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        dataType: 'number',
        entityTypeName: 'plant',
        label: 'Minimalni razmak',
        name: 'seedingDistanceMin',
    });
    const maxDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        dataType: 'number',
        entityTypeName: 'plant',
        label: 'Maksimalni razmak',
        name: 'seedingDistanceMax',
    });
    const plantId = await createEntity('plant');
    t.after(async () => {
        await deleteEntity(plantId);
        await Promise.all([
            deleteAttributeDefinition(optimalDefinitionId),
            deleteAttributeDefinition(minDefinitionId),
            deleteAttributeDefinition(maxDefinitionId),
        ]);
    });

    const writeValue = async (input: {
        attributeDefinitionId: number;
        id?: number;
        value: string | null;
    }) =>
        upsertAttributeValue({
            ...input,
            entityId: plantId,
            entityTypeName: 'plant',
        });
    const persistedValue = (attributeDefinitionId: number) =>
        db.query.attributeValues.findFirst({
            where: and(
                eq(
                    attributeValues.attributeDefinitionId,
                    attributeDefinitionId,
                ),
                eq(attributeValues.entityId, plantId),
                eq(attributeValues.isDeleted, false),
            ),
        });

    await writeValue({
        attributeDefinitionId: optimalDefinitionId,
        value: '20',
    });
    await writeValue({
        attributeDefinitionId: minDefinitionId,
        value: '10',
    });
    await writeValue({
        attributeDefinitionId: maxDefinitionId,
        value: '60',
    });

    const optimalValue = await persistedValue(optimalDefinitionId);
    const minValue = await persistedValue(minDefinitionId);
    const maxValue = await persistedValue(maxDefinitionId);
    assert.ok(optimalValue);
    assert.ok(minValue);
    assert.ok(maxValue);

    await assert.rejects(
        writeValue({
            attributeDefinitionId: minDefinitionId,
            id: minValue.id,
            value: '30',
        }),
        /min <= optimal <= max/u,
    );
    assert.equal((await persistedValue(minDefinitionId))?.value, '10');

    await assert.rejects(
        writeValue({
            attributeDefinitionId: optimalDefinitionId,
            id: optimalValue.id,
            value: '0',
        }),
        /finite positive number/u,
    );
    assert.equal((await persistedValue(optimalDefinitionId))?.value, '20');

    await assert.rejects(
        writeValue({
            attributeDefinitionId: maxDefinitionId,
            id: maxValue.id,
            value: '95',
        }),
        /unsupported by the raised bed geometry/u,
    );
    assert.equal((await persistedValue(maxDefinitionId))?.value, '60');

    await assert.rejects(
        deleteAttributeValue(optimalValue.id),
        /seedingDistance is required/u,
    );
    assert.equal((await persistedValue(optimalDefinitionId))?.value, '20');

    await assert.rejects(
        applyAdvancedSowingAttributeValueBatch([
            {
                action: 'upsert',
                attributeValue: {
                    attributeDefinitionId: minDefinitionId,
                    entityId: plantId,
                    entityTypeName: 'plant',
                    id: minValue.id,
                    value: '40',
                },
            },
        ]),
        /min <= optimal <= max/u,
    );
    assert.equal((await persistedValue(minDefinitionId))?.value, '10');

    await applyAdvancedSowingAttributeValueBatch([
        {
            action: 'upsert',
            attributeValue: {
                attributeDefinitionId: minDefinitionId,
                entityId: plantId,
                entityTypeName: 'plant',
                id: minValue.id,
                value: '40',
            },
        },
        {
            action: 'upsert',
            attributeValue: {
                attributeDefinitionId: optimalDefinitionId,
                entityId: plantId,
                entityTypeName: 'plant',
                id: optimalValue.id,
                value: '50',
            },
        },
    ]);

    await writeValue({
        attributeDefinitionId: optimalDefinitionId,
        id: optimalValue.id,
        value: '50',
    });
    assert.equal((await persistedValue(minDefinitionId))?.value, '40');
    assert.equal((await persistedValue(optimalDefinitionId))?.value, '50');

    await writeValue({
        attributeDefinitionId: minDefinitionId,
        id: minValue.id,
        value: '45',
    });
    await assert.rejects(
        applyAdvancedSowingAttributeValueBatch([
            {
                action: 'upsert',
                attributeValue: {
                    attributeDefinitionId: optimalDefinitionId,
                    entityId: plantId,
                    entityTypeName: 'plant',
                    id: optimalValue.id,
                    value: '20',
                },
                expectedCurrent: {
                    state: 'present',
                    attributeValueId: optimalValue.id,
                    value: '50',
                },
            },
            {
                action: 'upsert',
                attributeValue: {
                    attributeDefinitionId: minDefinitionId,
                    entityId: plantId,
                    entityTypeName: 'plant',
                    id: minValue.id,
                    value: '10',
                },
                expectedCurrent: {
                    state: 'present',
                    attributeValueId: minValue.id,
                    value: '40',
                },
            },
        ]),
        /current-value precondition failed/u,
    );
    assert.equal((await persistedValue(minDefinitionId))?.value, '45');
    assert.equal((await persistedValue(optimalDefinitionId))?.value, '50');

    const transactionSideEffects = createAttributeValueMutationSideEffects();
    await db.transaction((transaction) =>
        applyAdvancedSowingAttributeValueBatch(
            [
                {
                    action: 'upsert',
                    attributeValue: {
                        attributeDefinitionId: optimalDefinitionId,
                        entityId: plantId,
                        entityTypeName: 'plant',
                        id: optimalValue.id,
                        value: '20',
                    },
                    expectedCurrent: {
                        state: 'present',
                        attributeValueId: optimalValue.id,
                        value: '50',
                    },
                },
                {
                    action: 'upsert',
                    attributeValue: {
                        attributeDefinitionId: minDefinitionId,
                        entityId: plantId,
                        entityTypeName: 'plant',
                        id: minValue.id,
                        value: '10',
                    },
                    expectedCurrent: {
                        state: 'present',
                        attributeValueId: minValue.id,
                        value: '45',
                    },
                },
            ],
            undefined,
            {
                db: transaction,
                sideEffects: transactionSideEffects,
            },
        ),
    );
    assert.equal((await persistedValue(minDefinitionId))?.value, '10');
    assert.equal((await persistedValue(optimalDefinitionId))?.value, '20');

    await assert.rejects(
        deleteAttributeValue(optimalValue.id),
        /seedingDistance is required/u,
    );
    await deleteAttributeValue(minValue.id);
    await deleteAttributeValue(maxValue.id);
    await deleteAttributeValue(optimalValue.id);
    assert.equal(await persistedValue(optimalDefinitionId), undefined);
});
