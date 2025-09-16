import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    deleteRaisedBedField,
    getRaisedBed,
    getRaisedBedFieldDiaryEntries,
    getRaisedBedFieldsWithEvents,
    knownEvents,
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

test('getRaisedBedFieldDiaryEntries returns newest entries first', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-entries');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const positionIndex = 2;
    await upsertRaisedBedField({ raisedBedId, positionIndex });

    const aggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
    const olderEvent = knownEvents.raisedBedFields.createdV1(aggregateId, {
        status: 'new',
    });
    await createEvent(olderEvent);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const newerEvent = knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
        status: 'sprouted',
    });
    await createEvent(newerEvent);

    const entries = await getRaisedBedFieldDiaryEntries(
        raisedBedId,
        positionIndex,
    );
    assert.ok(Array.isArray(entries));
    assert.ok(entries.length >= 2);
    assert.strictEqual(entries[0]?.name, 'Biljka je proklijala');
    assert.strictEqual(entries[1]?.name, 'Polje zauzeto');
    assert.ok(
        entries[0]?.timestamp instanceof Date &&
            entries[1]?.timestamp instanceof Date &&
            entries[0].timestamp.getTime() > entries[1].timestamp.getTime(),
    );
});
