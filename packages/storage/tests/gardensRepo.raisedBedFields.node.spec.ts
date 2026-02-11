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
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    knownEvents,
    mergeRaisedBeds,
    storage,
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

test('mergeRaisedBeds merges fields and linked records without data loss', async () => {
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
            positionIndex: 0,
        }),
        upsertRaisedBedField({
            raisedBedId: sourceRaisedBedId,
            positionIndex: 0,
        }),
    ]);

    const sourceRaisedBed = await getRaisedBed(sourceRaisedBedId);
    assert.ok(sourceRaisedBed);

    const sourceField = sourceRaisedBed.fields[0];
    assert.ok(sourceField);

    await Promise.all([
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

    await mergeRaisedBeds(targetRaisedBedId, sourceRaisedBedId);

    const [
        targetRaisedBed,
        sourceAfterMerge,
        operations,
        notifications,
        movedFieldEvent,
    ] = await Promise.all([
        getRaisedBed(targetRaisedBedId),
        getRaisedBed(sourceRaisedBedId),
        getAllOperations(),
        getNotifications(0, 100),
        storage().query.events.findFirst({
            where: (events, { and, eq }) =>
                and(
                    eq(events.type, 'raisedBedField.plantPlace'),
                    eq(events.aggregateId, `${targetRaisedBedId.toString()}|1`),
                ),
        }),
    ]);

    assert.strictEqual(sourceAfterMerge, null);
    assert.ok(targetRaisedBed);
    assert.strictEqual(targetRaisedBed.fields.length, 2);

    const movedField = targetRaisedBed.fields.find(
        (field) => field.id === sourceField.id,
    );
    assert.ok(movedField);
    assert.strictEqual(movedField?.positionIndex, 1);

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
});
