import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    attributeDefinitions,
    attributeValues,
    createAccount,
    createAttributeDefinition,
    createEntity,
    createEvent,
    createLegacyRaisedBedPlantPlaceWithProjection,
    createOperation,
    createRaisedBedPlanting,
    deleteAttributeValue,
    getBlockingPlantOperationsForRaisedBedFootprint,
    getOperationById,
    getRaisedBedFieldsWithEvents,
    knownEvents,
    OperationTargetConflictError,
    RaisedBedPlantingError,
    storage,
    switchOperationEntity,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    upsertRaisedBedField,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

type OperationApplication = 'plant' | 'raisedBedFull';

let operationApplicationDefinitionPromise: Promise<number> | null = null;

async function operationApplicationDefinitionId() {
    if (!operationApplicationDefinitionPromise) {
        operationApplicationDefinitionPromise = (async () => {
            await upsertEntityType({ name: 'operation', label: 'Radnja' });
            const [existing] = await storage()
                .select({ id: attributeDefinitions.id })
                .from(attributeDefinitions)
                .where(
                    and(
                        eq(attributeDefinitions.entityTypeName, 'operation'),
                        eq(attributeDefinitions.category, 'attributes'),
                        eq(attributeDefinitions.name, 'application'),
                        eq(attributeDefinitions.isDeleted, false),
                    ),
                )
                .orderBy(attributeDefinitions.id)
                .limit(1);
            return (
                existing?.id ??
                createAttributeDefinition({
                    category: 'attributes',
                    name: 'application',
                    label: 'Primjena',
                    entityTypeName: 'operation',
                    dataType: 'text',
                })
            );
        })();
    }
    return operationApplicationDefinitionPromise;
}

async function createOperationDefinition(application: OperationApplication) {
    const entityId = await createEntity('operation');
    await upsertAttributeValue({
        attributeDefinitionId: await operationApplicationDefinitionId(),
        entityTypeName: 'operation',
        entityId,
        value: application,
    });
    await updateEntity({ id: entityId, state: 'published' });
    return entityId;
}

async function createChildOperationDefinition(input: {
    application?: OperationApplication;
    parentId: number;
}) {
    const entityId = await createEntity('operation');
    if (input.application) {
        await upsertAttributeValue({
            attributeDefinitionId: await operationApplicationDefinitionId(),
            entityTypeName: 'operation',
            entityId,
            value: input.application,
        });
    }
    await updateEntity({
        id: entityId,
        parentId: input.parentId,
        state: 'published',
    });
    return entityId;
}

async function createFixture(positionIndices: readonly number[]) {
    createTestDb();
    await upsertEntityType({ name: 'plantSort', label: 'Sorta biljke' });
    const plantSortId = await createEntity('plantSort');
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(
        gardenId,
        `operation-advanced-sowing-${randomUUID()}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    for (const positionIndex of positionIndices) {
        await upsertRaisedBedField({ raisedBedId, positionIndex });
    }
    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    return {
        accountId,
        gardenId,
        plantSortId,
        raisedBedId,
        fields: new Map(fields.map((field) => [field.positionIndex, field])),
    };
}

async function createSelectedPlanting(input: {
    fieldId: number;
    layoutKey?: string;
    plantCount?: number;
    plantsPerAxis?: number;
    positionIndex: number;
    raisedBedId: number;
    plantSortId: number;
}) {
    return createRaisedBedPlanting({
        raisedBedId: input.raisedBedId,
        plantSortId: input.plantSortId,
        eventAggregateId: `raised-bed-planting:selected:${randomUUID()}`,
        anchorPositionIndex: input.positionIndex,
        minSeedingDistanceCm: 15,
        optimalSeedingDistanceCm: 30,
        maxSeedingDistanceCm: 60,
        selectedSeedingDistanceCm: input.plantsPerAxis === 1 ? 30 : 15,
        plantsPerAxis: input.plantsPerAxis ?? 2,
        plantCount: input.plantCount ?? 4,
        layoutKey: input.layoutKey ?? 'v1:fields:1x1:plants:2x2',
        spanRows: 1,
        spanColumns: 1,
        layoutVersion: 1,
        configurationSource: 'selected',
        lifecycleStarted: {
            commandId: randomUUID(),
            scheduledDate: '2026-08-10T08:00:00.000Z',
            sowingLocation: 'direct',
            startedBy: 'test-suite',
        },
        memberships: [
            {
                raisedBedFieldId: input.fieldId,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    });
}

function operationInput(input: {
    accountId: string;
    entityId: number;
    fieldId: number;
    gardenId: number;
    raisedBedId: number;
}) {
    return {
        accountId: input.accountId,
        entityId: input.entityId,
        entityTypeName: 'operation',
        gardenId: input.gardenId,
        raisedBedId: input.raisedBedId,
        raisedBedFieldId: input.fieldId,
    };
}

test('plant operation creation rejects selected-only and co-planted fields', async () => {
    const fixture = await createFixture([0, 1]);
    const selectedOnlyField = fixture.fields.get(0);
    const coPlantedField = fixture.fields.get(1);
    assert.ok(selectedOnlyField && coPlantedField);
    await createSelectedPlanting({
        fieldId: selectedOnlyField.id,
        positionIndex: 0,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
    });
    await createSelectedPlanting({
        fieldId: coPlantedField.id,
        positionIndex: 1,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
        layoutKey: 'v1:fields:1x1:plants:1x1',
        plantsPerAxis: 1,
        plantCount: 1,
    });
    await createSelectedPlanting({
        fieldId: coPlantedField.id,
        positionIndex: 1,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
        layoutKey: 'v1:fields:1x1:plants:2x2',
    });
    const plantOperationId = await createOperationDefinition('plant');

    for (const field of [selectedOnlyField, coPlantedField]) {
        await assert.rejects(
            createOperation(
                operationInput({
                    ...fixture,
                    entityId: plantOperationId,
                    fieldId: field.id,
                }),
            ),
            (error) => {
                assert.ok(error instanceof OperationTargetConflictError);
                assert.equal(error.code, 'selected_planting_conflict');
                assert.match(error.message, /naprednom sjetvom/i);
                return true;
            },
        );
    }
});

test('legacy-only fields allow plant operations and selected fields allow all-target operations', async () => {
    const fixture = await createFixture([0, 1]);
    const legacyField = fixture.fields.get(0);
    const selectedField = fixture.fields.get(1);
    assert.ok(legacyField && selectedField);
    await storage().transaction((transaction) =>
        createLegacyRaisedBedPlantPlaceWithProjection(
            {
                event: knownEvents.raisedBedFields.plantPlaceV1(
                    `${fixture.raisedBedId.toString()}|0`,
                    {
                        plantSortId: fixture.plantSortId.toString(),
                        scheduledDate: null,
                    },
                ),
                raisedBedFieldId: legacyField.id,
            },
            transaction,
        ),
    );
    await createSelectedPlanting({
        fieldId: selectedField.id,
        positionIndex: 1,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
    });
    const plantOperationId = await createOperationDefinition('plant');
    const physicalOperationId =
        await createOperationDefinition('raisedBedFull');

    const legacyOperationId = await createOperation(
        operationInput({
            ...fixture,
            entityId: plantOperationId,
            fieldId: legacyField.id,
        }),
    );
    const physicalOperationOnSelectedFieldId = await createOperation(
        operationInput({
            ...fixture,
            entityId: physicalOperationId,
            fieldId: selectedField.id,
        }),
    );

    assert.equal(
        (await getOperationById(legacyOperationId)).raisedBedFieldId,
        legacyField.id,
    );
    assert.equal(
        (await getOperationById(physicalOperationOnSelectedFieldId))
            .raisedBedFieldId,
        selectedField.id,
    );
});

test('switching a selected-field operation to plant scope is rejected', async () => {
    const fixture = await createFixture([0]);
    const field = fixture.fields.get(0);
    assert.ok(field);
    await createSelectedPlanting({
        fieldId: field.id,
        positionIndex: 0,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
    });
    const physicalOperationEntityId =
        await createOperationDefinition('raisedBedFull');
    const plantOperationEntityId = await createOperationDefinition('plant');
    const operationId = await createOperation(
        operationInput({
            ...fixture,
            entityId: physicalOperationEntityId,
            fieldId: field.id,
        }),
    );

    await assert.rejects(
        switchOperationEntity(operationId, {
            entityId: plantOperationEntityId,
            entityTypeName: 'operation',
        }),
        (error) => {
            assert.ok(error instanceof OperationTargetConflictError);
            assert.equal(error.code, 'selected_planting_conflict');
            return true;
        },
    );
    assert.equal(
        (await getOperationById(operationId)).entityId,
        physicalOperationEntityId,
    );
});

test('editing an in-use operation application to plant scope rolls back', async () => {
    const fixture = await createFixture([0]);
    const field = fixture.fields.get(0);
    assert.ok(field);
    await createSelectedPlanting({
        fieldId: field.id,
        positionIndex: 0,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
    });
    const operationEntityId = await createOperationDefinition('raisedBedFull');
    await createOperation(
        operationInput({
            ...fixture,
            entityId: operationEntityId,
            fieldId: field.id,
        }),
    );
    const definitionId = await operationApplicationDefinitionId();
    const [applicationValue] = await storage()
        .select()
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, operationEntityId),
                eq(attributeValues.attributeDefinitionId, definitionId),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(1);
    assert.ok(applicationValue);

    await assert.rejects(
        upsertAttributeValue({
            ...applicationValue,
            value: 'plant',
        }),
        (error) => {
            assert.ok(error instanceof OperationTargetConflictError);
            assert.equal(error.code, 'selected_planting_conflict');
            return true;
        },
    );
    const [persistedValue] = await storage()
        .select({ value: attributeValues.value })
        .from(attributeValues)
        .where(eq(attributeValues.id, applicationValue.id));
    assert.equal(persistedValue?.value, 'raisedBedFull');
});

test('editing a parent application guards operations that inherit it', async () => {
    const fixture = await createFixture([0]);
    const field = fixture.fields.get(0);
    assert.ok(field);
    await createSelectedPlanting({
        fieldId: field.id,
        positionIndex: 0,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
    });
    const parentEntityId = await createOperationDefinition('raisedBedFull');
    const childEntityId = await createChildOperationDefinition({
        parentId: parentEntityId,
    });
    await createOperation(
        operationInput({
            ...fixture,
            entityId: childEntityId,
            fieldId: field.id,
        }),
    );
    const definitionId = await operationApplicationDefinitionId();
    const [parentApplication] = await storage()
        .select()
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, parentEntityId),
                eq(attributeValues.attributeDefinitionId, definitionId),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(1);
    assert.ok(parentApplication);

    await assert.rejects(
        upsertAttributeValue({ ...parentApplication, value: 'plant' }),
        (error) => {
            assert.ok(error instanceof OperationTargetConflictError);
            assert.equal(error.code, 'selected_planting_conflict');
            return true;
        },
    );
    const [persistedValue] = await storage()
        .select({ value: attributeValues.value })
        .from(attributeValues)
        .where(eq(attributeValues.id, parentApplication.id));
    assert.equal(persistedValue?.value, 'raisedBedFull');
});

test('deleting a child application override guards its inherited parent scope', async () => {
    const fixture = await createFixture([0]);
    const field = fixture.fields.get(0);
    assert.ok(field);
    await createSelectedPlanting({
        fieldId: field.id,
        positionIndex: 0,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
    });
    const parentEntityId = await createOperationDefinition('plant');
    const childEntityId = await createChildOperationDefinition({
        application: 'raisedBedFull',
        parentId: parentEntityId,
    });
    await createOperation(
        operationInput({
            ...fixture,
            entityId: childEntityId,
            fieldId: field.id,
        }),
    );
    const definitionId = await operationApplicationDefinitionId();
    const [childApplication] = await storage()
        .select()
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, childEntityId),
                eq(attributeValues.attributeDefinitionId, definitionId),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(1);
    assert.ok(childApplication);

    await assert.rejects(deleteAttributeValue(childApplication.id), (error) => {
        assert.ok(error instanceof OperationTargetConflictError);
        assert.equal(error.code, 'selected_planting_conflict');
        return true;
    });
    const [persistedValue] = await storage()
        .select({ isDeleted: attributeValues.isDeleted })
        .from(attributeValues)
        .where(eq(attributeValues.id, childApplication.id));
    assert.equal(persistedValue?.isDeleted, false);
});

test('selected placement rejects a pre-existing unresolved plant operation', async () => {
    const fixture = await createFixture([0]);
    const field = fixture.fields.get(0);
    assert.ok(field);
    const plantOperationEntityId = await createOperationDefinition('plant');
    const operationId = await createOperation(
        operationInput({
            ...fixture,
            entityId: plantOperationEntityId,
            fieldId: field.id,
        }),
    );
    const conflicts = await getBlockingPlantOperationsForRaisedBedFootprint({
        raisedBedId: fixture.raisedBedId,
        positionIndices: [0],
    });
    assert.deepEqual(conflicts, [
        {
            operationId,
            raisedBedFieldId: field.id,
            positionIndex: 0,
            status: 'new',
        },
    ]);

    await assert.rejects(
        createSelectedPlanting({
            fieldId: field.id,
            positionIndex: 0,
            raisedBedId: fixture.raisedBedId,
            plantSortId: fixture.plantSortId,
        }),
        (error) => {
            assert.ok(error instanceof RaisedBedPlantingError);
            assert.equal(error.code, 'plant_operation_conflict');
            return true;
        },
    );
});

test('concurrent plant operation and selected placement cannot both occupy one field', async () => {
    const fixture = await createFixture([0]);
    const field = fixture.fields.get(0);
    assert.ok(field);
    const plantOperationEntityId = await createOperationDefinition('plant');

    const results = await Promise.allSettled([
        createOperation(
            operationInput({
                ...fixture,
                entityId: plantOperationEntityId,
                fieldId: field.id,
            }),
        ),
        createSelectedPlanting({
            fieldId: field.id,
            positionIndex: 0,
            raisedBedId: fixture.raisedBedId,
            plantSortId: fixture.plantSortId,
        }),
    ]);
    assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    assert.equal(
        results.filter((result) => result.status === 'rejected').length,
        1,
    );
    const rejection = results.find((result) => result.status === 'rejected');
    assert.ok(rejection?.status === 'rejected');
    assert.ok(
        (rejection.reason instanceof OperationTargetConflictError &&
            rejection.reason.code === 'selected_planting_conflict') ||
            (rejection.reason instanceof RaisedBedPlantingError &&
                rejection.reason.code === 'plant_operation_conflict'),
    );
});

test('canonical terminal plant operations do not block selected placement', async () => {
    const fixture = await createFixture([0]);
    const field = fixture.fields.get(0);
    assert.ok(field);
    const plantOperationEntityId = await createOperationDefinition('plant');
    const operationId = await createOperation(
        operationInput({
            ...fixture,
            entityId: plantOperationEntityId,
            fieldId: field.id,
        }),
    );
    await createEvent(
        knownEvents.operations.blockedV1(operationId.toString(), {
            blockedBy: 'test-suite',
            reasonCode: 'unsafe_conditions',
            reasonLabel: 'Vrijeme ili uvjeti nisu sigurni',
        }),
    );

    assert.deepEqual(
        await getBlockingPlantOperationsForRaisedBedFootprint({
            raisedBedId: fixture.raisedBedId,
            positionIndices: [0],
        }),
        [],
    );
    const planting = await createSelectedPlanting({
        fieldId: field.id,
        positionIndex: 0,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
    });
    assert.equal(planting.created, true);
});
