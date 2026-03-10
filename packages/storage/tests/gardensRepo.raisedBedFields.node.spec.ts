import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    createNotification,
    createOperation,
    deleteRaisedBedField,
    getAllOperations,
    getNotifications,
    getOrCreateShoppingCart,
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    knownEvents,
    mergeRaisedBeds,
    storage,
    upsertOrRemoveCartItem,
    upsertRaisedBedField,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

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

    const raisedBed = await getRaisedBed(raisedBedId);
    assert.ok(raisedBed);

    const field = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.ok(field);
    assert.strictEqual(field?.active, true);
    assert.strictEqual(field?.plantStatus, 'sprouted');
    assert.strictEqual(field?.plantSortId, 202);
    assert.strictEqual(
        field?.plantScheduledDate?.toISOString(),
        '2026-02-01T00:00:00.000Z',
    );
});
