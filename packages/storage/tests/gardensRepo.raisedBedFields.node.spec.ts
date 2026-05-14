import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assignUserToFarm,
    createAccount,
    createEvent,
    createNotification,
    createOperation,
    createUserWithPassword,
    deleteRaisedBedField,
    getAllOperations,
    getNotifications,
    getOrCreateShoppingCart,
    getRaisedBed,
    getRaisedBedFieldPlantCycles,
    getRaisedBedFieldsWithEvents,
    knownEvents,
    knownEventTypes,
    mergeRaisedBeds,
    moveRaisedBedFieldPlantHistory,
    storage,
    upsertOrRemoveCartItem,
    upsertRaisedBedField,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { events } from '../src/schema';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function getPlantEventsForAggregate(aggregateId: string) {
    return storage().query.events.findMany({
        where: (events, { and, eq, inArray }) =>
            and(
                eq(events.aggregateId, aggregateId),
                inArray(events.type, [
                    knownEventTypes.raisedBedFields.plantPlace,
                    knownEventTypes.raisedBedFields.plantSchedule,
                    knownEventTypes.raisedBedFields.plantUpdate,
                    knownEventTypes.raisedBedFields.plantReplaceSort,
                ]),
            ),
        orderBy: (events, { asc }) => [asc(events.createdAt), asc(events.id)],
    });
}

test('upsertRaisedBedField creates field, deleteRaisedBedField deletes the field', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-1');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    // Create field
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    let fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    assert.strictEqual(fields.length, 1);

    // Delete field
    await deleteRaisedBedField(raisedBedId, 0);
    fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    assert.strictEqual(fields.length, 0);
});

test('getRaisedBed returns raised bed with event-sourced fields', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-1');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await upsertRaisedBedField({ raisedBedId, positionIndex: 1 });
    const raisedBed = await getRaisedBed(raisedBedId);
    assert.ok(raisedBed);
    assert.ok(Array.isArray(raisedBed.fields));
    assert.strictEqual(raisedBed.fields.length, 1);
});

test('mergeRaisedBeds remaps source fields to the next block boundary without data loss', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockAId = await createTestBlock(gardenId, 'block-a');
    const blockBId = await createTestBlock(gardenId, 'block-b');

    const targetRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockAId,
    );
    const sourceRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockBId,
    );

    await Promise.all([
        upsertRaisedBedField({
            raisedBedId: targetRaisedBedId,
            positionIndex: 8,
        }),
        upsertRaisedBedField({
            raisedBedId: sourceRaisedBedId,
            positionIndex: 0,
        }),
    ]);

    const sourceRaisedBed = await getRaisedBed(sourceRaisedBedId);
    assert.ok(sourceRaisedBed);
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);

    const sourceField = sourceRaisedBed.fields[0];
    assert.ok(sourceField);

    const [targetCartItemId, sourceCartItemId] = await Promise.all([
        upsertOrRemoveCartItem(
            null,
            cart.id,
            '1',
            'plantSort',
            1,
            gardenId,
            targetRaisedBedId,
            8,
        ),
        upsertOrRemoveCartItem(
            null,
            cart.id,
            '2',
            'plantSort',
            1,
            gardenId,
            sourceRaisedBedId,
            0,
        ),
        createOperation({
            accountId,
            entityId: 1,
            entityTypeName: 'operation',
            gardenId,
            raisedBedId: sourceRaisedBedId,
            raisedBedFieldId: sourceField.id,
        }),
        createNotification({
            accountId,
            content: 'Merge test',
            header: 'Merge test',
            gardenId,
            raisedBedId: sourceRaisedBedId,
            timestamp: new Date(),
        }),
        createEvent(
            knownEvents.raisedBedFields.plantPlaceV1(
                `${sourceRaisedBedId.toString()}|0`,
                {
                    plantSortId: '99',
                    scheduledDate: new Date().toISOString(),
                },
            ),
        ),
    ]);
    assert.ok(targetCartItemId);
    assert.ok(sourceCartItemId);

    await mergeRaisedBeds(targetRaisedBedId, sourceRaisedBedId);

    const [
        targetRaisedBed,
        sourceAfterMerge,
        operations,
        notifications,
        movedFieldEvent,
        targetCartItemAfterMerge,
        sourceCartItemAfterMerge,
    ] = await Promise.all([
        getRaisedBed(targetRaisedBedId),
        getRaisedBed(sourceRaisedBedId),
        getAllOperations(),
        getNotifications(0, 100),
        storage().query.events.findFirst({
            where: (events, { and, eq }) =>
                and(
                    eq(events.type, 'raisedBedField.plantPlace'),
                    eq(events.aggregateId, `${targetRaisedBedId.toString()}|9`),
                ),
        }),
        storage().query.shoppingCartItems.findFirst({
            where: (shoppingCartItems, { eq }) =>
                eq(shoppingCartItems.id, targetCartItemId),
        }),
        storage().query.shoppingCartItems.findFirst({
            where: (shoppingCartItems, { eq }) =>
                eq(shoppingCartItems.id, sourceCartItemId),
        }),
    ]);

    assert.strictEqual(sourceAfterMerge, null);
    assert.ok(targetRaisedBed);
    assert.strictEqual(targetRaisedBed.fields.length, 18);
    assert.deepStrictEqual(
        targetRaisedBed.fields
            .map((field) => field.positionIndex)
            .sort((a, b) => a - b),
        Array.from({ length: 18 }, (_, index) => index),
    );

    const movedField = targetRaisedBed.fields.find(
        (field) => field.id === sourceField.id,
    );
    assert.ok(movedField);
    assert.strictEqual(movedField?.positionIndex, 9);

    const mergedOperation = operations.find(
        (operation) => operation.raisedBedFieldId === sourceField.id,
    );
    assert.ok(mergedOperation);
    assert.strictEqual(mergedOperation?.raisedBedId, targetRaisedBedId);

    const mergedNotification = notifications.find(
        (notification) => notification.header === 'Merge test',
    );
    assert.ok(mergedNotification);
    assert.strictEqual(mergedNotification?.raisedBedId, targetRaisedBedId);

    assert.ok(movedFieldEvent);
    assert.ok(targetCartItemAfterMerge);
    assert.strictEqual(targetCartItemAfterMerge?.isDeleted, false);
    assert.strictEqual(
        targetCartItemAfterMerge?.raisedBedId,
        targetRaisedBedId,
    );
    assert.ok(sourceCartItemAfterMerge);
    assert.strictEqual(sourceCartItemAfterMerge?.isDeleted, true);
    assert.strictEqual(
        sourceCartItemAfterMerge?.raisedBedId,
        sourceRaisedBedId,
    );
});

test('mergeRaisedBeds preserves sparse source positions inside the appended block', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockAId = await createTestBlock(gardenId, 'block-a');
    const blockBId = await createTestBlock(gardenId, 'block-b');

    const targetRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockAId,
    );
    const sourceRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockBId,
    );

    await Promise.all([
        upsertRaisedBedField({
            raisedBedId: targetRaisedBedId,
            positionIndex: 8,
        }),
        upsertRaisedBedField({
            raisedBedId: sourceRaisedBedId,
            positionIndex: 2,
        }),
        upsertRaisedBedField({
            raisedBedId: sourceRaisedBedId,
            positionIndex: 8,
        }),
        createEvent(
            knownEvents.raisedBedFields.plantPlaceV1(
                `${sourceRaisedBedId.toString()}|2`,
                {
                    plantSortId: '101',
                    scheduledDate: new Date().toISOString(),
                },
            ),
        ),
        createEvent(
            knownEvents.raisedBedFields.plantPlaceV1(
                `${sourceRaisedBedId.toString()}|8`,
                {
                    plantSortId: '102',
                    scheduledDate: new Date().toISOString(),
                },
            ),
        ),
    ]);

    await mergeRaisedBeds(targetRaisedBedId, sourceRaisedBedId);

    const [targetRaisedBed, movedFirstEvent, movedLastEvent] =
        await Promise.all([
            getRaisedBed(targetRaisedBedId),
            storage().query.events.findFirst({
                where: (events, { and, eq }) =>
                    and(
                        eq(events.type, 'raisedBedField.plantPlace'),
                        eq(
                            events.aggregateId,
                            `${targetRaisedBedId.toString()}|11`,
                        ),
                    ),
            }),
            storage().query.events.findFirst({
                where: (events, { and, eq }) =>
                    and(
                        eq(events.type, 'raisedBedField.plantPlace'),
                        eq(
                            events.aggregateId,
                            `${targetRaisedBedId.toString()}|17`,
                        ),
                    ),
            }),
        ]);

    assert.ok(targetRaisedBed);
    assert.strictEqual(targetRaisedBed.fields.length, 18);
    assert.deepStrictEqual(
        targetRaisedBed.fields
            .map((field) => field.positionIndex)
            .sort((a, b) => a - b),
        Array.from({ length: 18 }, (_, index) => index),
    );

    const plantedPositions = targetRaisedBed.fields
        .filter((field) => field.plantSortId)
        .map((field) => field.positionIndex)
        .sort((a, b) => a - b);

    assert.deepStrictEqual(plantedPositions, [11, 17]);
    assert.ok(movedFirstEvent);
    assert.ok(movedLastEvent);
});

test('moveRaisedBedFieldPlantHistory moves the selected active plant cycle to an empty position', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-a');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await upsertRaisedBedField({
        raisedBedId,
        positionIndex: 0,
    });

    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|0`,
            {
                plantSortId: '101',
                scheduledDate: new Date(
                    '2026-01-01T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|0`,
            {
                status: 'removed',
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|0`,
            {
                plantSortId: '202',
                scheduledDate: new Date(
                    '2026-02-01T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|0`,
            {
                status: 'sprouted',
            },
        ),
    );

    const sourceEventsBeforeMove = await getPlantEventsForAggregate(
        `${raisedBedId.toString()}|0`,
    );
    assert.strictEqual(sourceEventsBeforeMove.length, 4);

    const movedEventIds = sourceEventsBeforeMove
        .slice(2)
        .map((event) => event.id);
    const sourcePlantPlaceEventId = sourceEventsBeforeMove[2]?.id;
    const movedEventTimestampsById = new Map(
        sourceEventsBeforeMove
            .slice(2)
            .map((event) => [event.id, event.createdAt.getTime()]),
    );
    assert.ok(sourcePlantPlaceEventId);

    const result = await moveRaisedBedFieldPlantHistory({
        raisedBedId,
        sourcePositionIndex: 0,
        targetPositionIndex: 2,
        sourcePlantPlaceEventId,
    });
    assert.strictEqual(result.swapped, false);

    const raisedBed = await getRaisedBed(raisedBedId);
    assert.ok(raisedBed);

    const sourceField = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    const targetField = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 2,
    );

    assert.ok(sourceField);
    assert.strictEqual(sourceField?.active, false);
    assert.strictEqual(sourceField?.plantStatus, 'removed');
    assert.strictEqual(sourceField?.plantSortId, 101);

    assert.ok(targetField);
    assert.strictEqual(targetField?.active, true);
    assert.strictEqual(targetField?.plantStatus, 'sprouted');
    assert.strictEqual(targetField?.plantSortId, 202);

    const movedEventsAfterMove = await storage().query.events.findMany({
        where: (events, { inArray }) => inArray(events.id, movedEventIds),
        orderBy: (events, { asc }) => [asc(events.createdAt), asc(events.id)],
    });
    assert.strictEqual(movedEventsAfterMove.length, movedEventIds.length);
    assert.deepStrictEqual(
        movedEventsAfterMove.map((event) => event.aggregateId),
        Array.from(
            { length: movedEventIds.length },
            () => `${raisedBedId.toString()}|2`,
        ),
    );
    assert.deepStrictEqual(
        movedEventsAfterMove.map((event) => event.createdAt.getTime()),
        movedEventsAfterMove.map(
            (event) => movedEventTimestampsById.get(event.id) ?? -1,
        ),
    );
});

test('moveRaisedBedFieldPlantHistory moves the selected historical plant cycle to an empty position without touching newer source cycles', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-a');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await upsertRaisedBedField({
        raisedBedId,
        positionIndex: 0,
    });

    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|0`,
            {
                plantSortId: '101',
                scheduledDate: new Date(
                    '2026-01-01T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|0`,
            {
                status: 'removed',
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|0`,
            {
                plantSortId: '202',
                scheduledDate: new Date(
                    '2026-02-01T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|0`,
            {
                status: 'sprouted',
            },
        ),
    );

    const sourceEventsBeforeMove = await getPlantEventsForAggregate(
        `${raisedBedId.toString()}|0`,
    );
    assert.strictEqual(sourceEventsBeforeMove.length, 4);

    const movedEventIds = sourceEventsBeforeMove
        .slice(0, 2)
        .map((event) => event.id);
    const sourcePlantPlaceEventId = sourceEventsBeforeMove[0]?.id;
    const movedEventTimestampsById = new Map(
        sourceEventsBeforeMove
            .slice(0, 2)
            .map((event) => [event.id, event.createdAt.getTime()]),
    );
    assert.ok(sourcePlantPlaceEventId);

    const result = await moveRaisedBedFieldPlantHistory({
        raisedBedId,
        sourcePositionIndex: 0,
        targetPositionIndex: 2,
        sourcePlantPlaceEventId,
    });
    assert.strictEqual(result.swapped, false);

    const raisedBed = await getRaisedBed(raisedBedId);
    assert.ok(raisedBed);

    const sourceField = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    const targetField = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 2,
    );

    assert.ok(sourceField);
    assert.strictEqual(sourceField?.active, true);
    assert.strictEqual(sourceField?.plantStatus, 'sprouted');
    assert.strictEqual(sourceField?.plantSortId, 202);

    assert.ok(targetField);
    assert.strictEqual(targetField?.active, false);
    assert.strictEqual(targetField?.plantStatus, 'removed');
    assert.strictEqual(targetField?.plantSortId, 101);

    const movedEventsAfterMove = await storage().query.events.findMany({
        where: (events, { inArray }) => inArray(events.id, movedEventIds),
        orderBy: (events, { asc }) => [asc(events.createdAt), asc(events.id)],
    });
    assert.strictEqual(movedEventsAfterMove.length, movedEventIds.length);
    assert.deepStrictEqual(
        movedEventsAfterMove.map((event) => event.aggregateId),
        Array.from(
            { length: movedEventIds.length },
            () => `${raisedBedId.toString()}|2`,
        ),
    );
    assert.deepStrictEqual(
        movedEventsAfterMove.map((event) => event.createdAt.getTime()),
        movedEventsAfterMove.map(
            (event) => movedEventTimestampsById.get(event.id) ?? -1,
        ),
    );

    const sourceEventsAfterMove = await getPlantEventsForAggregate(
        `${raisedBedId.toString()}|0`,
    );
    assert.deepStrictEqual(
        sourceEventsAfterMove.map((event) => event.id),
        sourceEventsBeforeMove.slice(2).map((event) => event.id),
    );
});

test('moveRaisedBedFieldPlantHistory swaps all overlapping target plant cycles and leaves non-overlapping target history in place', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-a');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await Promise.all([
        upsertRaisedBedField({
            raisedBedId,
            positionIndex: 0,
        }),
        upsertRaisedBedField({
            raisedBedId,
            positionIndex: 1,
        }),
    ]);

    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|0`,
            {
                plantSortId: '101',
                scheduledDate: new Date(
                    '2026-01-01T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|1`,
            {
                plantSortId: '303',
                scheduledDate: new Date(
                    '2026-01-10T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|1`,
            {
                status: 'removed',
            },
        ),
    );

    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|1`,
            {
                plantSortId: '404',
                scheduledDate: new Date(
                    '2026-01-20T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|0`,
            {
                status: 'removed',
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|1`,
            {
                status: 'removed',
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|1`,
            {
                plantSortId: '505',
                scheduledDate: new Date(
                    '2026-03-01T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|1`,
            {
                status: 'planned',
            },
        ),
    );

    let [sourceEventsBeforeSwap, targetEventsBeforeSwap] = await Promise.all([
        getPlantEventsForAggregate(`${raisedBedId.toString()}|0`),
        getPlantEventsForAggregate(`${raisedBedId.toString()}|1`),
    ]);
    assert.strictEqual(sourceEventsBeforeSwap.length, 2);
    assert.strictEqual(targetEventsBeforeSwap.length, 6);

    const sourceRemovalEventId = sourceEventsBeforeSwap[1]?.id;
    const firstNonOverlappingTargetEvent = targetEventsBeforeSwap[4];
    assert.ok(sourceRemovalEventId);
    assert.ok(firstNonOverlappingTargetEvent);

    // Force an equal-timestamp boundary so overlap detection has to use event
    // order to keep the next target cycle in place.
    await storage()
        .update(events)
        .set({
            createdAt: firstNonOverlappingTargetEvent.createdAt,
        })
        .where(eq(events.id, sourceRemovalEventId));

    [sourceEventsBeforeSwap, targetEventsBeforeSwap] = await Promise.all([
        getPlantEventsForAggregate(`${raisedBedId.toString()}|0`),
        getPlantEventsForAggregate(`${raisedBedId.toString()}|1`),
    ]);
    assert.strictEqual(sourceEventsBeforeSwap.length, 2);
    assert.strictEqual(targetEventsBeforeSwap.length, 6);

    const sourceCycleEventIds = sourceEventsBeforeSwap.map((event) => event.id);
    const sourcePlantPlaceEventId = sourceEventsBeforeSwap[0]?.id;
    const targetFirstOverlappingCycleEventIds = targetEventsBeforeSwap
        .slice(0, 2)
        .map((event) => event.id);
    const targetSecondOverlappingCycleEventIds = targetEventsBeforeSwap
        .slice(2, 4)
        .map((event) => event.id);
    const targetNonOverlappingCycleEventIds = targetEventsBeforeSwap
        .slice(4)
        .map((event) => event.id);
    assert.ok(sourcePlantPlaceEventId);

    const timestampsByEventId = new Map(
        [...sourceEventsBeforeSwap, ...targetEventsBeforeSwap].map((event) => [
            event.id,
            event.createdAt.getTime(),
        ]),
    );

    const result = await moveRaisedBedFieldPlantHistory({
        raisedBedId,
        sourcePositionIndex: 0,
        targetPositionIndex: 1,
        sourcePlantPlaceEventId,
    });
    assert.strictEqual(result.swapped, true);

    const raisedBed = await getRaisedBed(raisedBedId);
    assert.ok(raisedBed);

    const sourceField = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    const targetField = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 1,
    );

    assert.ok(sourceField);
    assert.strictEqual(sourceField?.active, false);
    assert.strictEqual(sourceField?.plantStatus, 'removed');
    assert.strictEqual(sourceField?.plantSortId, 404);

    assert.ok(targetField);
    assert.strictEqual(targetField?.active, true);
    assert.strictEqual(targetField?.plantStatus, 'planned');
    assert.strictEqual(targetField?.plantSortId, 505);

    const movedEventsAfterSwap = await storage().query.events.findMany({
        where: (events, { inArray }) =>
            inArray(events.id, [
                ...sourceCycleEventIds,
                ...targetFirstOverlappingCycleEventIds,
                ...targetSecondOverlappingCycleEventIds,
                ...targetNonOverlappingCycleEventIds,
            ]),
        orderBy: (events, { asc }) => [asc(events.createdAt), asc(events.id)],
    });
    const aggregateByEventId = new Map(
        movedEventsAfterSwap.map((event) => [event.id, event.aggregateId]),
    );

    for (const eventId of sourceCycleEventIds) {
        assert.strictEqual(
            aggregateByEventId.get(eventId),
            `${raisedBedId.toString()}|1`,
        );
    }
    for (const eventId of targetFirstOverlappingCycleEventIds) {
        assert.strictEqual(
            aggregateByEventId.get(eventId),
            `${raisedBedId.toString()}|0`,
        );
    }
    for (const eventId of targetSecondOverlappingCycleEventIds) {
        assert.strictEqual(
            aggregateByEventId.get(eventId),
            `${raisedBedId.toString()}|0`,
        );
    }
    for (const eventId of targetNonOverlappingCycleEventIds) {
        assert.strictEqual(
            aggregateByEventId.get(eventId),
            `${raisedBedId.toString()}|1`,
        );
    }

    assert.deepStrictEqual(
        movedEventsAfterSwap.map((event) => event.createdAt.getTime()),
        movedEventsAfterSwap.map(
            (event) => timestampsByEventId.get(event.id) ?? -1,
        ),
    );
});

test('getRaisedBed returns the latest plant cycle after a field is removed and replanted', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-a');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await upsertRaisedBedField({
        raisedBedId,
        positionIndex: 0,
    });
    const initialRaisedBed = await getRaisedBed(raisedBedId);
    const initialField = initialRaisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.ok(initialField);

    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|0`,
            {
                plantSortId: '101',
                scheduledDate: new Date(
                    '2026-01-01T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|0`,
            {
                status: 'removed',
            },
        ),
    );
    await upsertRaisedBedField({
        raisedBedId,
        positionIndex: 0,
    });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|0`,
            {
                plantSortId: '202',
                scheduledDate: null,
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${raisedBedId.toString()}|0`,
            {
                status: 'sprouted',
            },
        ),
    );

    const raisedBed = await getRaisedBed(raisedBedId);
    assert.ok(raisedBed);

    const field = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.ok(field);
    assert.strictEqual(raisedBed.fields.length, 1);
    assert.strictEqual(field?.id, initialField.id);
    assert.strictEqual(field?.active, true);
    assert.strictEqual(field?.plantStatus, 'sprouted');
    assert.strictEqual(field?.plantSortId, 202);
    assert.strictEqual(field?.plantScheduledDate, undefined);
    assert.strictEqual(field?.plantSowDate, undefined);
    assert.ok(field?.plantGrowthDate instanceof Date);
    assert.strictEqual(field?.plantDeadDate, undefined);
    assert.strictEqual(field?.plantHarvestedDate, undefined);
    assert.strictEqual(field?.plantRemovedDate, undefined);
    assert.strictEqual(field?.stoppedDate, undefined);
    assert.strictEqual(field?.toBeRemoved, false);
});

test('raised bed field assignment metadata is projected for assign and unassign updates', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-assignment');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const assignedUserId = await createUserWithPassword(
        'assigned-user@example.com',
        'password',
    );
    const assignedByUserId = await createUserWithPassword(
        'assigned-by@example.com',
        'password',
    );

    await Promise.all([
        assignUserToFarm(farmId, assignedUserId),
        assignUserToFarm(farmId, assignedByUserId),
        upsertRaisedBedField({
            raisedBedId,
            positionIndex: 0,
        }),
    ]);

    const aggregateId = `${raisedBedId.toString()}|0`;
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: '101',
            scheduledDate: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            assignedUserId,
            assignedBy: assignedByUserId,
        }),
    );

    let [plantCycle] = await getRaisedBedFieldPlantCycles(raisedBedId);
    assert.ok(plantCycle);
    assert.strictEqual(plantCycle.assignedUserId, assignedUserId);
    assert.strictEqual(plantCycle.assignedBy, assignedByUserId);
    assert.ok(plantCycle.assignedAt instanceof Date);

    let [field] = await getRaisedBedFieldsWithEvents(raisedBedId);
    assert.ok(field);
    assert.strictEqual(field.assignedUserId, assignedUserId);
    assert.strictEqual(field.assignedBy, assignedByUserId);
    assert.ok(field.assignedAt instanceof Date);

    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            assignedUserId: null,
            assignedUserIds: [],
            assignedBy: assignedByUserId,
        }),
    );

    [plantCycle] = await getRaisedBedFieldPlantCycles(raisedBedId);
    assert.ok(plantCycle);
    assert.strictEqual(plantCycle.assignedUserId, null);
    assert.strictEqual(plantCycle.assignedBy, null);
    assert.strictEqual(plantCycle.assignedAt, undefined);

    [field] = await getRaisedBedFieldsWithEvents(raisedBedId);
    assert.ok(field);
    assert.strictEqual(field.assignedUserId, null);
    assert.strictEqual(field.assignedBy, null);
    assert.strictEqual(field.assignedAt, undefined);
});

test('upsertRaisedBedField reuses the same row after a field is deleted and planted again', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-a');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await upsertRaisedBedField({
        raisedBedId,
        positionIndex: 0,
    });

    const initialRaisedBed = await getRaisedBed(raisedBedId);
    const initialField = initialRaisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.ok(initialField);

    await createEvent(
        knownEvents.raisedBedFields.deletedV1(`${raisedBedId.toString()}|0`),
    );
    await deleteRaisedBedField(raisedBedId, 0);

    const deletedFields = await getRaisedBedFieldsWithEvents(raisedBedId);
    assert.strictEqual(deletedFields.length, 0);

    await upsertRaisedBedField({
        raisedBedId,
        positionIndex: 0,
    });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|0`,
            {
                plantSortId: '303',
                scheduledDate: new Date(
                    '2026-03-01T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );

    const raisedBed = await getRaisedBed(raisedBedId);
    assert.ok(raisedBed);
    assert.strictEqual(raisedBed.fields.length, 1);

    const field = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.ok(field);
    assert.strictEqual(field?.id, initialField.id);
    assert.strictEqual(field?.active, true);
    assert.strictEqual(field?.plantSortId, 303);
});
