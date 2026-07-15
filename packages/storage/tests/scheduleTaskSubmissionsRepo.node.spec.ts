import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    assignOperationTaskUsers,
    assignPlantingTaskUsers,
    assignUserToFarm,
    cancelGardenDiaryOperation,
    cancelGardenDiaryRaisedBedField,
    createAccount,
    createAutomationDefinition,
    createEvent,
    createFarm,
    createOperation,
    deleteRaisedBedField,
    farmUsers,
    GardenDiaryCancelError,
    GardenDiaryRescheduleError,
    getAllEvents,
    getFarmUserBlockedOperations,
    getOperationById,
    getRaisedBedFieldsWithEvents,
    getScheduleTaskBlockReason,
    knownEvents,
    knownEventTypes,
    listAutomationRuns,
    moveRaisedBedFieldPlantHistory,
    raisedBeds,
    rescheduleGardenDiaryOperation,
    rescheduleGardenDiaryRaisedBedField,
    ScheduleTaskSubmissionError,
    sql,
    storage,
    submitOperationTaskBlock,
    submitOperationTaskCompletion,
    submitPlantingTaskBlock,
    submitPlantingTaskCompletion,
    switchOperationEntity,
    unacceptOperation,
    updateOperationCompletionEvidence,
    upsertRaisedBedField,
    users,
    verifyOperationTaskCompletion,
    verifyPlantingTaskCompletion,
    withOperationScheduleTaskTransaction,
    withPlantingScheduleTaskTransaction,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createTestUser(role: 'admin' | 'farmer') {
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `${role}-${userId}@example.com`,
            role,
        });
    return userId;
}

async function createTaskFixture() {
    createTestDb();
    const [adminId, farmerId, otherFarmerId] = await Promise.all([
        createTestUser('admin'),
        createTestUser('farmer'),
        createTestUser('farmer'),
    ]);
    const farmId = await createFarm({
        name: `Schedule task farm ${randomUUID()}`,
        latitude: 45.8,
        longitude: 15.9,
    });
    await Promise.all([
        assignUserToFarm(farmId, farmerId),
        assignUserToFarm(farmId, otherFarmerId),
    ]);

    const accountId = await createAccount();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(
        gardenId,
        `task-submission-${randomUUID()}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const operationEntityId = 1;
    const operationId = await createOperation({
        entityId: operationEntityId,
        entityTypeName: 'operation',
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        timestamp: new Date('2000-01-01T08:00:00.000Z'),
    });
    await createEvent(
        knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate: '2026-07-15T08:00:00.000Z',
        }),
    );
    await acceptOperation(operationId);

    const positionIndex = 0;
    await upsertRaisedBedField({ raisedBedId, positionIndex });
    const plantingAggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
    const plantSortId = 101;
    const plantPlaceEvent = await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(plantingAggregateId, {
            plantSortId: plantSortId.toString(),
            scheduledDate: new Date('2026-07-15T08:00:00.000Z').toISOString(),
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(plantingAggregateId, {
            status: 'planned',
        }),
    );

    const [assignableOperation, assignableFields] = await Promise.all([
        getOperationById(operationId),
        getRaisedBedFieldsWithEvents(raisedBedId),
    ]);
    const assignablePlantCycle = assignableFields
        .find((field) => field.positionIndex === positionIndex)
        ?.plantCycles.find((plantCycle) => plantCycle.active);
    assert.ok(assignablePlantCycle);

    await Promise.all([
        assignOperationTaskUsers({
            operationId,
            expectedEntityId: operationEntityId,
            expectedTaskVersionEventId: assignableOperation.taskVersionEventId,
            assignedUserIds: [farmerId],
            assignedBy: adminId,
        }),
        assignPlantingTaskUsers({
            raisedBedId,
            positionIndex,
            expectedPlantCycleEventId: plantPlaceEvent.id,
            expectedPlantCycleVersionEventId: assignablePlantCycle.endedEventId,
            expectedPlantSortId: plantSortId,
            assignedUserIds: [farmerId],
            assignedBy: adminId,
        }),
    ]);

    const [operation, fields] = await Promise.all([
        getOperationById(operationId),
        getRaisedBedFieldsWithEvents(raisedBedId),
    ]);
    const activePlantCycle = fields
        .find((field) => field.positionIndex === positionIndex)
        ?.plantCycles.find((plantCycle) => plantCycle.active);
    assert.ok(activePlantCycle);

    return {
        accountId,
        adminId,
        farmerId,
        farmId,
        gardenId,
        otherFarmerId,
        operationId,
        operationEntityId,
        operationTaskVersionEventId: operation.taskVersionEventId,
        plantingAggregateId,
        plantCycleEventId: plantPlaceEvent.id,
        plantCycleVersionEventId: activePlantCycle.endedEventId,
        plantSortId,
        positionIndex,
        raisedBedId,
    };
}

async function assertSubmissionError(
    promise: Promise<unknown>,
    code: ScheduleTaskSubmissionError['code'],
) {
    await assert.rejects(promise, (error: unknown) => {
        assert.ok(error instanceof ScheduleTaskSubmissionError);
        assert.strictEqual(error.code, code);
        return true;
    });
}

function eventAutomationGraph(eventType: string) {
    return {
        nodes: [
            {
                id: 'trigger',
                moduleKey: 'trigger.domainEvent',
                kind: 'trigger' as const,
                position: { x: 0, y: 0 },
                config: { eventType },
            },
            {
                id: 'log',
                moduleKey: 'action.log',
                kind: 'action' as const,
                position: { x: 280, y: 0 },
                config: { message: 'schedule task submission' },
            },
        ],
        edges: [
            {
                id: 'trigger-to-log',
                source: 'trigger',
                target: 'log',
            },
        ],
    };
}

async function waitForAdvisoryLockWaiter(minimumWaitingCount = 1) {
    const db = createTestDb();
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const result = await db.execute(
            sql<{
                waiting_count: string;
            }>`select count(*)::text as waiting_count
             from pg_locks
             where locktype = 'advisory' and not granted`,
        );
        if (Number(result.rows[0]?.waiting_count ?? 0) >= minimumWaitingCount) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('Timed out waiting for advisory lock contention.');
}

async function waitForTransactionLockWaiter(minimumWaitingCount = 1) {
    const db = createTestDb();
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const result = await db.execute(
            sql<{
                waiting_count: string;
            }>`select count(*)::text as waiting_count
             from pg_locks
             where locktype = 'transactionid' and not granted`,
        );
        if (Number(result.rows[0]?.waiting_count ?? 0) >= minimumWaitingCount) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('Timed out waiting for membership row lock contention.');
}

test('concurrent operation completion creates one terminal event and one automation run', async () => {
    const fixture = await createTaskFixture();
    const definition = await createAutomationDefinition({
        key: `test.operation-completion-${randomUUID()}`,
        name: 'Operation completion concurrency',
        status: 'enabled',
        graph: eventAutomationGraph(knownEventTypes.operations.complete),
    });

    const results = await Promise.all(
        Array.from({ length: 8 }, () =>
            submitOperationTaskCompletion({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                imageUrls: ['https://example.com/proof.jpg'],
                notes: 'Završeno na terenu',
            }),
        ),
    );

    assert.strictEqual(results.filter((result) => result.created).length, 1);
    assert.strictEqual(
        new Set(results.map((result) => result.eventId)).size,
        1,
    );
    const completionEvents = await getAllEvents(
        knownEventTypes.operations.complete,
        [fixture.operationId.toString()],
    );
    assert.strictEqual(completionEvents.length, 1);
    assert.strictEqual(
        (
            await listAutomationRuns({
                automationDefinitionId: definition.id,
                limit: 20,
            })
        ).length,
        1,
    );
});

test('blocked operation and planting project controlled reason, proof, actor, and event time', async () => {
    const fixture = await createTaskFixture();
    const reason = getScheduleTaskBlockReason('missing_materials');
    const [operationResult, plantingResult] = await Promise.all([
        submitOperationTaskBlock({
            operationId: fixture.operationId,
            expectedEntityId: fixture.operationEntityId,
            expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
            reasonCode: reason.code,
            note: 'Nedostaje mreža za potporu',
            imageUrls: ['https://example.com/operation-block.jpg'],
        }),
        submitPlantingTaskBlock({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
            expectedPlantSortId: fixture.plantSortId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
            reasonCode: 'location_not_ready',
            note: 'Tlo je previše natopljeno',
            imageUrls: ['https://example.com/planting-block.jpg'],
        }),
    ]);

    const operation = await getOperationById(fixture.operationId);
    assert.strictEqual(operation.status, 'blocked');
    assert.strictEqual(operation.blockedEventId, operationResult.eventId);
    assert.deepStrictEqual(operation.blockedAt, operationResult.occurredAt);
    assert.strictEqual(operation.blockedBy, fixture.farmerId);
    assert.strictEqual(operation.blockReasonCode, reason.code);
    assert.strictEqual(operation.blockReasonLabel, reason.label);
    assert.strictEqual(operation.blockNote, 'Nedostaje mreža za potporu');
    assert.deepStrictEqual(operation.blockImageUrls, [
        'https://example.com/operation-block.jpg',
    ]);

    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.ok(field);
    assert.strictEqual(field.plantStatus, 'blocked');
    assert.strictEqual(field.blockedEventId, plantingResult.eventId);
    assert.deepStrictEqual(field.blockedAt, plantingResult.occurredAt);
    assert.strictEqual(field.blockedBy, fixture.farmerId);
    assert.strictEqual(field.blockReasonCode, 'location_not_ready');
    assert.strictEqual(
        field.blockReasonLabel,
        'Biljka, gredica ili lokacija nije spremna',
    );
    assert.strictEqual(field.blockNote, 'Tlo je previše natopljeno');
    assert.deepStrictEqual(field.blockImageUrls, [
        'https://example.com/planting-block.jpg',
    ]);
    assert.strictEqual(field.plantCycles[0]?.plantStatus, 'blocked');
    assert.strictEqual(
        field.plantCycles[0]?.blockedEventId,
        plantingResult.eventId,
    );

    const blockedOperations = await getFarmUserBlockedOperations(
        fixture.farmerId,
        {
            from: new Date(operationResult.occurredAt.getTime() - 1000),
            to: new Date(operationResult.occurredAt.getTime() + 1000),
        },
    );
    assert.deepStrictEqual(
        blockedOperations.map((item) => item.id),
        [fixture.operationId],
    );

    await Promise.all([
        rescheduleGardenDiaryOperation({
            accountId: fixture.accountId,
            expectedEntityId: fixture.operationEntityId,
            expectedTaskVersionEventId: operation.taskVersionEventId,
            gardenId: fixture.gardenId,
            operationId: fixture.operationId,
            scheduledDate: '2026-07-20T08:00:00.000Z',
            referenceDate: new Date('2026-07-10T08:00:00.000Z'),
        }),
        rescheduleGardenDiaryRaisedBedField({
            accountId: fixture.accountId,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId:
                field.plantCycles.find((plantCycle) => plantCycle.active)
                    ?.endedEventId ?? plantingResult.eventId,
            expectedPlantSortId: fixture.plantSortId,
            gardenId: fixture.gardenId,
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            scheduledDate: '2026-07-20T08:00:00.000Z',
            referenceDate: new Date('2026-07-10T08:00:00.000Z'),
        }),
    ]);
    const rescheduledOperation = await getOperationById(fixture.operationId);
    assert.strictEqual(rescheduledOperation.status, 'planned');
    assert.strictEqual(rescheduledOperation.blockedAt, undefined);
    assert.strictEqual(rescheduledOperation.blockReasonCode, undefined);
    const [rescheduledField] = await getRaisedBedFieldsWithEvents(
        fixture.raisedBedId,
    );
    assert.strictEqual(rescheduledField?.plantStatus, 'planned');
    assert.strictEqual(rescheduledField?.blockedAt, undefined);
    assert.strictEqual(rescheduledField?.blockReasonCode, undefined);
});

test('blocker validation requires notes for open reasons and limits proof to five images', async () => {
    const fixture = await createTaskFixture();

    await assertSubmissionError(
        submitOperationTaskBlock({
            operationId: fixture.operationId,
            expectedEntityId: fixture.operationEntityId,
            expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
            reasonCode: 'other',
        }),
        'invalid_input',
    );
    await assertSubmissionError(
        submitPlantingTaskBlock({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
            expectedPlantSortId: fixture.plantSortId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
            reasonCode: 'task_not_applicable',
        }),
        'invalid_input',
    );
    await assertSubmissionError(
        submitOperationTaskBlock({
            operationId: fixture.operationId,
            expectedEntityId: fixture.operationEntityId,
            expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
            reasonCode: 'unsafe_conditions',
            imageUrls: Array.from(
                { length: 6 },
                (_, index) =>
                    `https://example.com/block-${index.toString()}.jpg`,
            ),
        }),
        'invalid_input',
    );

    const completion = await submitOperationTaskCompletion({
        operationId: fixture.operationId,
        expectedEntityId: fixture.operationEntityId,
        expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
        imageUrls: Array.from(
            { length: 6 },
            (_, index) =>
                `https://example.com/complete-${index.toString()}.jpg`,
        ),
    });
    assert.strictEqual(completion.status, 'pendingVerification');
    assert.strictEqual(
        (await getOperationById(fixture.operationId)).imageUrls?.length,
        6,
    );
});

test('farmer completion and blocker submissions require immutable task identities', async () => {
    const fixture = await createTaskFixture();

    await Promise.all([
        assertSubmissionError(
            submitOperationTaskCompletion({
                operationId: fixture.operationId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            'invalid_input',
        ),
        assertSubmissionError(
            submitOperationTaskBlock({
                operationId: fixture.operationId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
            'invalid_input',
        ),
        assertSubmissionError(
            submitPlantingTaskCompletion({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            'invalid_input',
        ),
        assertSubmissionError(
            submitPlantingTaskBlock({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
            'invalid_input',
        ),
    ]);
});

test('stale farmer operation identity rejects both completion and blocking', async () => {
    const fixture = await createTaskFixture();
    await switchOperationEntity(fixture.operationId, {
        entityId: fixture.operationEntityId + 1,
        entityTypeName: 'operation',
    });

    await Promise.all([
        assertSubmissionError(
            submitOperationTaskCompletion({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            'task_changed',
        ),
        assertSubmissionError(
            submitOperationTaskBlock({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
            'task_changed',
        ),
    ]);
});

test('operation entity A-B-A switch invalidates stale farmer task attempts', async () => {
    const fixture = await createTaskFixture();
    await switchOperationEntity(fixture.operationId, {
        entityId: fixture.operationEntityId + 1,
        entityTypeName: 'operation',
    });
    await switchOperationEntity(fixture.operationId, {
        entityId: fixture.operationEntityId,
        entityTypeName: 'operation',
    });

    const operation = await getOperationById(fixture.operationId);
    assert.strictEqual(operation.entityId, fixture.operationEntityId);
    assert.notStrictEqual(
        operation.taskVersionEventId,
        fixture.operationTaskVersionEventId,
    );
    await Promise.all([
        assertSubmissionError(
            submitOperationTaskCompletion({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            'task_changed',
        ),
        assertSubmissionError(
            submitOperationTaskBlock({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
            'task_changed',
        ),
    ]);

    const terminalEvents = await getAllEvents(
        [knownEventTypes.operations.complete, knownEventTypes.operations.block],
        [fixture.operationId.toString()],
    );
    assert.strictEqual(terminalEvents.length, 0);
});

test('operation accept-unaccept-accept cycle invalidates stale farmer task attempts', async () => {
    const fixture = await createTaskFixture();
    await unacceptOperation(fixture.operationId);
    await acceptOperation(fixture.operationId);

    const operation = await getOperationById(fixture.operationId);
    assert.strictEqual(operation.isAccepted, true);
    assert.notStrictEqual(
        operation.taskVersionEventId,
        fixture.operationTaskVersionEventId,
    );
    await Promise.all([
        assertSubmissionError(
            submitOperationTaskCompletion({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            'task_changed',
        ),
        assertSubmissionError(
            submitOperationTaskBlock({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
            'task_changed',
        ),
    ]);
});

test('stale farmer planting identity rejects sort replacement, delete, and replant ABA', async () => {
    const sortFixture = await createTaskFixture();
    await createEvent(
        knownEvents.raisedBedFields.plantReplaceSortV1(
            sortFixture.plantingAggregateId,
            { plantSortId: (sortFixture.plantSortId + 1).toString() },
        ),
    );

    await Promise.all([
        assertSubmissionError(
            submitPlantingTaskCompletion({
                raisedBedId: sortFixture.raisedBedId,
                positionIndex: sortFixture.positionIndex,
                expectedPlantCycleEventId: sortFixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    sortFixture.plantCycleVersionEventId,
                expectedPlantSortId: sortFixture.plantSortId,
                actor: { userId: sortFixture.farmerId, role: 'farmer' },
            }),
            'task_changed',
        ),
        assertSubmissionError(
            submitPlantingTaskBlock({
                raisedBedId: sortFixture.raisedBedId,
                positionIndex: sortFixture.positionIndex,
                expectedPlantCycleEventId: sortFixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    sortFixture.plantCycleVersionEventId,
                expectedPlantSortId: sortFixture.plantSortId,
                actor: { userId: sortFixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
            'task_changed',
        ),
    ]);

    const cycleFixture = await createTaskFixture();
    await createEvent(
        knownEvents.raisedBedFields.deletedV1(cycleFixture.plantingAggregateId),
    );
    await deleteRaisedBedField(
        cycleFixture.raisedBedId,
        cycleFixture.positionIndex,
    );
    await upsertRaisedBedField({
        raisedBedId: cycleFixture.raisedBedId,
        positionIndex: cycleFixture.positionIndex,
    });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            cycleFixture.plantingAggregateId,
            {
                plantSortId: cycleFixture.plantSortId.toString(),
                scheduledDate: '2026-07-16T08:00:00.000Z',
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            cycleFixture.plantingAggregateId,
            { status: 'planned' },
        ),
    );

    await Promise.all([
        assertSubmissionError(
            submitPlantingTaskCompletion({
                raisedBedId: cycleFixture.raisedBedId,
                positionIndex: cycleFixture.positionIndex,
                expectedPlantCycleEventId: cycleFixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    cycleFixture.plantCycleVersionEventId,
                expectedPlantSortId: cycleFixture.plantSortId,
                actor: { userId: cycleFixture.farmerId, role: 'farmer' },
            }),
            'task_changed',
        ),
        assertSubmissionError(
            submitPlantingTaskBlock({
                raisedBedId: cycleFixture.raisedBedId,
                positionIndex: cycleFixture.positionIndex,
                expectedPlantCycleEventId: cycleFixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    cycleFixture.plantCycleVersionEventId,
                expectedPlantSortId: cycleFixture.plantSortId,
                actor: { userId: cycleFixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
            'task_changed',
        ),
    ]);
});

test('planting reschedule invalidates stale farmer task attempts without changing cycle or sort', async () => {
    const fixture = await createTaskFixture();
    await createEvent(
        knownEvents.raisedBedFields.plantScheduleV1(
            fixture.plantingAggregateId,
            { scheduledDate: '2026-07-18T08:00:00.000Z' },
        ),
    );

    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    const activePlantCycle = field?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.strictEqual(
        activePlantCycle?.plantPlaceEventId,
        fixture.plantCycleEventId,
    );
    assert.strictEqual(field?.plantSortId, fixture.plantSortId);
    assert.notStrictEqual(
        activePlantCycle?.endedEventId,
        fixture.plantCycleVersionEventId,
    );
    await Promise.all([
        assertSubmissionError(
            submitPlantingTaskCompletion({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            'task_changed',
        ),
        assertSubmissionError(
            submitPlantingTaskBlock({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
            'task_changed',
        ),
    ]);
});

test('locked verification helpers are idempotent for operation and planting completion', async () => {
    const fixture = await createTaskFixture();
    await Promise.all([
        submitOperationTaskCompletion({
            operationId: fixture.operationId,
            expectedEntityId: fixture.operationEntityId,
            expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
        }),
        submitPlantingTaskCompletion({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
            expectedPlantSortId: fixture.plantSortId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
        }),
    ]);
    const [pendingOperation, pendingFields] = await Promise.all([
        getOperationById(fixture.operationId),
        getRaisedBedFieldsWithEvents(fixture.raisedBedId),
    ]);
    const pendingPlantCycle = pendingFields
        .find((field) => field.positionIndex === fixture.positionIndex)
        ?.plantCycles.find((plantCycle) => plantCycle.active);
    assert.ok(pendingPlantCycle);

    const [operationResults, plantingResults] = await Promise.all([
        Promise.all(
            Array.from({ length: 6 }, () =>
                verifyOperationTaskCompletion({
                    operationId: fixture.operationId,
                    expectedTaskVersionEventId:
                        pendingOperation.taskVersionEventId,
                    verifiedBy: fixture.adminId,
                }),
            ),
        ),
        Promise.all(
            Array.from({ length: 6 }, () =>
                verifyPlantingTaskCompletion({
                    raisedBedId: fixture.raisedBedId,
                    positionIndex: fixture.positionIndex,
                    expectedPlantCycleEventId: fixture.plantCycleEventId,
                    expectedPlantCycleVersionEventId:
                        pendingPlantCycle.endedEventId,
                    expectedPlantSortId: fixture.plantSortId,
                    verifiedBy: fixture.adminId,
                }),
            ),
        ),
    ]);

    assert.strictEqual(
        operationResults.filter((result) => result.created).length,
        1,
    );
    assert.strictEqual(
        new Set(operationResults.map((result) => result.eventId)).size,
        1,
    );
    assert.strictEqual(
        plantingResults.filter((result) => result.created).length,
        1,
    );
    assert.strictEqual(
        new Set(plantingResults.map((result) => result.eventId)).size,
        1,
    );
    assert.strictEqual(
        (await getOperationById(fixture.operationId)).status,
        'completed',
    );
    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.strictEqual(field?.plantStatus, 'sowed');
});

test('admin completion atomically verifies a new or pending task', async () => {
    const directFixture = await createTaskFixture();
    const directResult = await submitOperationTaskCompletion({
        operationId: directFixture.operationId,
        actor: { userId: directFixture.adminId, role: 'admin' },
    });
    assert.strictEqual(directResult.status, 'completed');
    assert.strictEqual(
        (
            await getAllEvents(knownEventTypes.operations.complete, [
                directFixture.operationId.toString(),
            ])
        ).length,
        1,
    );
    assert.strictEqual(
        (
            await getAllEvents(knownEventTypes.operations.verify, [
                directFixture.operationId.toString(),
            ])
        ).length,
        1,
    );

    const pendingFixture = await createTaskFixture();
    await Promise.all([
        submitOperationTaskCompletion({
            operationId: pendingFixture.operationId,
            expectedEntityId: pendingFixture.operationEntityId,
            expectedTaskVersionEventId:
                pendingFixture.operationTaskVersionEventId,
            actor: { userId: pendingFixture.farmerId, role: 'farmer' },
        }),
        submitPlantingTaskCompletion({
            raisedBedId: pendingFixture.raisedBedId,
            positionIndex: pendingFixture.positionIndex,
            expectedPlantCycleEventId: pendingFixture.plantCycleEventId,
            expectedPlantCycleVersionEventId:
                pendingFixture.plantCycleVersionEventId,
            expectedPlantSortId: pendingFixture.plantSortId,
            actor: { userId: pendingFixture.farmerId, role: 'farmer' },
        }),
    ]);
    const [pendingPlantingField] = await getRaisedBedFieldsWithEvents(
        pendingFixture.raisedBedId,
    );
    const pendingPlantingCycle = pendingPlantingField?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.ok(pendingPlantingCycle);
    const [operationResult, plantingResult] = await Promise.all([
        submitOperationTaskCompletion({
            operationId: pendingFixture.operationId,
            actor: { userId: pendingFixture.adminId, role: 'admin' },
        }),
        submitPlantingTaskCompletion({
            raisedBedId: pendingFixture.raisedBedId,
            positionIndex: pendingFixture.positionIndex,
            expectedPlantCycleEventId: pendingFixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: pendingPlantingCycle.endedEventId,
            expectedPlantSortId: pendingFixture.plantSortId,
            actor: { userId: pendingFixture.adminId, role: 'admin' },
        }),
    ]);
    assert.strictEqual(operationResult.status, 'completed');
    assert.strictEqual(plantingResult.status, 'sowed');
    assert.strictEqual(
        (await getOperationById(pendingFixture.operationId)).status,
        'completed',
    );
    const [pendingField] = await getRaisedBedFieldsWithEvents(
        pendingFixture.raisedBedId,
    );
    assert.strictEqual(pendingField?.plantStatus, 'sowed');
});

test('admin verification rejects stale completion evidence while farmer retries stay idempotent', async () => {
    const fixture = await createTaskFixture();
    const completion = await submitOperationTaskCompletion({
        operationId: fixture.operationId,
        expectedEntityId: fixture.operationEntityId,
        expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    const pendingOperation = await getOperationById(fixture.operationId);
    const renderedVersion = pendingOperation.taskVersionEventId;
    await createEvent(
        knownEvents.operations.completionEvidenceUpdatedV1(
            fixture.operationId.toString(),
            {
                updatedBy: fixture.adminId,
                images: ['https://example.com/revised-evidence.jpg'],
                notes: 'Revised evidence',
            },
        ),
    );

    await Promise.all([
        assertSubmissionError(
            submitOperationTaskCompletion({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: renderedVersion,
                actor: { userId: fixture.adminId, role: 'admin' },
            }),
            'task_changed',
        ),
        assertSubmissionError(
            verifyOperationTaskCompletion({
                operationId: fixture.operationId,
                expectedTaskVersionEventId: renderedVersion,
                verifiedBy: fixture.adminId,
            }),
            'task_changed',
        ),
    ]);
    const farmerRetry = await submitOperationTaskCompletion({
        operationId: fixture.operationId,
        expectedEntityId: fixture.operationEntityId,
        expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    assert.strictEqual(farmerRetry.created, false);
    assert.strictEqual(farmerRetry.eventId, completion.eventId);

    const revisedOperation = await getOperationById(fixture.operationId);
    const verified = await verifyOperationTaskCompletion({
        operationId: fixture.operationId,
        expectedTaskVersionEventId: revisedOperation.taskVersionEventId,
        verifiedBy: fixture.adminId,
    });
    assert.strictEqual(verified.status, 'completed');
});

test('planting verification rejects a stale pending version and keeps completed retries idempotent', async () => {
    const fixture = await createTaskFixture();
    await submitPlantingTaskCompletion({
        raisedBedId: fixture.raisedBedId,
        positionIndex: fixture.positionIndex,
        expectedPlantCycleEventId: fixture.plantCycleEventId,
        expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
        expectedPlantSortId: fixture.plantSortId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    const [pendingField] = await getRaisedBedFieldsWithEvents(
        fixture.raisedBedId,
    );
    const pendingPlantCycle = pendingField?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.ok(pendingPlantCycle);
    const renderedVersion = pendingPlantCycle.endedEventId;
    await createEvent(
        knownEvents.raisedBedFields.plantScheduleV1(
            fixture.plantingAggregateId,
            { scheduledDate: '2026-07-19T08:00:00.000Z' },
        ),
    );

    await Promise.all([
        assertSubmissionError(
            submitPlantingTaskCompletion({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId: renderedVersion,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.adminId, role: 'admin' },
            }),
            'task_changed',
        ),
        assertSubmissionError(
            verifyPlantingTaskCompletion({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId: renderedVersion,
                expectedPlantSortId: fixture.plantSortId,
                verifiedBy: fixture.adminId,
            }),
            'task_changed',
        ),
    ]);
    const [revisedField] = await getRaisedBedFieldsWithEvents(
        fixture.raisedBedId,
    );
    const revisedPlantCycle = revisedField?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.ok(revisedPlantCycle);
    const verified = await verifyPlantingTaskCompletion({
        raisedBedId: fixture.raisedBedId,
        positionIndex: fixture.positionIndex,
        expectedPlantCycleEventId: fixture.plantCycleEventId,
        expectedPlantCycleVersionEventId: revisedPlantCycle.endedEventId,
        expectedPlantSortId: fixture.plantSortId,
        verifiedBy: fixture.adminId,
    });
    assert.strictEqual(verified.created, true);
    const completedRetry = await verifyPlantingTaskCompletion({
        raisedBedId: fixture.raisedBedId,
        positionIndex: fixture.positionIndex,
        expectedPlantCycleEventId: fixture.plantCycleEventId,
        expectedPlantCycleVersionEventId: renderedVersion,
        expectedPlantSortId: fixture.plantSortId,
        verifiedBy: fixture.adminId,
    });
    assert.strictEqual(completedRetry.created, false);
    assert.strictEqual(completedRetry.eventId, verified.eventId);
});

test('planting date revisions advance the version before a stale verification can commit', async () => {
    const fixture = await createTaskFixture();
    await submitPlantingTaskCompletion({
        raisedBedId: fixture.raisedBedId,
        positionIndex: fixture.positionIndex,
        expectedPlantCycleEventId: fixture.plantCycleEventId,
        expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
        expectedPlantSortId: fixture.plantSortId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    const [pendingField] = await getRaisedBedFieldsWithEvents(
        fixture.raisedBedId,
    );
    const pendingPlantCycle = pendingField?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.ok(pendingPlantCycle);
    const renderedVersion = pendingPlantCycle.endedEventId;
    const revisedEffectiveDate = '2026-07-14T12:00:00.000Z';
    let verificationPromise:
        | ReturnType<typeof verifyPlantingTaskCompletion>
        | undefined;

    await withPlantingScheduleTaskTransaction(
        fixture.raisedBedId,
        fixture.positionIndex,
        async (transaction) => {
            await createEvent(
                knownEvents.raisedBedFields.plantUpdateV1(
                    fixture.plantingAggregateId,
                    {
                        status: 'pendingVerification',
                        effectiveDate: revisedEffectiveDate,
                    },
                ),
                transaction,
            );
            verificationPromise = verifyPlantingTaskCompletion({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId: renderedVersion,
                expectedPlantSortId: fixture.plantSortId,
                verifiedBy: fixture.adminId,
            });
            await waitForAdvisoryLockWaiter();
        },
    );

    assert.ok(verificationPromise);
    await assertSubmissionError(verificationPromise, 'task_changed');
    const [revisedField] = await getRaisedBedFieldsWithEvents(
        fixture.raisedBedId,
    );
    const revisedPlantCycle = revisedField?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.ok(revisedPlantCycle);
    assert.notStrictEqual(revisedPlantCycle.endedEventId, renderedVersion);
    assert.strictEqual(
        revisedField?.plantStatusChangedAt?.toISOString(),
        revisedEffectiveDate,
    );

    const verified = await verifyPlantingTaskCompletion({
        raisedBedId: fixture.raisedBedId,
        positionIndex: fixture.positionIndex,
        expectedPlantCycleEventId: fixture.plantCycleEventId,
        expectedPlantCycleVersionEventId: revisedPlantCycle.endedEventId,
        expectedPlantSortId: fixture.plantSortId,
        verifiedBy: fixture.adminId,
    });
    assert.strictEqual(verified.created, true);
});

test('a backdated planting status change stays append-only and advances the cycle version', async () => {
    const fixture = await createTaskFixture();
    const effectiveDate = '2026-07-13T12:00:00.000Z';
    const revision = await withPlantingScheduleTaskTransaction(
        fixture.raisedBedId,
        fixture.positionIndex,
        async (transaction) =>
            createEvent(
                knownEvents.raisedBedFields.plantUpdateV1(
                    fixture.plantingAggregateId,
                    {
                        status: 'sowed',
                        effectiveDate,
                    },
                ),
                transaction,
            ),
    );

    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    const activePlantCycle = field?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.ok(activePlantCycle);
    assert.strictEqual(field?.plantStatus, 'sowed');
    assert.strictEqual(field.plantStatusEventId, revision.id);
    assert.strictEqual(
        field.plantStatusChangedAt?.toISOString(),
        effectiveDate,
    );
    assert.strictEqual(activePlantCycle.endedEventId, revision.id);
    assert.ok(revision.createdAt > new Date(effectiveDate));
});

test('completion and blocking races persist exactly one terminal outcome', async () => {
    const fixture = await createTaskFixture();
    const [operationRace, plantingRace] = await Promise.all([
        Promise.allSettled([
            submitOperationTaskCompletion({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            submitOperationTaskBlock({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
        ]),
        Promise.allSettled([
            submitPlantingTaskCompletion({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            submitPlantingTaskBlock({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
                reasonCode: 'unsafe_conditions',
            }),
        ]),
    ]);

    for (const race of [operationRace, plantingRace]) {
        assert.strictEqual(
            race.filter((result) => result.status === 'fulfilled').length,
            1,
        );
        const [rejection] = race.filter(
            (result) => result.status === 'rejected',
        );
        assert.ok(rejection && rejection.status === 'rejected');
        assert.ok(rejection.reason instanceof ScheduleTaskSubmissionError);
        assert.strictEqual(rejection.reason.code, 'invalid_status');
    }

    const operationTerminalEvents = await Promise.all([
        getAllEvents(knownEventTypes.operations.complete, [
            fixture.operationId.toString(),
        ]),
        getAllEvents(knownEventTypes.operations.block, [
            fixture.operationId.toString(),
        ]),
    ]);
    assert.strictEqual(operationTerminalEvents.flat().length, 1);
    const plantingEvents = await getAllEvents(
        [
            knownEventTypes.raisedBedFields.plantUpdate,
            knownEventTypes.raisedBedFields.plantBlock,
        ],
        [fixture.plantingAggregateId],
    );
    assert.strictEqual(
        plantingEvents.filter(
            (event) =>
                event.type === knownEventTypes.raisedBedFields.plantBlock ||
                (event.type === knownEventTypes.raisedBedFields.plantUpdate &&
                    (event.data as Record<string, unknown> | null)?.status ===
                        'pendingVerification'),
        ).length,
        1,
    );
});

test('historical planting completion remains idempotent after an illicit status rewind', async () => {
    const fixture = await createTaskFixture();
    const first = await submitPlantingTaskCompletion({
        raisedBedId: fixture.raisedBedId,
        positionIndex: fixture.positionIndex,
        expectedPlantCycleEventId: fixture.plantCycleEventId,
        expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
        expectedPlantSortId: fixture.plantSortId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(fixture.plantingAggregateId, {
            status: 'planned',
        }),
    );

    await assertSubmissionError(
        submitPlantingTaskCompletion({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: first.eventId,
            expectedPlantSortId: fixture.plantSortId,
            actor: { userId: fixture.adminId, role: 'admin' },
        }),
        'task_changed',
    );
    const duplicate = await submitPlantingTaskCompletion({
        raisedBedId: fixture.raisedBedId,
        positionIndex: fixture.positionIndex,
        expectedPlantCycleEventId: fixture.plantCycleEventId,
        expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
        expectedPlantSortId: fixture.plantSortId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    assert.strictEqual(duplicate.created, false);
    assert.strictEqual(duplicate.eventId, first.eventId);
    await assertSubmissionError(
        submitPlantingTaskBlock({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
            expectedPlantSortId: fixture.plantSortId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
            reasonCode: 'unsafe_conditions',
        }),
        'invalid_status',
    );

    const completionEvents = await getAllEvents(
        knownEventTypes.raisedBedFields.plantUpdate,
        [fixture.plantingAggregateId],
    );
    assert.strictEqual(
        completionEvents.filter(
            (event) =>
                (event.data as Record<string, unknown> | null)?.status ===
                'pendingVerification',
        ).length,
        1,
    );
});

test('completion commits before competing diary reschedule and cancel writers revalidate', async () => {
    const fixture = await createTaskFixture();
    const referenceDate = new Date('2026-07-10T08:00:00.000Z');
    let competingWriters: Promise<unknown>[] = [];

    await storage().transaction(async (transaction) => {
        await submitOperationTaskCompletion(
            {
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            },
            transaction,
        );
        await submitPlantingTaskCompletion(
            {
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            },
            transaction,
        );

        competingWriters = [
            rescheduleGardenDiaryOperation({
                accountId: fixture.accountId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                gardenId: fixture.gardenId,
                operationId: fixture.operationId,
                scheduledDate: '2026-07-20T08:00:00.000Z',
                referenceDate,
            }),
            cancelGardenDiaryOperation({
                accountId: fixture.accountId,
                canceledBy: fixture.farmerId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                gardenId: fixture.gardenId,
                operationId: fixture.operationId,
                referenceDate,
            }),
            rescheduleGardenDiaryRaisedBedField({
                accountId: fixture.accountId,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                gardenId: fixture.gardenId,
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                scheduledDate: '2026-07-20T08:00:00.000Z',
                referenceDate,
            }),
            cancelGardenDiaryRaisedBedField({
                accountId: fixture.accountId,
                canceledBy: fixture.farmerId,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                gardenId: fixture.gardenId,
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                referenceDate,
            }),
        ];
        await waitForAdvisoryLockWaiter(4);
    });

    const writerResults = await Promise.allSettled(competingWriters);
    assert.strictEqual(
        writerResults.every((result) => result.status === 'rejected'),
        true,
    );
    for (const result of writerResults) {
        assert.strictEqual(result.status, 'rejected');
        if (result.status !== 'rejected') {
            continue;
        }
        assert.ok(
            result.reason instanceof GardenDiaryRescheduleError ||
                result.reason instanceof GardenDiaryCancelError,
        );
        assert.strictEqual(result.reason.statusCode, 409);
    }

    assert.strictEqual(
        (
            await getAllEvents(knownEventTypes.operations.cancel, [
                fixture.operationId.toString(),
            ])
        ).length,
        0,
    );
    assert.strictEqual(
        (
            await getAllEvents(knownEventTypes.operations.schedule, [
                fixture.operationId.toString(),
            ])
        ).length,
        1,
    );
    assert.strictEqual(
        (
            await getAllEvents(knownEventTypes.raisedBedFields.delete, [
                fixture.plantingAggregateId,
            ])
        ).length,
        0,
    );
    assert.strictEqual(
        (
            await getAllEvents(knownEventTypes.raisedBedFields.plantSchedule, [
                fixture.plantingAggregateId,
            ])
        ).length,
        0,
    );
});

test('verification commits before a competing completion-evidence writer revalidates', async () => {
    const fixture = await createTaskFixture();
    await submitOperationTaskCompletion({
        operationId: fixture.operationId,
        expectedEntityId: fixture.operationEntityId,
        expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    const pendingOperation = await getOperationById(fixture.operationId);
    let evidencePromise: Promise<unknown> | undefined;

    await storage().transaction(async (transaction) => {
        await verifyOperationTaskCompletion(
            {
                operationId: fixture.operationId,
                expectedTaskVersionEventId: pendingOperation.taskVersionEventId,
                verifiedBy: fixture.adminId,
            },
            transaction,
        );
        evidencePromise = withOperationScheduleTaskTransaction(
            fixture.operationId,
            (evidenceTransaction) =>
                updateOperationCompletionEvidence(
                    {
                        operationId: fixture.operationId,
                        expectedTaskVersionEventId:
                            pendingOperation.taskVersionEventId,
                        updatedBy: fixture.adminId,
                        imageUrls: ['https://example.com/late-evidence.jpg'],
                        notes: 'Late evidence',
                    },
                    evidenceTransaction,
                ),
        );
        await waitForAdvisoryLockWaiter();
    });

    assert.ok(evidencePromise);
    await assertSubmissionError(evidencePromise, 'invalid_status');
    assert.strictEqual(
        (
            await getAllEvents(
                knownEventTypes.operations.completionEvidenceUpdate,
                [fixture.operationId.toString()],
            )
        ).length,
        0,
    );
    assert.strictEqual(
        (await getOperationById(fixture.operationId)).status,
        'completed',
    );
});

test('concurrent completion-evidence edits accept one rendered version and reject the stale writer', async () => {
    const fixture = await createTaskFixture();
    await submitOperationTaskCompletion({
        operationId: fixture.operationId,
        expectedEntityId: fixture.operationEntityId,
        expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
        imageUrls: ['https://example.com/original.jpg'],
        notes: 'Original evidence',
    });
    const pendingOperation = await getOperationById(fixture.operationId);
    const edits = [
        {
            imageUrls: ['https://example.com/first-edit.jpg'],
            notes: 'First edit',
        },
        {
            imageUrls: ['https://example.com/second-edit.jpg'],
            notes: 'Second edit',
        },
    ];

    const results = await Promise.allSettled(
        edits.map((edit) =>
            updateOperationCompletionEvidence({
                operationId: fixture.operationId,
                expectedTaskVersionEventId: pendingOperation.taskVersionEventId,
                updatedBy: fixture.adminId,
                ...edit,
            }),
        ),
    );
    assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    const rejected = results.find((result) => result.status === 'rejected');
    assert.ok(rejected?.reason instanceof ScheduleTaskSubmissionError);
    assert.equal(rejected.reason.code, 'task_changed');

    const winningIndex = results.findIndex(
        (result) => result.status === 'fulfilled',
    );
    const winningEdit = edits[winningIndex];
    assert.ok(winningEdit);
    const exactRetry = await updateOperationCompletionEvidence({
        operationId: fixture.operationId,
        expectedTaskVersionEventId: pendingOperation.taskVersionEventId,
        updatedBy: fixture.adminId,
        ...winningEdit,
    });
    assert.equal(exactRetry.created, false);

    const evidenceEvents = await getAllEvents(
        knownEventTypes.operations.completionEvidenceUpdate,
        [fixture.operationId.toString()],
    );
    assert.equal(evidenceEvents.length, 1);
    const operation = await getOperationById(fixture.operationId);
    assert.deepEqual(operation.imageUrls, winningEdit.imageUrls);
    assert.equal(operation.completionNotes, winningEdit.notes);
});

test('planting completion rejects a farmer whose current farm membership was removed', async () => {
    const fixture = await createTaskFixture();
    await storage()
        .delete(farmUsers)
        .where(
            and(
                eq(farmUsers.farmId, fixture.farmId),
                eq(farmUsers.userId, fixture.farmerId),
            ),
        );

    await assertSubmissionError(
        submitPlantingTaskCompletion({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
            expectedPlantSortId: fixture.plantSortId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
        }),
        'not_authorized',
    );
});

test('abandoning a raised bed first rejects operation and planting submissions', async () => {
    const fixture = await createTaskFixture();
    await storage()
        .update(raisedBeds)
        .set({ status: 'abandoned' })
        .where(eq(raisedBeds.id, fixture.raisedBedId));

    await Promise.all([
        assertSubmissionError(
            submitOperationTaskCompletion({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            'invalid_status',
        ),
        assertSubmissionError(
            submitPlantingTaskCompletion({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
            'invalid_status',
        ),
    ]);

    const terminalEvents = await getAllEvents(
        [
            knownEventTypes.operations.complete,
            knownEventTypes.raisedBedFields.plantUpdate,
        ],
        [fixture.operationId.toString(), fixture.plantingAggregateId],
    );
    assert.strictEqual(
        terminalEvents.some(
            (event) =>
                event.type === knownEventTypes.operations.complete ||
                (event.aggregateId === fixture.plantingAggregateId &&
                    (event.data as Record<string, unknown> | null)?.status ===
                        'pendingVerification'),
        ),
        false,
    );
});

test('task completion commits before a competing raised-bed abandonment', async () => {
    const fixture = await createTaskFixture();
    let abandonmentPromise: Promise<unknown> | undefined;

    await storage().transaction(async (transaction) => {
        await submitOperationTaskCompletion(
            {
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            },
            transaction,
        );
        await submitPlantingTaskCompletion(
            {
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            },
            transaction,
        );

        abandonmentPromise = Promise.resolve(
            storage()
                .update(raisedBeds)
                .set({ status: 'abandoned' })
                .where(eq(raisedBeds.id, fixture.raisedBedId)),
        );
        await waitForTransactionLockWaiter();
    });

    assert.ok(abandonmentPromise);
    await abandonmentPromise;
    assert.strictEqual(
        (await getOperationById(fixture.operationId)).status,
        'pendingVerification',
    );
    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.strictEqual(field?.plantStatus, 'pendingVerification');
    const [raisedBed] = await storage()
        .select({ status: raisedBeds.status })
        .from(raisedBeds)
        .where(eq(raisedBeds.id, fixture.raisedBedId));
    assert.strictEqual(raisedBed?.status, 'abandoned');
});

test('operation completion revalidates actor membership after a concurrent removal commits', async () => {
    const fixture = await createTaskFixture();
    let completionPromise:
        | ReturnType<typeof submitOperationTaskCompletion>
        | undefined;

    await storage().transaction(async (transaction) => {
        await transaction
            .delete(farmUsers)
            .where(
                and(
                    eq(farmUsers.farmId, fixture.farmId),
                    eq(farmUsers.userId, fixture.farmerId),
                ),
            );
        completionPromise = submitOperationTaskCompletion({
            operationId: fixture.operationId,
            expectedEntityId: fixture.operationEntityId,
            expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
        });
        await waitForTransactionLockWaiter();
    });

    assert.ok(completionPromise);
    await assertSubmissionError(completionPromise, 'not_authorized');
    assert.strictEqual(
        (
            await getAllEvents(knownEventTypes.operations.complete, [
                fixture.operationId.toString(),
            ])
        ).length,
        0,
    );
});

test('operation and planting assignment revalidate every selected membership after removal', async () => {
    const fixture = await createTaskFixture();
    let operationAssignmentPromise:
        | ReturnType<typeof assignOperationTaskUsers>
        | undefined;
    let plantingAssignmentPromise:
        | ReturnType<typeof assignPlantingTaskUsers>
        | undefined;

    await storage().transaction(async (transaction) => {
        await transaction
            .delete(farmUsers)
            .where(
                and(
                    eq(farmUsers.farmId, fixture.farmId),
                    eq(farmUsers.userId, fixture.otherFarmerId),
                ),
            );
        operationAssignmentPromise = assignOperationTaskUsers({
            operationId: fixture.operationId,
            expectedEntityId: fixture.operationEntityId,
            expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
            assignedUserIds: [fixture.farmerId, fixture.otherFarmerId],
            assignedBy: fixture.adminId,
        });
        plantingAssignmentPromise = assignPlantingTaskUsers({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
            expectedPlantSortId: fixture.plantSortId,
            assignedUserIds: [fixture.farmerId, fixture.otherFarmerId],
            assignedBy: fixture.adminId,
        });
        await waitForTransactionLockWaiter(2);
    });

    assert.ok(operationAssignmentPromise);
    assert.ok(plantingAssignmentPromise);
    await Promise.all([
        assertSubmissionError(operationAssignmentPromise, 'not_authorized'),
        assertSubmissionError(plantingAssignmentPromise, 'not_authorized'),
    ]);
    assert.deepStrictEqual(
        (await getOperationById(fixture.operationId)).assignedUserIds,
        [fixture.farmerId],
    );
    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.deepStrictEqual(field?.assignedUserIds, [fixture.farmerId]);
});

test('operation and planting assignment reject stale task-attempt versions', async () => {
    const fixture = await createTaskFixture();
    await Promise.all([
        createEvent(
            knownEvents.operations.scheduledV1(fixture.operationId.toString(), {
                scheduledDate: '2026-07-18T08:00:00.000Z',
            }),
        ),
        createEvent(
            knownEvents.raisedBedFields.plantScheduleV1(
                fixture.plantingAggregateId,
                { scheduledDate: '2026-07-18T08:00:00.000Z' },
            ),
        ),
    ]);

    await Promise.all([
        assertSubmissionError(
            assignOperationTaskUsers({
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                assignedUserIds: [fixture.otherFarmerId],
                assignedBy: fixture.adminId,
            }),
            'task_changed',
        ),
        assertSubmissionError(
            assignPlantingTaskUsers({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                assignedUserIds: [fixture.otherFarmerId],
                assignedBy: fixture.adminId,
            }),
            'task_changed',
        ),
    ]);

    assert.deepStrictEqual(
        (await getOperationById(fixture.operationId)).assignedUserIds,
        [fixture.farmerId],
    );
    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.deepStrictEqual(field?.assignedUserIds, [fixture.farmerId]);
});

test('concurrent planting completion is idempotent and never copies assignment metadata', async () => {
    const fixture = await createTaskFixture();
    const definition = await createAutomationDefinition({
        key: `test.planting-completion-${randomUUID()}`,
        name: 'Planting completion concurrency',
        status: 'enabled',
        graph: eventAutomationGraph(
            knownEventTypes.raisedBedFields.plantUpdate,
        ),
    });

    const results = await Promise.all(
        Array.from({ length: 8 }, () =>
            submitPlantingTaskCompletion({
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
        ),
    );

    assert.strictEqual(results.filter((result) => result.created).length, 1);
    assert.strictEqual(
        new Set(results.map((result) => result.eventId)).size,
        1,
    );
    const updateEvents = await getAllEvents(
        knownEventTypes.raisedBedFields.plantUpdate,
        [fixture.plantingAggregateId],
    );
    const completionEvents = updateEvents.filter((event) => {
        const data = event.data as Record<string, unknown> | null;
        return data?.status === 'pendingVerification';
    });
    assert.strictEqual(completionEvents.length, 1);
    const completionData = completionEvents[0]?.data as Record<string, unknown>;
    assert.strictEqual('assignedUserId' in completionData, false);
    assert.strictEqual('assignedUserIds' in completionData, false);
    assert.strictEqual('assignedBy' in completionData, false);

    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.deepStrictEqual(field?.assignedUserIds, [fixture.farmerId]);
    assert.strictEqual(
        (
            await listAutomationRuns({
                automationDefinitionId: definition.id,
                limit: 20,
            })
        ).length,
        1,
    );
});

test('operation reassignment wins the shared lock before former-assignee completion', async () => {
    const fixture = await createTaskFixture();
    let completionPromise:
        | ReturnType<typeof submitOperationTaskCompletion>
        | undefined;

    await storage().transaction(async (transaction) => {
        await assignOperationTaskUsers(
            {
                operationId: fixture.operationId,
                expectedEntityId: fixture.operationEntityId,
                expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
                assignedUserIds: [fixture.otherFarmerId],
                assignedBy: fixture.adminId,
            },
            transaction,
        );
        completionPromise = submitOperationTaskCompletion({
            operationId: fixture.operationId,
            expectedEntityId: fixture.operationEntityId,
            expectedTaskVersionEventId: fixture.operationTaskVersionEventId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
        });
        await waitForAdvisoryLockWaiter();
    });

    assert.ok(completionPromise);
    await assert.rejects(completionPromise, (error: unknown) => {
        assert.ok(error instanceof ScheduleTaskSubmissionError);
        assert.strictEqual(error.code, 'task_changed');
        return true;
    });
    assert.deepStrictEqual(
        (await getOperationById(fixture.operationId)).assignedUserIds,
        [fixture.otherFarmerId],
    );
    assert.strictEqual(
        (
            await getAllEvents(knownEventTypes.operations.complete, [
                fixture.operationId.toString(),
            ])
        ).length,
        0,
    );
});

test('planting reassignment wins the shared lock without stale completion assignment', async () => {
    const fixture = await createTaskFixture();
    let completionPromise:
        | ReturnType<typeof submitPlantingTaskCompletion>
        | undefined;

    await storage().transaction(async (transaction) => {
        await assignPlantingTaskUsers(
            {
                raisedBedId: fixture.raisedBedId,
                positionIndex: fixture.positionIndex,
                expectedPlantCycleEventId: fixture.plantCycleEventId,
                expectedPlantCycleVersionEventId:
                    fixture.plantCycleVersionEventId,
                expectedPlantSortId: fixture.plantSortId,
                assignedUserIds: [fixture.otherFarmerId],
                assignedBy: fixture.adminId,
            },
            transaction,
        );
        completionPromise = submitPlantingTaskCompletion({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
            expectedPlantSortId: fixture.plantSortId,
            actor: { userId: fixture.farmerId, role: 'farmer' },
        });
        await waitForAdvisoryLockWaiter();
    });

    assert.ok(completionPromise);
    await assert.rejects(completionPromise, (error: unknown) => {
        assert.ok(error instanceof ScheduleTaskSubmissionError);
        assert.strictEqual(error.code, 'task_changed');
        return true;
    });
    const [field] = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    assert.deepStrictEqual(field?.assignedUserIds, [fixture.otherFarmerId]);
    const updateEvents = await getAllEvents(
        knownEventTypes.raisedBedFields.plantUpdate,
        [fixture.plantingAggregateId],
    );
    assert.strictEqual(
        updateEvents.some((event) => {
            const data = event.data as Record<string, unknown> | null;
            return data?.status === 'pendingVerification';
        }),
        false,
    );
});

test('planting completion and block commit before a competing history move', async () => {
    for (const outcome of ['completed', 'blocked'] as const) {
        const fixture = await createTaskFixture();
        const targetPositionIndex = fixture.positionIndex + 1;
        let movePromise:
            | ReturnType<typeof moveRaisedBedFieldPlantHistory>
            | undefined;

        await storage().transaction(async (transaction) => {
            if (outcome === 'completed') {
                await submitPlantingTaskCompletion(
                    {
                        raisedBedId: fixture.raisedBedId,
                        positionIndex: fixture.positionIndex,
                        expectedPlantCycleEventId: fixture.plantCycleEventId,
                        expectedPlantCycleVersionEventId:
                            fixture.plantCycleVersionEventId,
                        expectedPlantSortId: fixture.plantSortId,
                        actor: {
                            userId: fixture.farmerId,
                            role: 'farmer',
                        },
                    },
                    transaction,
                );
            } else {
                await submitPlantingTaskBlock(
                    {
                        raisedBedId: fixture.raisedBedId,
                        positionIndex: fixture.positionIndex,
                        expectedPlantCycleEventId: fixture.plantCycleEventId,
                        expectedPlantCycleVersionEventId:
                            fixture.plantCycleVersionEventId,
                        expectedPlantSortId: fixture.plantSortId,
                        actor: {
                            userId: fixture.farmerId,
                            role: 'farmer',
                        },
                        reasonCode: 'unsafe_conditions',
                    },
                    transaction,
                );
            }

            movePromise = moveRaisedBedFieldPlantHistory({
                raisedBedId: fixture.raisedBedId,
                sourcePositionIndex: fixture.positionIndex,
                targetPositionIndex,
                sourcePlantPlaceEventId: fixture.plantCycleEventId,
            });
            await waitForAdvisoryLockWaiter();
        });

        assert.ok(movePromise);
        await movePromise;
        const terminalEvents = await getAllEvents(
            [
                knownEventTypes.raisedBedFields.plantUpdate,
                knownEventTypes.raisedBedFields.plantBlock,
            ],
            [
                fixture.plantingAggregateId,
                `${fixture.raisedBedId.toString()}|${targetPositionIndex.toString()}`,
            ],
        );
        const matchingTerminalEvents = terminalEvents.filter((event) =>
            outcome === 'blocked'
                ? event.type === knownEventTypes.raisedBedFields.plantBlock
                : event.type === knownEventTypes.raisedBedFields.plantUpdate &&
                  (event.data as Record<string, unknown> | null)?.status ===
                      'pendingVerification',
        );
        assert.strictEqual(matchingTerminalEvents.length, 1);
        assert.strictEqual(
            matchingTerminalEvents[0]?.aggregateId,
            `${fixture.raisedBedId.toString()}|${targetPositionIndex.toString()}`,
        );
    }
});

test('history move commits before stale planting completion and block attempts', async () => {
    for (const outcome of ['completed', 'blocked'] as const) {
        const fixture = await createTaskFixture();
        const targetPositionIndex = fixture.positionIndex + 1;
        let submissionPromise:
            | ReturnType<typeof submitPlantingTaskCompletion>
            | ReturnType<typeof submitPlantingTaskBlock>
            | undefined;

        await storage().transaction(async (transaction) => {
            await moveRaisedBedFieldPlantHistory(
                {
                    raisedBedId: fixture.raisedBedId,
                    sourcePositionIndex: fixture.positionIndex,
                    targetPositionIndex,
                    sourcePlantPlaceEventId: fixture.plantCycleEventId,
                },
                transaction,
            );
            submissionPromise =
                outcome === 'completed'
                    ? submitPlantingTaskCompletion({
                          raisedBedId: fixture.raisedBedId,
                          positionIndex: fixture.positionIndex,
                          expectedPlantCycleEventId: fixture.plantCycleEventId,
                          expectedPlantCycleVersionEventId:
                              fixture.plantCycleVersionEventId,
                          expectedPlantSortId: fixture.plantSortId,
                          actor: {
                              userId: fixture.farmerId,
                              role: 'farmer',
                          },
                      })
                    : submitPlantingTaskBlock({
                          raisedBedId: fixture.raisedBedId,
                          positionIndex: fixture.positionIndex,
                          expectedPlantCycleEventId: fixture.plantCycleEventId,
                          expectedPlantCycleVersionEventId:
                              fixture.plantCycleVersionEventId,
                          expectedPlantSortId: fixture.plantSortId,
                          actor: {
                              userId: fixture.farmerId,
                              role: 'farmer',
                          },
                          reasonCode: 'unsafe_conditions',
                      });
            await waitForAdvisoryLockWaiter();
        });

        assert.ok(submissionPromise);
        await assertSubmissionError(submissionPromise, 'not_found');
        const targetAggregateId = `${fixture.raisedBedId.toString()}|${targetPositionIndex.toString()}`;
        const terminalEvents = await getAllEvents(
            [
                knownEventTypes.raisedBedFields.plantUpdate,
                knownEventTypes.raisedBedFields.plantBlock,
            ],
            [fixture.plantingAggregateId, targetAggregateId],
        );
        assert.strictEqual(
            terminalEvents.some(
                (event) =>
                    event.type === knownEventTypes.raisedBedFields.plantBlock ||
                    (event.type ===
                        knownEventTypes.raisedBedFields.plantUpdate &&
                        (event.data as Record<string, unknown> | null)
                            ?.status === 'pendingVerification'),
            ),
            false,
        );
    }
});

test('history move commits before stale planting verification', async () => {
    const fixture = await createTaskFixture();
    const targetPositionIndex = fixture.positionIndex + 1;
    await submitPlantingTaskCompletion({
        raisedBedId: fixture.raisedBedId,
        positionIndex: fixture.positionIndex,
        expectedPlantCycleEventId: fixture.plantCycleEventId,
        expectedPlantCycleVersionEventId: fixture.plantCycleVersionEventId,
        expectedPlantSortId: fixture.plantSortId,
        actor: { userId: fixture.farmerId, role: 'farmer' },
    });
    const [pendingField] = await getRaisedBedFieldsWithEvents(
        fixture.raisedBedId,
    );
    const pendingPlantCycle = pendingField?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.ok(pendingPlantCycle);
    let verificationPromise:
        | ReturnType<typeof verifyPlantingTaskCompletion>
        | undefined;

    await storage().transaction(async (transaction) => {
        await moveRaisedBedFieldPlantHistory(
            {
                raisedBedId: fixture.raisedBedId,
                sourcePositionIndex: fixture.positionIndex,
                targetPositionIndex,
                sourcePlantPlaceEventId: fixture.plantCycleEventId,
            },
            transaction,
        );
        verificationPromise = verifyPlantingTaskCompletion({
            raisedBedId: fixture.raisedBedId,
            positionIndex: fixture.positionIndex,
            expectedPlantCycleEventId: fixture.plantCycleEventId,
            expectedPlantCycleVersionEventId: pendingPlantCycle.endedEventId,
            expectedPlantSortId: fixture.plantSortId,
            verifiedBy: fixture.adminId,
        });
        await waitForAdvisoryLockWaiter();
    });

    assert.ok(verificationPromise);
    await assertSubmissionError(verificationPromise, 'not_found');
    const fields = await getRaisedBedFieldsWithEvents(fixture.raisedBedId);
    const targetField = fields.find(
        (field) => field.positionIndex === targetPositionIndex,
    );
    assert.strictEqual(targetField?.plantStatus, 'pendingVerification');
});
