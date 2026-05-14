import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    createOperation,
    events,
    getOperationsPage,
    knownEvents,
    knownEventTypes,
    operations,
    storage,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createOperationsPageTestContext() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'operations-page-block');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    return {
        accountId,
        gardenId,
        raisedBedId,
    };
}

async function createDatedOperation(input: {
    accountId: string;
    gardenId: number;
    raisedBedId: number;
    createdAt: Date;
}) {
    const id = await createOperation({
        accountId: input.accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId: input.gardenId,
        raisedBedId: input.raisedBedId,
        timestamp: input.createdAt,
    });

    await storage()
        .update(operations)
        .set({
            createdAt: input.createdAt,
            timestamp: input.createdAt,
        })
        .where(eq(operations.id, id));

    return id;
}

async function setOperationEventCreatedAt(
    operationId: number,
    type: string,
    createdAt: Date,
) {
    await storage()
        .update(events)
        .set({ createdAt })
        .where(
            and(
                eq(events.aggregateId, operationId.toString()),
                eq(events.type, type),
            ),
        );
}

test('getOperationsPage returns included history by newest status change first', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createOperationsPageTestContext();

    const oldOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-01-01T08:00:00.000Z'),
    });
    const completedOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-02-01T08:00:00.000Z'),
    });
    const createdOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-04-01T08:00:00.000Z'),
    });
    const scheduledOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-01-15T08:00:00.000Z'),
    });

    await createEvent(
        knownEvents.operations.completedV1(completedOperationId.toString(), {
            completedBy: 'test-user',
        }),
    );
    await setOperationEventCreatedAt(
        completedOperationId,
        knownEventTypes.operations.complete,
        new Date('2026-05-01T08:00:00.000Z'),
    );
    await createEvent(
        knownEvents.operations.scheduledV1(scheduledOperationId.toString(), {
            scheduledDate: '2026-05-10T08:00:00.000Z',
        }),
    );
    await setOperationEventCreatedAt(
        scheduledOperationId,
        knownEventTypes.operations.schedule,
        new Date('2026-05-03T08:00:00.000Z'),
    );

    const firstPage = await getOperationsPage({
        accountId,
        gardenId,
        includeCompleted: true,
        limit: 2,
    });

    assert.deepStrictEqual(
        firstPage.items.map((operation) => operation.id),
        [scheduledOperationId, completedOperationId],
    );
    assert.strictEqual(firstPage.nextCursor, 2);

    const secondPage = await getOperationsPage({
        accountId,
        gardenId,
        includeCompleted: true,
        cursor: firstPage.nextCursor ?? 0,
        limit: 2,
    });

    assert.deepStrictEqual(
        secondPage.items.map((operation) => operation.id),
        [createdOperationId, oldOperationId],
    );
    assert.strictEqual(secondPage.nextCursor, null);
});
