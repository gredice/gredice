import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './testDb';
import { createAccount, createEvent, knownEvents, knownEventTypes } from '@gredice/storage';
import { ensureFarmId, createTestGarden, createTestRaisedBed, createTestBlock } from './helpers/testHelpers';
import {
    getRaisedBed,
    upsertRaisedBedField,
    getRaisedBedFieldsWithEvents,
    deleteRaisedBedField
} from '@gredice/storage';

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
