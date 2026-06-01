import assert from 'node:assert/strict';
import test from 'node:test';
import {
    clearSandboxField,
    createAccount,
    createEvent,
    createGardenStack,
    createNotification,
    createOperation,
    createSandboxGarden,
    deleteSandboxGardenCompletely,
    getGarden,
    getRaisedBedFieldsWithEvents,
    getSandboxGardenDeletionCandidate,
    knownEvents,
    sowSandboxField,
    storage,
    updateGardenStack,
} from '@gredice/storage';
import { and, eq, inArray, like, or } from 'drizzle-orm';
import {
    events,
    gardenBlocks,
    gardenStacks,
    gardens,
    notifications,
    operations,
    raisedBedFields,
    raisedBedSensors,
    raisedBeds,
    shoppingCartItems,
    shoppingCarts,
    transactions,
} from '../src/schema';
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

test('deleteSandboxGardenCompletely removes sandbox garden dependencies across retries', async () => {
    createTestDb();
    await ensureFarmId();
    const accountId = await createAccount();
    const gardenId = await createSandboxGarden({ accountId });
    const blockId = await createTestBlock(gardenId, 'sandbox-delete-block');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await createGardenStack(gardenId, { x: 0, y: 0 });
    await updateGardenStack(gardenId, { x: 0, y: 0, blocks: [blockId] });
    await sowSandboxField({
        raisedBedId,
        positionIndex: 4,
        plantSortId: 337,
        sowDate: daysAgo(30),
        status: 'sprouted',
    });
    await createEvent(
        knownEvents.raisedBeds.createdV1(raisedBedId.toString(), {
            blockId,
            gardenId,
        }),
    );
    await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
        timestamp: new Date(),
    });
    await createNotification(
        {
            accountId,
            blockId,
            content: 'Sandbox cleanup test',
            gardenId,
            header: 'Sandbox cleanup test',
            raisedBedId,
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );
    await storage().insert(raisedBedSensors).values({
        raisedBedId,
        sensorSignalcoId: 'sandbox-cleanup-sensor',
    });
    const cart = (
        await storage()
            .insert(shoppingCarts)
            .values({ accountId })
            .returning({ id: shoppingCarts.id })
    )[0];
    assert.ok(cart);
    await storage().insert(shoppingCartItems).values({
        amount: 1,
        cartId: cart.id,
        entityId: '337',
        entityTypeName: 'plantSort',
        gardenId,
        raisedBedId,
    });
    await storage().insert(transactions).values({
        accountId,
        amount: 1,
        currency: 'eur',
        gardenId,
        status: 'test',
        stripePaymentId: 'sandbox-cleanup-payment',
    });

    let complete = false;
    let attempts = 0;
    while (!complete) {
        const result = await deleteSandboxGardenCompletely(gardenId, {
            batchSize: 1,
            maxBatches: 1,
        });
        complete = result.complete;
        attempts += 1;
        assert.ok(attempts < 100, 'cleanup should finish after retries');
    }

    assert.ok(attempts > 1, 'test should exercise retry continuation');
    assert.equal(await getGarden(gardenId), null);
    assert.equal(await getSandboxGardenDeletionCandidate(gardenId), undefined);

    const gardenRows = await storage()
        .select({ id: gardens.id })
        .from(gardens)
        .where(eq(gardens.id, gardenId));
    assert.equal(gardenRows.length, 0);

    const gardenBlockRows = await storage()
        .select({ id: gardenBlocks.id })
        .from(gardenBlocks)
        .where(eq(gardenBlocks.gardenId, gardenId));
    assert.equal(gardenBlockRows.length, 0);

    const gardenStackRows = await storage()
        .select({ id: gardenStacks.id })
        .from(gardenStacks)
        .where(eq(gardenStacks.gardenId, gardenId));
    assert.equal(gardenStackRows.length, 0);

    const raisedBedRows = await storage()
        .select({ id: raisedBeds.id })
        .from(raisedBeds)
        .where(eq(raisedBeds.gardenId, gardenId));
    assert.equal(raisedBedRows.length, 0);

    const fieldRows = await storage()
        .select({ id: raisedBedFields.id })
        .from(raisedBedFields)
        .where(eq(raisedBedFields.raisedBedId, raisedBedId));
    assert.equal(fieldRows.length, 0);

    const sensorRows = await storage()
        .select({ id: raisedBedSensors.id })
        .from(raisedBedSensors)
        .where(eq(raisedBedSensors.raisedBedId, raisedBedId));
    assert.equal(sensorRows.length, 0);

    const cartItemRows = await storage()
        .select({ id: shoppingCartItems.id })
        .from(shoppingCartItems)
        .where(eq(shoppingCartItems.gardenId, gardenId));
    assert.equal(cartItemRows.length, 0);

    const transactionRows = await storage()
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.gardenId, gardenId));
    assert.equal(transactionRows.length, 0);

    const notificationRows = await storage()
        .select({ id: notifications.id })
        .from(notifications)
        .where(
            or(
                eq(notifications.gardenId, gardenId),
                eq(notifications.raisedBedId, raisedBedId),
                eq(notifications.blockId, blockId),
            ),
        );
    assert.equal(notificationRows.length, 0);

    const operationRows = await storage()
        .select({ id: operations.id })
        .from(operations)
        .where(
            or(
                eq(operations.gardenId, gardenId),
                eq(operations.raisedBedId, raisedBedId),
            ),
        );
    assert.equal(operationRows.length, 0);

    const eventRows = await storage()
        .select({ id: events.id })
        .from(events)
        .where(
            or(
                and(
                    inArray(events.type, [
                        'garden.create',
                        'garden.blockPlace',
                    ]),
                    eq(events.aggregateId, gardenId.toString()),
                ),
                and(
                    eq(events.type, 'raisedBed.create'),
                    eq(events.aggregateId, raisedBedId.toString()),
                ),
                like(events.aggregateId, `${raisedBedId.toString()}|%`),
            ),
        );
    assert.equal(eventRows.length, 0);
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

function daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
}

test('replanting a sandbox field at an older age replaces the previous plant', async () => {
    createTestDb();
    await ensureFarmId();
    const accountId = await createAccount();
    const gardenId = await createSandboxGarden({ accountId });
    const blockId = await createTestBlock(gardenId, 'sandbox-block-2');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    // First a young plant, then replant the same position with an OLDER plant
    // whose backdated sow date predates the first plant's events.
    await sowSandboxField({
        raisedBedId,
        positionIndex: 5,
        plantSortId: 230,
        sowDate: daysAgo(14),
        status: 'sprouted',
    });
    const olderSowDate = daysAgo(80);
    await sowSandboxField({
        raisedBedId,
        positionIndex: 5,
        plantSortId: 337,
        sowDate: olderSowDate,
        status: 'ready',
    });

    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    const positionFields = fields.filter(
        (candidate) => candidate.positionIndex === 5,
    );
    assert.equal(
        positionFields.length,
        1,
        'only one active plant per position',
    );
    const field = positionFields[0];
    // The newest plant wins, even though its sow date is further in the past.
    assert.equal(field.plantSortId, 337);
    assert.equal(field.plantStatus, 'ready');
    const sownAt = new Date(field.plantSowDate ?? 0).getTime();
    assert.ok(
        Math.abs(sownAt - olderSowDate.getTime()) < 24 * 60 * 60 * 1000,
        'plantSowDate should match the latest sow',
    );
});

test('clearSandboxField empties the field position', async () => {
    createTestDb();
    await ensureFarmId();
    const accountId = await createAccount();
    const gardenId = await createSandboxGarden({ accountId });
    const blockId = await createTestBlock(gardenId, 'sandbox-block-3');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await sowSandboxField({
        raisedBedId,
        positionIndex: 2,
        plantSortId: 230,
        sowDate: daysAgo(40),
        status: 'ready',
    });
    await clearSandboxField(raisedBedId, 2);

    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    assert.ok(
        !fields.some((candidate) => candidate.positionIndex === 2),
        'cleared position should have no plant',
    );
});
