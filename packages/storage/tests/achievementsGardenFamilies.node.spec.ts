import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';
import {
    completeSelectedRaisedBedPlantingTask,
    createAccount,
    createAttributeDefinition,
    createEntity,
    createFarm,
    evaluateAchievements,
    events,
    getAccountAchievements,
    knownEvents,
    knownEventTypes,
    storage,
    updateSelectedRaisedBedPlantingLifecycleStatus,
    upsertAttributeValue,
    upsertEntityType,
    upsertRaisedBedField,
} from '@gredice/storage';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { mapGardenAchievementCommands } from '../src/helpers/gardenAchievementEvaluation';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    entityTypes,
    farms,
    raisedBedPlantings,
    raisedBeds,
} from '../src/schema';
import { closeStorage } from '../src/storage';
import { createSelectedTaskFixture } from './helpers/selectedPlantingFixture';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

let initialEventId = 0;
let initialEntityTypeId = 0;
let initialEntityId = 0;
let initialAttributeDefinitionId = 0;
const fixtures: { farmId: number; raisedBedId: number }[] = [];
let disposableFixtureInitialized = false;

before(async () => {
    createTestDb();
    initialEventId =
        (await storage().query.events.findFirst({ orderBy: desc(events.id) }))
            ?.id ?? 0;
    initialEntityTypeId =
        (
            await storage().query.entityTypes.findFirst({
                orderBy: desc(entityTypes.id),
            })
        )?.id ?? 0;
    initialEntityId =
        (
            await storage().query.entities.findFirst({
                orderBy: desc(entities.id),
            })
        )?.id ?? 0;
    initialAttributeDefinitionId =
        (
            await storage().query.attributeDefinitions.findFirst({
                orderBy: desc(attributeDefinitions.id),
            })
        )?.id ?? 0;
    disposableFixtureInitialized = true;
});

after(async () => {
    if (!disposableFixtureInitialized) return;
    // Later specs share this DB and query all active farms and plantings.
    // Retire our rows before removing the events needed to project them.
    if (fixtures.length) {
        const bedIds = fixtures.map((fixture) => fixture.raisedBedId);
        await storage()
            .update(raisedBedPlantings)
            .set({ isDeleted: true, isActive: false })
            .where(inArray(raisedBedPlantings.raisedBedId, bedIds));
        await storage()
            .update(raisedBeds)
            .set({ isDeleted: true })
            .where(inArray(raisedBeds.id, bedIds));
        await storage()
            .update(farms)
            .set({ isDeleted: true })
            .where(
                inArray(
                    farms.id,
                    fixtures.map((fixture) => fixture.farmId),
                ),
            );
    }
    await storage().delete(events).where(gt(events.id, initialEventId));
    await storage()
        .update(entities)
        .set({ isDeleted: true })
        .where(gt(entities.id, initialEntityId));
    await storage()
        .update(attributeDefinitions)
        .set({ isDeleted: true })
        .where(gt(attributeDefinitions.id, initialAttributeDefinitionId));
    // Type names are shared; remove only this spec's inserted label rows.
    await storage()
        .delete(entityTypes)
        .where(gt(entityTypes.id, initialEntityTypeId));
    await closeStorage();
});

async function awardsByPrefix(accountId: string, prefix: string) {
    return (await getAccountAchievements(accountId)).filter((award) =>
        award.achievementKey.startsWith(prefix),
    );
}

test('maps legacy place/sow/harvest and selected sow/harvest onto distinct cycles', () => {
    const commands = mapGardenAchievementCommands({
        raisedBedAccountId: new Map([[8, 'acc']]),
        plantings: [
            {
                eventAggregateId: 'selected-1',
                plantSortId: 21,
                raisedBedId: 8,
                configurationSource: 'selected',
            },
        ],
        events: [
            {
                id: 1,
                type: knownEventTypes.raisedBedFields.plantPlace,
                aggregateId: '8|0',
                createdAt: new Date('2026-04-01T10:00:00.000Z'),
                data: { plantSortId: '11' },
            },
            {
                id: 2,
                type: knownEventTypes.raisedBedFields.plantUpdate,
                aggregateId: '8|0',
                createdAt: new Date('2026-04-02T10:00:00.000Z'),
                data: { status: 'sowed' },
            },
            {
                id: 3,
                type: knownEventTypes.raisedBedFields.plantUpdate,
                aggregateId: '8|0',
                createdAt: new Date('2026-07-02T10:00:00.000Z'),
                data: { status: 'harvested' },
            },
            {
                id: 4,
                type: knownEventTypes.raisedBedPlantings.lifecycleStarted,
                aggregateId: 'selected-1',
                createdAt: new Date('2026-04-03T10:00:00.000Z'),
                data: {},
            },
            {
                id: 5,
                type: knownEventTypes.raisedBedPlantings.taskCompleted,
                aggregateId: 'selected-1',
                createdAt: new Date('2026-04-04T10:00:00.000Z'),
                data: { status: 'sowed' },
            },
            {
                id: 6,
                type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
                aggregateId: 'selected-1',
                createdAt: new Date('2026-09-10T10:00:00.000Z'),
                data: { status: 'harvested' },
            },
        ],
    });
    assert.deepEqual(
        commands.map((command) => [command.kind, command.cycleId]),
        [
            ['start', 'legacy:1'],
            ['sow', 'legacy:1'],
            ['start', 'selected:selected-1'],
            ['sow', 'selected:selected-1'],
            ['harvest', 'legacy:1'],
            ['harvest', 'selected:selected-1'],
        ],
    );
});

async function ensurePlantSortParentDefinition() {
    await upsertEntityType({ name: 'plant', label: 'Plant' });
    await upsertEntityType({ name: 'plantSort', label: 'Plant sort' });
    const existing = await storage().query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.entityTypeName, 'plantSort'),
            eq(attributeDefinitions.category, 'information'),
            eq(attributeDefinitions.name, 'plant'),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
    if (existing) return existing.id;
    return createAttributeDefinition({
        category: 'information',
        name: 'plant',
        label: 'Plant',
        entityTypeName: 'plantSort',
        dataType: 'ref:plant',
    });
}

async function createLinkedSort(plantId: number) {
    const sortId = await createEntity('plantSort');
    await upsertAttributeValue({
        attributeDefinitionId: await ensurePlantSortParentDefinition(),
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: String(plantId),
    });
    return sortId;
}

async function createLegacyGarden() {
    const accountId = await createAccount();
    const farmId = await createFarm({
        name: `Achievement garden ${randomUUID()}`,
        latitude: 45.8,
        longitude: 15.9,
    });
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, `ach-${randomUUID()}`);
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    fixtures.push({ farmId, raisedBedId });
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await upsertRaisedBedField({ raisedBedId, positionIndex: 1 });
    await upsertRaisedBedField({ raisedBedId, positionIndex: 2 });
    return { accountId, raisedBedId };
}

async function sowLegacy(input: {
    raisedBedId: number;
    positionIndex: number;
    plantSortId: number;
    sowedAt: Date;
    harvestedAt?: Date;
}) {
    const aggregateId = `${input.raisedBedId.toString()}|${input.positionIndex.toString()}`;
    await storage()
        .insert(events)
        .values({
            ...knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
                plantSortId: input.plantSortId.toString(),
                scheduledDate: null,
            }),
            createdAt: new Date(input.sowedAt.getTime() - 60_000),
        });
    await storage()
        .insert(events)
        .values({
            ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                status: 'sowed',
            }),
            createdAt: input.sowedAt,
        });
    if (!input.harvestedAt) return;
    await storage()
        .insert(events)
        .values({
            ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                status: 'harvested',
            }),
            createdAt: input.harvestedAt,
        });
}

test('counts distinct parent plants, completed cycles, and 2026 seasons', async () => {
    const { accountId, raisedBedId } = await createLegacyGarden();
    await ensurePlantSortParentDefinition();
    const tomato = await createEntity('plant');
    const lettuce = await createEntity('plant');
    const carrot = await createEntity('plant');
    const cherry = await createLinkedSort(tomato);
    const beefsteak = await createLinkedSort(tomato);
    const lettuceSort = await createLinkedSort(lettuce);
    const carrotSort = await createLinkedSort(carrot);

    await sowLegacy({
        raisedBedId,
        positionIndex: 0,
        plantSortId: cherry,
        sowedAt: new Date('2026-04-02T10:00:00.000Z'),
        harvestedAt: new Date('2026-07-02T10:00:00.000Z'),
    });
    await sowLegacy({
        raisedBedId,
        positionIndex: 1,
        plantSortId: beefsteak,
        sowedAt: new Date('2026-04-06T10:00:00.000Z'),
    });
    await evaluateAchievements();
    assert.equal(
        (await awardsByPrefix(accountId, 'garden_diversity_')).length,
        0,
    );
    assert.equal((await awardsByPrefix(accountId, 'seed_to_table_')).length, 1);
    assert.deepEqual(
        (await awardsByPrefix(accountId, 'season_'))
            .map((award) => award.achievementKey)
            .sort(),
        ['season_2026_spring', 'season_2026_summer'],
    );

    await sowLegacy({
        raisedBedId,
        positionIndex: 2,
        plantSortId: lettuceSort,
        sowedAt: new Date('2026-04-10T10:00:00.000Z'),
        harvestedAt: new Date('2026-07-08T10:00:00.000Z'),
    });
    await storage()
        .insert(events)
        .values({
            ...knownEvents.raisedBedFields.plantUpdateV1(
                `${raisedBedId.toString()}|0`,
                {
                    status: 'harvested',
                },
            ),
            createdAt: new Date('2026-07-20T10:00:00.000Z'),
        });
    await sowLegacy({
        raisedBedId,
        positionIndex: 0,
        plantSortId: carrotSort,
        sowedAt: new Date('2026-09-08T10:00:00.000Z'),
    });
    await evaluateAchievements();
    await evaluateAchievements();

    const diversity = await awardsByPrefix(accountId, 'garden_diversity_');
    assert.deepEqual(
        diversity.map((award) => [
            award.achievementKey,
            award.status,
            award.progressValue,
        ]),
        [['garden_diversity_3', 'pending', 3]],
    );
    const cycles = await awardsByPrefix(accountId, 'seed_to_table_');
    assert.deepEqual(
        cycles.map((award) => [
            award.achievementKey,
            award.status,
            award.progressValue,
        ]),
        [['seed_to_table_1', 'pending', 1]],
    );
    assert.deepEqual(
        (await awardsByPrefix(accountId, 'season_'))
            .map((award) => award.achievementKey)
            .sort(),
        ['season_2026_autumn', 'season_2026_spring', 'season_2026_summer'],
    );
});

test('selected sow-to-harvest earns one seed-to-table cycle and stays idempotent', async () => {
    const fixture = await createSelectedTaskFixture();
    fixtures.push(fixture);
    const sowed = await completeSelectedRaisedBedPlantingTask({
        ...fixture.task.identity,
        actor: { role: 'admin', userId: fixture.adminId },
        commandId: randomUUID(),
    });
    let identity = sowed.task.identity;
    for (const status of ['sprouted', 'ready', 'harvested'] as const) {
        const result = await updateSelectedRaisedBedPlantingLifecycleStatus({
            ...identity,
            status,
            actor: { role: 'admin', userId: fixture.adminId },
            commandId: randomUUID(),
        });
        identity = result.task.identity;
    }
    await evaluateAchievements();
    await evaluateAchievements();
    const cycles = await awardsByPrefix(fixture.accountId, 'seed_to_table_');
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0]?.achievementKey, 'seed_to_table_1');
    assert.equal(cycles[0]?.progressValue, 1);
});

test('historical diversity survives deleted catalogue links and uses the latest mapping', async () => {
    const { accountId, raisedBedId } = await createLegacyGarden();
    const definitionId = await ensurePlantSortParentDefinition();
    const plantIds = await Promise.all([
        createEntity('plant'),
        createEntity('plant'),
        createEntity('plant'),
    ]);
    const sortIds: number[] = [];
    for (const [index, plantId] of plantIds.entries()) {
        const sortId = await createLinkedSort(plantId);
        sortIds.push(sortId);
        await sowLegacy({
            raisedBedId,
            positionIndex: index,
            plantSortId: sortId,
            sowedAt: new Date(Date.UTC(2025, 3, index + 1)),
        });
    }
    // A newer historical link supersedes this sort's original parent plant.
    await storage()
        .insert(attributeValues)
        .values({
            attributeDefinitionId: definitionId,
            entityTypeName: 'plantSort',
            entityId: sortIds[2],
            value: String(plantIds[0]),
            isDeleted: true,
        });
    await storage()
        .update(attributeValues)
        .set({ isDeleted: true })
        .where(inArray(attributeValues.entityId, sortIds));
    await storage()
        .update(attributeDefinitions)
        .set({ isDeleted: true })
        .where(eq(attributeDefinitions.id, definitionId));
    await evaluateAchievements();
    assert.equal(
        (await awardsByPrefix(accountId, 'garden_diversity_')).length,
        0,
    );

    await storage()
        .insert(attributeValues)
        .values({
            attributeDefinitionId: definitionId,
            entityTypeName: 'plantSort',
            entityId: sortIds[2],
            value: String(plantIds[2]),
            isDeleted: true,
        });
    await evaluateAchievements();
    const awards = await awardsByPrefix(accountId, 'garden_diversity_');
    assert.deepEqual(
        awards.map((award) => [
            award.achievementKey,
            award.status,
            award.progressValue,
        ]),
        [['garden_diversity_3', 'pending', 3]],
    );
    assert.deepEqual(awards[0]?.earnedAt, new Date('2025-04-03T00:00:00.000Z'));
    await evaluateAchievements();
    assert.deepEqual(
        await awardsByPrefix(accountId, 'garden_diversity_'),
        awards,
    );
});

test('first evaluation queues historical awards for deleted selected plantings only once', async () => {
    const fixture = await createSelectedTaskFixture();
    fixtures.push(fixture);
    const sowed = await completeSelectedRaisedBedPlantingTask({
        ...fixture.task.identity,
        actor: { role: 'admin', userId: fixture.adminId },
        commandId: randomUUID(),
    });
    let identity = sowed.task.identity;
    for (const status of ['sprouted', 'ready', 'harvested'] as const) {
        const result = await updateSelectedRaisedBedPlantingLifecycleStatus({
            ...identity,
            status,
            actor: { role: 'admin', userId: fixture.adminId },
            commandId: randomUUID(),
        });
        identity = result.task.identity;
    }
    await storage()
        .update(raisedBedPlantings)
        .set({ isDeleted: true, isActive: false })
        .where(eq(raisedBedPlantings.id, fixture.plantingId));
    await evaluateAchievements();
    const awards = await awardsByPrefix(fixture.accountId, 'seed_to_table_');
    assert.deepEqual(
        awards.map((award) => [
            award.achievementKey,
            award.status,
            award.progressValue,
        ]),
        [['seed_to_table_1', 'pending', 1]],
    );
    await evaluateAchievements();
    assert.deepEqual(
        await awardsByPrefix(fixture.accountId, 'seed_to_table_'),
        awards,
    );
});
