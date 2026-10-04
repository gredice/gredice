import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    createOperation,
    deleteEventById,
    getAppliedRaisedBedOperationSummariesForGarden,
    getAppliedRaisedBedOperationsForGarden,
    knownEvents,
    operations,
    storage,
    updateEventCreatedAt,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import type { OperationTaskAdminValues } from '../src/operationTaskAdministration';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('garden scene read matches replay through correction, reschedule, tie ordering and erasure', async () => {
    createTestDb();
    const accountId = await createAccount();
    const gardenId = await createTestGarden({
        accountId,
        farmId: await ensureFarmId(),
    });
    const raisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        await createTestBlock(gardenId, 'Raised_Bed'),
    );
    const id = await createOperation({
        accountId,
        gardenId,
        raisedBedId,
        entityId: 1,
        entityTypeName: 'operation',
    });
    const actor = randomUUID();
    const aggregateId = String(id);
    let sequence = 0;
    const append = (event: Parameters<typeof createEvent>[0]) =>
        createEvent({
            ...event,
            createdAt: new Date(Date.UTC(2040, 0, 1, 0, sequence++)),
        });
    const compare = async () => {
        const full = await getAppliedRaisedBedOperationsForGarden(
            accountId,
            gardenId,
        );
        const projected = await getAppliedRaisedBedOperationSummariesForGarden(
            accountId,
            gardenId,
        );
        assert.deepEqual(
            projected,
            full.map(
                ({
                    id,
                    entityId,
                    raisedBedId,
                    raisedBedFieldId,
                    createdAt,
                    completedAt,
                    scheduledDate,
                    status,
                }) => ({
                    id,
                    entityId,
                    raisedBedId,
                    raisedBedFieldId,
                    createdAt,
                    completedAt,
                    scheduledDate,
                    status,
                }),
            ),
        );
        return projected;
    };
    await compare();
    await append(
        knownEvents.operations.scheduledV1(aggregateId, {
            scheduledDate: '2040-01-02T10:00:00+02:00',
        }),
    );
    await compare();
    await append(
        knownEvents.operations.completedV1(aggregateId, {
            completedBy: actor,
            images: [`https://example.test/${'x'.repeat(20_000)}`],
        }),
    );
    const initial = await compare();
    assert.equal(
        initial[0]?.scheduledDate?.toISOString(),
        '2040-01-02T08:00:00.000Z',
    );
    assert.ok(JSON.stringify(initial).length < 500);
    await append(
        knownEvents.operations.completedV1(aggregateId, { completedBy: actor }),
    );
    assert.equal(
        (await compare())[0]?.completedAt?.toISOString(),
        initial[0]?.completedAt?.toISOString(),
    );
    await append(
        knownEvents.operations.verifiedV1(aggregateId, { verifiedBy: actor }),
    );
    await compare();
    const task: OperationTaskAdminValues = {
        entityId: 1,
        isAccepted: false,
        assignedUserIds: [],
        status: 'completed',
        timestamp: '2030-01-01T00:00:00.000Z',
        createdAt: '2030-01-01T00:00:00.000Z',
        assignedAt: null,
        scheduledAt: null,
        scheduledDate: null,
        completedAt: '2035-01-01T00:00:00.000Z',
        verifiedAt: '2035-01-02T00:00:00.000Z',
        blockedAt: null,
        canceledAt: null,
        requestNote: '',
        blockReasonCode: '',
        blockReasonLabel: '',
        blockNote: '',
        error: '',
        errorCode: '',
        cancelReason: '',
    };
    const correct = (task: OperationTaskAdminValues) =>
        append(
            knownEvents.operations.adminUpdatedV1(aggregateId, {
                task,
                updatedBy: actor,
                assignedBy: null,
                completedBy: actor,
                verifiedBy: actor,
                blockedBy: null,
                canceledBy: null,
                completionEventId: null,
                verificationEventId: null,
                blockedEventId: null,
            }),
        );
    const malformedCorrection = await createEvent({
        aggregateId,
        type: 'operation.admin.update',
        version: 1,
        data: { task: { status: 'completed', completedAt: 'bad-date' } },
        createdAt: new Date(Date.UTC(2040, 0, 1, 0, sequence++)),
    });
    await compare();
    await deleteEventById(malformedCorrection.id);
    await correct(task);
    assert.equal(
        (await compare())[0]?.completedAt?.toISOString(),
        task.completedAt,
    );
    await correct({
        ...task,
        status: 'new',
        completedAt: null,
        verifiedAt: null,
    });
    assert.deepEqual(await compare(), []);
    await append(
        knownEvents.operations.verifiedV1(aggregateId, { verifiedBy: actor }),
    );
    assert.equal((await compare())[0]?.completedAt, undefined);
    await append(
        knownEvents.operations.scheduledV1(aggregateId, {
            scheduledDate: '2040-02-01T00:00:00Z',
        }),
    );
    assert.deepEqual(await compare(), []);
    const completion = await append(
        knownEvents.operations.completedV1(aggregateId, { completedBy: actor }),
    );
    await compare();
    // Equal timestamps must use event ID ordering, just like canonical replay.
    await createEvent({
        ...knownEvents.operations.scheduledV1(aggregateId, {
            scheduledDate: '2040-03-01T00:00:00Z',
        }),
        createdAt: completion.createdAt,
    });
    assert.deepEqual(await compare(), []);
    await updateEventCreatedAt(completion.id, new Date('2041-01-01T00:00:00Z'));
    assert.equal(
        (await compare())[0]?.completedAt?.toISOString(),
        '2041-01-01T00:00:00.000Z',
    );
    await deleteEventById(completion.id);
    assert.deepEqual(await compare(), []);
    await append(
        knownEvents.operations.completedV1(aggregateId, { completedBy: actor }),
    );
    await storage()
        .update(operations)
        .set({ isDeleted: true })
        .where(eq(operations.id, id));
    assert.deepEqual(await compare(), []);
});
