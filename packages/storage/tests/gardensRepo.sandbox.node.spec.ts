import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createSandboxGarden,
    getGarden,
    getRaisedBedFieldsWithEvents,
    sowSandboxField,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('createSandboxGarden creates an empty garden flagged as sandbox', async () => {
    createTestDb();
    await ensureFarmId();
    const accountId = await createAccount();

    const gardenId = await createSandboxGarden({
        accountId,
        name: 'Moj vrt za igru',
    });

    const garden = await getGarden(gardenId);
    assert.ok(garden, 'sandbox garden should exist');
    assert.equal(garden?.isSandbox, true);
    assert.equal(garden?.name, 'Moj vrt za igru');
    // Empty garden — no stacks or raised beds are seeded.
    assert.equal(garden?.stacks.length, 0);
    assert.equal(garden?.raisedBeds.length, 0);
});

test('createSandboxGarden falls back to a default name', async () => {
    createTestDb();
    await ensureFarmId();
    const accountId = await createAccount();

    const gardenId = await createSandboxGarden({ accountId });
    const garden = await getGarden(gardenId);
    assert.equal(garden?.name, 'Vrt za igru');
});

test('sowSandboxField backdates the plant so it renders already grown', async () => {
    createTestDb();
    await ensureFarmId();
    const accountId = await createAccount();
    const gardenId = await createSandboxGarden({ accountId });
    const blockId = await createTestBlock(gardenId, 'sandbox-block-1');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    const ageDays = 80;
    const sowDate = new Date();
    sowDate.setDate(sowDate.getDate() - ageDays);

    await sowSandboxField({
        raisedBedId,
        positionIndex: 3,
        plantSortId: 337,
        sowDate,
        status: 'ready',
    });

    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    const field = fields.find((candidate) => candidate.positionIndex === 3);
    assert.ok(field, 'sown field should exist');
    assert.equal(field?.plantSortId, 337);
    // A render-eligible status so generated plants are drawn.
    assert.equal(field?.plantStatus, 'ready');
    assert.ok(field?.plantSowDate, 'plantSowDate should be set');
    // Sow date is backdated to the requested age (within a day tolerance).
    const sownAt = new Date(field?.plantSowDate ?? 0).getTime();
    assert.ok(
        Math.abs(sownAt - sowDate.getTime()) < 24 * 60 * 60 * 1000,
        'plantSowDate should match the backdated sow date',
    );
});
