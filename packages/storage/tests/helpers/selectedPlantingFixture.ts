import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
    accountUsers,
    assignUserToFarm,
    createAccount,
    createEntity,
    createFarm,
    createRaisedBedPlanting,
    getRaisedBedFieldsWithEvents,
    raisedBeds,
    storage,
    upsertEntityType,
    upsertRaisedBedField,
    users,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../testDb';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './testHelpers';

async function createTestUser(role: 'admin' | 'farmer') {
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `${role}-${userId}@example.com`,
            role,
        });
    return userId;
}

export async function createSelectedTaskFixture({
    multiField = false,
    sunflowerAmount = 1250,
    sowingLocation = 'direct',
    secondPhysicalBlock = false,
}: {
    multiField?: boolean;
    sunflowerAmount?: number;
    sowingLocation?: 'direct' | 'greenhouse';
    secondPhysicalBlock?: boolean;
} = {}) {
    createTestDb();
    const [adminId, farmerId, otherFarmerId, outsiderId, ownerUserId] =
        await Promise.all([
            createTestUser('admin'),
            createTestUser('farmer'),
            createTestUser('farmer'),
            createTestUser('farmer'),
            createTestUser('farmer'),
        ]);
    const farmId = await createFarm({
        name: `Selected task farm ${randomUUID()}`,
        latitude: 45.8,
        longitude: 15.9,
    });
    await Promise.all([
        assignUserToFarm(farmId, farmerId),
        assignUserToFarm(farmId, otherFarmerId),
    ]);
    const accountId = await createAccount();
    await storage().insert(accountUsers).values({
        accountId,
        userId: ownerUserId,
    });
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(
        gardenId,
        `selected-task-${randomUUID()}`,
    );
    const firstBlockId = secondPhysicalBlock
        ? await createTestBlock(gardenId, `first-block-${randomUUID()}`)
        : null;
    const firstBedId = firstBlockId
        ? await createTestRaisedBed(gardenId, accountId, firstBlockId)
        : null;
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    if (firstBedId) {
        const physicalId = `shared-${randomUUID()}`;
        await storage()
            .update(raisedBeds)
            .set({ physicalId })
            .where(eq(raisedBeds.id, firstBedId));
        await storage()
            .update(raisedBeds)
            .set({ physicalId })
            .where(eq(raisedBeds.id, raisedBedId));
    }
    const positions = multiField ? [17, 16, 14, 13] : [0];
    await Promise.all(
        positions.map((positionIndex) =>
            upsertRaisedBedField({ raisedBedId, positionIndex }),
        ),
    );
    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    const fieldsByPosition = new Map(
        fields.map((field) => [field.positionIndex, field]),
    );
    await upsertEntityType({ name: 'plantSort', label: 'Plant sort' });
    const plantSortId = await createEntity('plantSort');
    const aggregateId = `raised-bed-planting:selected:task:${randomUUID()}`;
    const membershipPositions = multiField ? [17, 16, 14, 13] : [0];
    const plantingInput = {
        raisedBedId,
        plantSortId,
        eventAggregateId: aggregateId,
        anchorPositionIndex: multiField ? 17 : 0,
        minSeedingDistanceCm: 15,
        optimalSeedingDistanceCm: 30,
        maxSeedingDistanceCm: 60,
        selectedSeedingDistanceCm: multiField ? 60 : 15,
        plantsPerAxis: multiField ? 1 : 2,
        plantCount: multiField ? 1 : 4,
        layoutKey: multiField
            ? 'v1:fields:2x2:plants:1x1'
            : 'v1:fields:1x1:plants:2x2',
        spanRows: multiField ? 2 : 1,
        spanColumns: multiField ? 2 : 1,
        layoutVersion: 1,
        configurationSource: 'selected',
        lifecycleStarted: {
            commandId: randomUUID(),
            scheduledDate: new Date(Date.now() + 86_400_000).toISOString(),
            sowingLocation,
            purchase: {
                cartItemId: Math.floor(Math.random() * 1_000_000) + 1,
                currency: 'sunflower',
                sunflowerAmount,
            },
            startedBy: ownerUserId,
        },
        memberships: membershipPositions.map((positionIndex, index) => {
            const field = fieldsByPosition.get(positionIndex);
            assert.ok(field);
            return {
                raisedBedFieldId: field.id,
                relativeRow: multiField ? Math.floor(index / 2) : 0,
                relativeColumn: multiField ? index % 2 : 0,
                isAnchor: index === 0,
            };
        }),
    } satisfies Parameters<typeof createRaisedBedPlanting>[0];
    const planting = await createRaisedBedPlanting(plantingInput);
    assert.ok(planting.planting.selectedTask);
    return {
        accountId,
        plantingInput,
        adminId,
        aggregateId,
        farmerId,
        farmId,
        otherFarmerId,
        outsiderId,
        owner: { accountId, userId: ownerUserId },
        plantingId: planting.planting.id,
        plantSortId,
        raisedBedId,
        task: planting.planting.selectedTask,
    };
}
