import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    assignUserToFarm,
    createAccount,
    createAttributeDefinition,
    createEntity,
    createEvent,
    createFarm,
    createOperation,
    getFarmerBalance,
    knownEvents,
    storage,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    upsertOperationPrice,
    upsertRaisedBedField,
    users,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createPublishedOperationEntity(label: string) {
    await upsertEntityType({ name: 'operation', label: 'Radnje' });

    const suffix = randomUUID();
    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'operation',
        dataType: 'text',
    });
    const labelDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'label',
        label: 'Label',
        entityTypeName: 'operation',
        dataType: 'text',
    });

    const entityId = await createEntity('operation');
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: 'operation',
        entityId,
        value: `operation-${suffix}`,
    });
    await upsertAttributeValue({
        attributeDefinitionId: labelDefinitionId,
        entityTypeName: 'operation',
        entityId,
        value: label,
    });
    await updateEntity({ id: entityId, state: 'published' });

    return entityId;
}

async function createVerifiedAcceptedOperation(input: {
    farmId?: number;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
    entityId: number;
    completedBy: string;
    assignedUserId?: string;
}) {
    const operationId = await createOperation({
        entityId: input.entityId,
        entityTypeName: 'operation',
        farmId: input.farmId,
        gardenId: input.gardenId,
        raisedBedId: input.raisedBedId,
        raisedBedFieldId: input.raisedBedFieldId,
    });
    await acceptOperation(operationId);
    await createEvent(
        knownEvents.operations.assignedV1(operationId.toString(), {
            assignedUserId: input.assignedUserId ?? input.completedBy,
            assignedBy: input.assignedUserId ?? input.completedBy,
        }),
    );
    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: input.completedBy,
        }),
    );
    await createEvent(
        knownEvents.operations.verifiedV1(operationId.toString(), {
            verifiedBy: randomUUID(),
        }),
    );

    return operationId;
}

test('getFarmerBalance groups completed operations by CMS operation name', async () => {
    createTestDb();

    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `payout-${userId}@example.com`,
            displayName: 'Payout Test Farmer',
            role: 'farmer',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

    const farmId = await createFarm({
        name: `Payout Farm ${randomUUID()}`,
        longitude: 0,
        latitude: 0,
    });
    await assignUserToFarm(farmId, userId);

    const wateringEntityId =
        await createPublishedOperationEntity('Zalijevanje');
    const hoeingEntityId = await createPublishedOperationEntity('Okopavanje');

    await upsertOperationPrice({
        farmId,
        entityTypeName: 'operation',
        entityId: wateringEntityId,
        pricePerUnit: '0.50',
        currency: 'eur',
    });
    await upsertOperationPrice({
        farmId,
        entityTypeName: 'operation',
        entityId: hoeingEntityId,
        pricePerUnit: '0.75',
        currency: 'eur',
    });

    await createVerifiedAcceptedOperation({
        farmId,
        entityId: wateringEntityId,
        completedBy: userId,
    });
    await createVerifiedAcceptedOperation({
        farmId,
        entityId: wateringEntityId,
        completedBy: userId,
    });
    await createVerifiedAcceptedOperation({
        farmId,
        entityId: hoeingEntityId,
        completedBy: userId,
    });

    const balance = await getFarmerBalance(userId, farmId);
    const watering = balance.earningsByType.find(
        (earning) => earning.entityId === wateringEntityId,
    );
    const hoeing = balance.earningsByType.find(
        (earning) => earning.entityId === hoeingEntityId,
    );

    assert.equal(watering?.entityLabel, 'Zalijevanje');
    assert.equal(watering?.operationCount, 2);
    assert.equal(watering?.pricePerUnit, 0.5);
    assert.equal(watering?.totalEarned, 1);
    assert.equal(hoeing?.entityLabel, 'Okopavanje');
    assert.equal(hoeing?.operationCount, 1);
    assert.equal(balance.totalEarned, 1.75);
});

test('getFarmerBalance includes assigned raised-bed operations by effective farm', async () => {
    createTestDb();

    const userId = randomUUID();
    const otherFarmerId = randomUUID();
    await storage()
        .insert(users)
        .values([
            {
                id: userId,
                userName: `payout-raised-bed-${userId}@example.com`,
                displayName: 'Payout Raised Bed Farmer',
                role: 'farmer',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: otherFarmerId,
                userName: `payout-other-${otherFarmerId}@example.com`,
                displayName: 'Other Farmer',
                role: 'farmer',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

    const farmId = await createFarm({
        name: `Raised Bed Payout Farm ${randomUUID()}`,
        longitude: 0,
        latitude: 0,
    });
    await Promise.all([
        assignUserToFarm(farmId, userId),
        assignUserToFarm(farmId, otherFarmerId),
    ]);

    const accountId = await createAccount();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'payout-raised-bed-block');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    const [field] = await storage().query.raisedBedFields.findMany({
        where: (raisedBedFields, { and, eq }) =>
            and(
                eq(raisedBedFields.raisedBedId, raisedBedId),
                eq(raisedBedFields.positionIndex, 0),
            ),
    });
    assert.ok(field);

    const operationEntityId =
        await createPublishedOperationEntity('Zalijevanje');
    await upsertOperationPrice({
        farmId,
        entityTypeName: 'operation',
        entityId: operationEntityId,
        pricePerUnit: '0.50',
        currency: 'eur',
    });

    await createVerifiedAcceptedOperation({
        gardenId,
        raisedBedId,
        raisedBedFieldId: field.id,
        entityId: operationEntityId,
        completedBy: userId,
        assignedUserId: userId,
    });

    const balance = await getFarmerBalance(userId, farmId);
    const otherBalance = await getFarmerBalance(otherFarmerId, farmId);

    const watering = balance.earningsByType.find(
        (earning) => earning.entityId === operationEntityId,
    );
    assert.equal(watering?.operationCount, 1);
    assert.equal(watering?.totalEarned, 0.5);
    assert.equal(otherBalance.totalEarned, 0);
});
