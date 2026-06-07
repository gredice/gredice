import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type AutomationGraph,
    acceptOperation,
    automationEventCursors,
    automationModuleKeys,
    claimDueAutomationRuns,
    completeAutomationRun,
    createAccount,
    createAutomationDefinition,
    createAutomationRun,
    createEvent,
    createFarm,
    createOperation,
    enqueueAutomationRunsFromDomainEvents,
    enqueueAutomationRunsFromSchedules,
    ensureDefaultAutomationDefinitions,
    executeAutomationRun,
    FREE_WATERING_OPERATION_ID,
    getAutomationEventCursor,
    getAutomationRunWithSteps,
    getEvents,
    getFarmAcceptedOperationsByScheduleRange,
    getFarms,
    getOperations,
    getRaisedBed,
    knownEvents,
    knownEventTypes,
    listAutomationDefinitions,
    listAutomationRuns,
    listEnabledAutomationDefinitionsForEventType,
    operationImagePlantStatusReviewAutomationGraph,
    processDueAutomationRuns,
    recordAutomationRunStep,
    seasonalSowedWateringAutomationGraph,
    seedlingTransplantDirectSowingLocationAutomationGraph,
    startAutomationRun,
    storage,
    updateAutomationDefinition,
    upsertRaisedBedField,
    validateAutomationGraph,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createAutomationRaisedBedContext() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Automation Garden ${accountId}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `automation-block-${accountId}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    return {
        accountId,
        gardenId,
        raisedBedId,
    };
}

async function getLatestEvent(type: string, aggregateId: string) {
    const events = await getEvents(type, [aggregateId], 0, 100);
    const event = events.at(-1);
    assert.ok(event, `Expected event ${type} for ${aggregateId}`);
    return event;
}

async function getScheduledFreeWateringDates(
    accountId: string,
    gardenId: number,
    raisedBedId: number,
) {
    const operations = await getOperations(accountId, gardenId, raisedBedId);

    return operations
        .filter(
            (operation) =>
                operation.entityId === FREE_WATERING_OPERATION_ID &&
                operation.scheduledDate,
        )
        .map((operation) => operation.scheduledDate?.toISOString())
        .sort();
}

function raisedBedAiAnalysisImagePlantStatusReviewAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerDomainEvent,
                position: { x: 0, y: 160 },
                config: {
                    eventType: knownEventTypes.raisedBeds.aiAnalysis,
                },
            },
            {
                id: 'review-plant-statuses',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionCreatePlantStatusRequestsFromImageAnalysis,
                position: { x: 620, y: 160 },
                config: {
                    minConfidence: 0.9,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-action',
                source: 'trigger',
                target: 'review-plant-statuses',
            },
        ],
    };
}

function addUtcDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}

test('automation definitions persist graph trigger metadata and event-run idempotency', async () => {
    createTestDb();
    const graph = seasonalSowedWateringAutomationGraph();
    const definition = await createAutomationDefinition({
        key: 'test.persisted-automation',
        name: 'Persisted automation',
        status: 'enabled',
        graph,
    });

    assert.strictEqual(
        definition.triggerEventType,
        knownEventTypes.raisedBedFields.plantUpdate,
    );
    assert.strictEqual(definition.triggerModuleKey, 'trigger.domainEvent');

    const enabledDefinitions =
        await listEnabledAutomationDefinitionsForEventType(
            knownEventTypes.raisedBedFields.plantUpdate,
        );
    assert.ok(
        enabledDefinitions.some((candidate) => candidate.id === definition.id),
    );

    const aggregateId = '99999|0';
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sowed',
        }),
    );
    const event = await getLatestEvent(
        knownEventTypes.raisedBedFields.plantUpdate,
        aggregateId,
    );

    const firstRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: event,
        input: {
            eventId: event.id,
            eventType: event.type,
            aggregateId: event.aggregateId,
            data:
                event.data && typeof event.data === 'object'
                    ? (event.data as Record<string, unknown>)
                    : {},
        },
    });
    const duplicateRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: event,
    });

    assert.ok(firstRun);
    assert.strictEqual(duplicateRun, null);

    const [claimedRun] = await claimDueAutomationRuns({
        limit: 1,
        lockedBy: 'automations-test',
    });
    assert.ok(claimedRun);
    assert.strictEqual(claimedRun.id, firstRun.id);
    assert.strictEqual(claimedRun.status, 'running');
    assert.strictEqual(claimedRun.attempt, 1);

    await recordAutomationRunStep({
        runId: claimedRun.id,
        nodeId: 'trigger',
        moduleKey: 'trigger.domainEvent',
        moduleKind: 'trigger',
        status: 'succeeded',
        output: { ok: true },
    });
    await completeAutomationRun({
        id: claimedRun.id,
        status: 'succeeded',
        output: { completed: true },
    });

    const runWithSteps = await getAutomationRunWithSteps(claimedRun.id);
    assert.ok(runWithSteps);
    assert.strictEqual(runWithSteps.status, 'succeeded');
    assert.strictEqual(runWithSteps.steps.length, 1);
    assert.strictEqual(runWithSteps.steps[0]?.nodeId, 'trigger');

    const listedRuns = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.ok(listedRuns.some((run) => run.id === claimedRun.id));
});

test('automation graph validation waits for all incoming dependencies', () => {
    const graph = {
        nodes: [
            {
                id: 'trigger',
                moduleKey: automationModuleKeys.triggerDomainEvent,
                kind: 'trigger' as const,
                position: { x: 0, y: 0 },
                config: {
                    eventType: knownEventTypes.raisedBedFields.plantUpdate,
                },
            },
            {
                id: 'status-is-sowed',
                moduleKey: automationModuleKeys.conditionEventDataEquals,
                kind: 'condition' as const,
                position: { x: 260, y: -80 },
                config: {
                    path: 'status',
                    operator: 'equals',
                    value: 'sowed',
                },
            },
            {
                id: 'status-is-not-removed',
                moduleKey: automationModuleKeys.conditionEventDataEquals,
                kind: 'condition' as const,
                position: { x: 260, y: 80 },
                config: {
                    path: 'status',
                    operator: 'notEquals',
                    value: 'removed',
                },
            },
            {
                id: 'queue-seasonal-waterings',
                moduleKey:
                    automationModuleKeys.actionQueueSeasonalSowingOfferOperations,
                kind: 'action' as const,
                position: { x: 620, y: 0 },
                config: {},
            },
        ],
        edges: [
            {
                id: 'trigger-to-sowed',
                source: 'trigger',
                target: 'status-is-sowed',
            },
            {
                id: 'trigger-to-not-removed',
                source: 'trigger',
                target: 'status-is-not-removed',
            },
            {
                id: 'sowed-to-action',
                source: 'status-is-sowed',
                target: 'queue-seasonal-waterings',
            },
            {
                id: 'not-removed-to-action',
                source: 'status-is-not-removed',
                target: 'queue-seasonal-waterings',
            },
        ],
    };

    const validation = validateAutomationGraph(graph);
    if (!validation.ok) {
        assert.fail(validation.errors.join('\n'));
    }

    assert.deepStrictEqual(
        validation.orderedNodes.map((node) => node.id),
        [
            'trigger',
            'status-is-sowed',
            'status-is-not-removed',
            'queue-seasonal-waterings',
        ],
    );
});

test('automation run claiming respects definition concurrency', async () => {
    createTestDb();
    const definition = await createAutomationDefinition({
        key: 'test.concurrent-automation',
        name: 'Concurrent automation',
        status: 'enabled',
        maxConcurrentRuns: 1,
        graph: seasonalSowedWateringAutomationGraph(),
    });
    const firstRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'test',
        input: {
            eventType: knownEventTypes.raisedBedFields.plantUpdate,
            aggregateId: 'concurrency|first',
            data: { status: 'sowed' },
        },
    });
    const secondRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'test',
        input: {
            eventType: knownEventTypes.raisedBedFields.plantUpdate,
            aggregateId: 'concurrency|second',
            data: { status: 'sowed' },
        },
    });
    assert.ok(firstRun);
    assert.ok(secondRun);

    const firstClaim = await claimDueAutomationRuns({
        limit: 2,
        lockedBy: 'automations-test',
    });

    assert.strictEqual(firstClaim.length, 1);
    const claimedFirstRun = firstClaim.at(0);
    assert.ok(claimedFirstRun);
    assert.strictEqual(claimedFirstRun.id, firstRun.id);

    await completeAutomationRun({
        id: claimedFirstRun.id,
        status: 'succeeded',
        output: { completed: true },
    });

    const secondClaim = await claimDueAutomationRuns({
        limit: 2,
        lockedBy: 'automations-test',
    });

    assert.strictEqual(secondClaim.length, 1);
    const claimedSecondRun = secondClaim.at(0);
    assert.ok(claimedSecondRun);
    assert.strictEqual(claimedSecondRun.id, secondRun.id);
});

test('automation run claiming scans past saturated definition backlog', async () => {
    createTestDb();
    const dueAt = new Date('2026-06-01T08:00:00.000Z');
    const saturatedDefinition = await createAutomationDefinition({
        key: 'test.saturated-automation',
        name: 'Saturated automation',
        status: 'enabled',
        maxConcurrentRuns: 1,
        graph: seasonalSowedWateringAutomationGraph(),
    });
    const runningRun = await createAutomationRun({
        automationDefinition: saturatedDefinition,
        source: 'test',
        nextRunAt: dueAt,
        input: {
            eventType: knownEventTypes.raisedBedFields.plantUpdate,
            aggregateId: 'saturated|running',
            data: { status: 'sowed' },
        },
    });
    assert.ok(runningRun);
    const startedRun = await startAutomationRun(runningRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);

    for (let index = 0; index < 60; index += 1) {
        const run = await createAutomationRun({
            automationDefinition: saturatedDefinition,
            source: 'test',
            nextRunAt: dueAt,
            input: {
                eventType: knownEventTypes.raisedBedFields.plantUpdate,
                aggregateId: `saturated|${index}`,
                data: { status: 'sowed' },
            },
        });
        assert.ok(run);
    }

    const otherDefinition = await createAutomationDefinition({
        key: 'test.available-automation',
        name: 'Available automation',
        status: 'enabled',
        maxConcurrentRuns: 1,
        graph: seasonalSowedWateringAutomationGraph(),
    });
    const otherRun = await createAutomationRun({
        automationDefinition: otherDefinition,
        source: 'test',
        nextRunAt: dueAt,
        input: {
            eventType: knownEventTypes.raisedBedFields.plantUpdate,
            aggregateId: 'available|0',
            data: { status: 'sowed' },
        },
    });
    assert.ok(otherRun);

    const claimedRuns = await claimDueAutomationRuns({
        limit: 1,
        now: dueAt,
        lockedBy: 'automations-test',
    });

    assert.strictEqual(claimedRuns.length, 1);
    assert.strictEqual(claimedRuns[0]?.id, otherRun.id);
});

test('monthly schedule automation enqueues once per configured period', async () => {
    createTestDb();
    const graph = {
        nodes: [
            {
                id: 'trigger',
                moduleKey: automationModuleKeys.triggerScheduleMonthly,
                kind: 'trigger' as const,
                position: { x: 0, y: 0 },
                config: {
                    dayOfMonth: 1,
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'log',
                moduleKey: automationModuleKeys.actionLog,
                kind: 'action' as const,
                position: { x: 280, y: 0 },
                config: {
                    message: 'Monthly schedule reached log action.',
                },
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
    const definition = await createAutomationDefinition({
        key: 'test.monthly-schedule',
        name: 'Monthly schedule',
        status: 'enabled',
        graph,
    });

    const firstResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-01T08:00:00.000Z'),
    });
    const duplicateResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-01T09:00:00.000Z'),
    });
    const offDayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-02T08:00:00.000Z'),
    });

    assert.strictEqual(firstResult.enqueuedRuns, 1);
    assert.strictEqual(duplicateResult.enqueuedRuns, 0);
    assert.strictEqual(offDayResult.enqueuedRuns, 0);

    const runs = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.strictEqual(runs.length, 1);
    assert.strictEqual(runs[0]?.source, 'schedule');
    assert.strictEqual(
        runs[0]?.sourceAggregateId,
        'trigger.scheduleMonthly:Europe/Zagreb:2026-06:day-1',
    );
    for (const run of runs) {
        await completeAutomationRun({
            id: run.id,
            status: 'skipped',
            output: { testCleanup: true },
        });
    }
    await updateAutomationDefinition(definition.id, { status: 'disabled' });
});

test('monthly farm inventory automation creates accepted scheduled farm tasks', async () => {
    createTestDb();
    await createFarm({
        name: 'Automation Inventory Farm A',
        latitude: 45.8,
        longitude: 15.9,
    });
    await createFarm({
        name: 'Automation Inventory Farm B',
        latitude: 46.1,
        longitude: 16.2,
    });
    const activeFarms = (await getFarms()).filter((farm) => !farm.isDeleted);
    const referenceDate = new Date('2026-07-01T08:00:00.000Z');
    const operationConfigs = [
        {
            entityId: 9_910_001,
            entityTypeName: 'operation',
            scheduledInDays: 0,
        },
        {
            entityId: 9_910_002,
            entityTypeName: 'operation',
            scheduledInDays: 2,
        },
    ];
    const preexistingFarm = activeFarms[0];
    assert.ok(preexistingFarm);
    const preexistingOperationId = await createOperation({
        entityId: operationConfigs[0].entityId,
        entityTypeName: operationConfigs[0].entityTypeName,
        farmId: preexistingFarm.id,
        timestamp: new Date('2026-05-01T08:00:00.000Z'),
    });
    await acceptOperation(preexistingOperationId);
    await createEvent(
        knownEvents.operations.scheduledV1(preexistingOperationId.toString(), {
            scheduledDate: referenceDate.toISOString(),
        }),
    );
    const graph = {
        nodes: [
            {
                id: 'trigger',
                moduleKey: automationModuleKeys.triggerScheduleMonthly,
                kind: 'trigger' as const,
                position: { x: 0, y: 0 },
                config: {
                    dayOfMonth: 1,
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'create-inventory-operations',
                moduleKey:
                    automationModuleKeys.actionCreateFarmInventoryOperations,
                kind: 'action' as const,
                position: { x: 300, y: 0 },
                config: {
                    operations: operationConfigs,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-create-inventory-operations',
                source: 'trigger',
                target: 'create-inventory-operations',
            },
        ],
    };
    const definition = await createAutomationDefinition({
        key: 'test.monthly-farm-inventory',
        name: 'Monthly farm inventory',
        status: 'enabled',
        graph,
    });

    const enqueueResult = await enqueueAutomationRunsFromSchedules({
        now: referenceDate,
    });
    assert.strictEqual(enqueueResult.enqueuedRuns, 1);

    const processResult = await processDueAutomationRuns({
        limit: 10,
        lockedBy: 'automations-test',
    });
    assert.strictEqual(processResult.succeeded, 1);

    const expectedScheduledDates = operationConfigs.map((operationConfig) =>
        addUtcDays(
            referenceDate,
            operationConfig.scheduledInDays,
        ).toISOString(),
    );
    for (const farm of activeFarms) {
        const farmOperations = await getFarmAcceptedOperationsByScheduleRange({
            farmId: farm.id,
            from: referenceDate,
            to: addUtcDays(referenceDate, 3),
        });
        const inventoryOperations = farmOperations
            .filter((operation) =>
                operationConfigs.some(
                    (operationConfig) =>
                        operationConfig.entityId === operation.entityId,
                ),
            )
            .sort((left, right) => left.entityId - right.entityId);

        assert.strictEqual(
            inventoryOperations.length,
            operationConfigs.length,
            `Expected ${operationConfigs.length} inventory operations for farm ${farm.id}, got ${JSON.stringify(
                inventoryOperations.map((operation) => ({
                    id: operation.id,
                    entityId: operation.entityId,
                    scheduledDate: operation.scheduledDate?.toISOString(),
                    timestamp: operation.timestamp.toISOString(),
                })),
            )}`,
        );
        assert.deepStrictEqual(
            inventoryOperations.map((operation) =>
                operation.scheduledDate?.toISOString(),
            ),
            expectedScheduledDates,
        );
        assert.ok(
            inventoryOperations.every((operation) => operation.isAccepted),
        );
        assert.ok(
            inventoryOperations.every(
                (operation) => operation.farmId === farm.id,
            ),
        );
        if (farm.id === preexistingFarm.id) {
            assert.ok(
                inventoryOperations.some(
                    (operation) => operation.id === preexistingOperationId,
                ),
            );
        }
    }

    const [firstRun] = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.ok(firstRun);
    const replayRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'replay',
        input: firstRun.input,
    });
    assert.ok(replayRun);
    const startedReplay = await startAutomationRun(replayRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedReplay);

    const replayResult = await executeAutomationRun(startedReplay);

    assert.strictEqual(replayResult.status, 'skipped');
    for (const farm of activeFarms) {
        const farmOperations = await getFarmAcceptedOperationsByScheduleRange({
            farmId: farm.id,
            from: referenceDate,
            to: addUtcDays(referenceDate, 3),
        });
        const inventoryOperations = farmOperations.filter((operation) =>
            operationConfigs.some(
                (operationConfig) =>
                    operationConfig.entityId === operation.entityId,
            ),
        );
        assert.strictEqual(inventoryOperations.length, operationConfigs.length);
    }
});

test('default sowed automation queues seasonal watering operations through executor', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createAutomationRaisedBedContext();
    await ensureDefaultAutomationDefinitions();

    const aggregateId = `${raisedBedId}|0`;
    await createEvent({
        ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sowed',
        }),
        createdAt: new Date('2026-03-10T08:00:00.000Z'),
    });
    const event = await getLatestEvent(
        knownEventTypes.raisedBedFields.plantUpdate,
        aggregateId,
    );
    const [definition] = await listAutomationDefinitions({
        triggerEventType: knownEventTypes.raisedBedFields.plantUpdate,
        status: 'enabled',
        limit: 10,
    });
    assert.ok(definition);

    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: event,
        input: {
            eventId: event.id,
            eventType: event.type,
            aggregateId: event.aggregateId,
            data:
                event.data && typeof event.data === 'object'
                    ? (event.data as Record<string, unknown>)
                    : {},
        },
    });
    assert.ok(run);
    const [claimedRun] = await claimDueAutomationRuns({
        limit: 1,
        lockedBy: 'automations-test',
    });
    assert.ok(claimedRun);

    const result = await executeAutomationRun(claimedRun);

    assert.strictEqual(result.status, 'succeeded');
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-03-10T08:00:00.000Z',
            '2026-03-12T08:00:00.000Z',
            '2026-03-14T08:00:00.000Z',
        ],
    );

    const runWithSteps = await getAutomationRunWithSteps(claimedRun.id);
    assert.ok(runWithSteps);
    assert.strictEqual(runWithSteps.status, 'succeeded');
    assert.deepStrictEqual(
        runWithSteps.steps.map((step) => step.status),
        ['succeeded', 'succeeded', 'succeeded'],
    );

    const replayRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'replay',
        sourceEvent: event,
        input: run.input,
    });
    assert.ok(replayRun);
    const startedReplay = await startAutomationRun(replayRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedReplay);

    const replayResult = await executeAutomationRun(startedReplay);

    assert.strictEqual(replayResult.status, 'skipped');
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-03-10T08:00:00.000Z',
            '2026-03-12T08:00:00.000Z',
            '2026-03-14T08:00:00.000Z',
        ],
    );
});

test('plant-status automation skips replay when target status already exists', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createAutomationRaisedBedContext();
    const fieldAggregateId = `${raisedBedId}|0`;
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(fieldAggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-04-01T08:00:00.000Z',
        }),
    );
    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields[0];
    assert.ok(field);

    const operationId = await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
        raisedBedFieldId: field.id,
    });
    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: 'automations-test',
        }),
    );
    const event = await getLatestEvent(
        knownEventTypes.operations.complete,
        operationId.toString(),
    );
    const graph = {
        nodes: [
            {
                id: 'trigger',
                moduleKey: 'trigger.domainEvent',
                kind: 'trigger' as const,
                position: { x: 0, y: 0 },
                config: {
                    eventType: knownEventTypes.operations.complete,
                },
            },
            {
                id: 'update-plant-status',
                moduleKey: 'action.updateRaisedBedFieldPlantStatus',
                kind: 'action' as const,
                position: { x: 280, y: 0 },
                config: {
                    targetStatus: 'sprouted',
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-update-plant-status',
                source: 'trigger',
                target: 'update-plant-status',
            },
        ],
    };
    const definition = await createAutomationDefinition({
        key: 'test.operation-complete-plant-status',
        name: 'Operation completion updates plant status',
        status: 'enabled',
        graph,
    });
    const input = {
        eventId: event.id,
        eventType: event.type,
        aggregateId: event.aggregateId,
        data:
            event.data && typeof event.data === 'object'
                ? (event.data as Record<string, unknown>)
                : {},
    };
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: event,
        input,
    });
    assert.ok(run);
    const startedRun = await startAutomationRun(run.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);

    const result = await executeAutomationRun(startedRun);

    assert.strictEqual(result.status, 'succeeded');
    const updatedRaisedBed = await getRaisedBed(raisedBedId);
    const updatedField = updatedRaisedBed?.fields.find(
        (candidate) => candidate.id === field.id,
    );
    assert.strictEqual(updatedField?.plantStatus, 'sprouted');
    assert.strictEqual(
        (
            await getEvents(knownEventTypes.raisedBedFields.plantUpdate, [
                fieldAggregateId,
            ])
        ).length,
        1,
    );

    const replayRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'replay',
        sourceEvent: event,
        input,
    });
    assert.ok(replayRun);
    const startedReplay = await startAutomationRun(replayRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedReplay);

    const replayResult = await executeAutomationRun(startedReplay);

    assert.strictEqual(replayResult.status, 'skipped');
    assert.strictEqual(
        (
            await getEvents(knownEventTypes.raisedBedFields.plantUpdate, [
                fieldAggregateId,
            ])
        ).length,
        1,
    );
});

test('seedling transplant automation waits for verification before setting sowing location to direct', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createAutomationRaisedBedContext();
    const fieldAggregateId = `${raisedBedId}|0`;
    const scheduledDate = '2026-04-01T08:00:00.000Z';
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(fieldAggregateId, {
            plantSortId: '101',
            scheduledDate,
            sowingLocation: 'greenhouse',
        }),
    );
    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields[0];
    assert.ok(field);
    assert.strictEqual(field.sowingLocation, 'greenhouse');

    const operationId = await createOperation({
        accountId,
        entityId: 593,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
        raisedBedFieldId: field.id,
    });
    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: 'automations-test',
        }),
    );
    const completionEvent = await getLatestEvent(
        knownEventTypes.operations.complete,
        operationId.toString(),
    );
    const graph = seedlingTransplantDirectSowingLocationAutomationGraph();
    const definition = await createAutomationDefinition({
        key: 'test.seedling-transplant-direct-location',
        name: 'Seedling transplant direct location',
        status: 'enabled',
        graph,
    });
    const completionInput = {
        eventId: completionEvent.id,
        eventType: completionEvent.type,
        aggregateId: completionEvent.aggregateId,
        data:
            completionEvent.data && typeof completionEvent.data === 'object'
                ? (completionEvent.data as Record<string, unknown>)
                : {},
    };
    const completionRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: completionEvent,
        input: completionInput,
    });
    assert.ok(completionRun);
    const startedCompletionRun = await startAutomationRun(completionRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedCompletionRun);

    const completionResult = await executeAutomationRun(startedCompletionRun);

    assert.strictEqual(completionResult.status, 'skipped');
    assert.strictEqual(
        (
            await getEvents(knownEventTypes.raisedBedFields.plantSchedule, [
                fieldAggregateId,
            ])
        ).length,
        0,
    );

    await createEvent(
        knownEvents.operations.verifiedV1(operationId.toString(), {
            verifiedBy: 'automations-test',
        }),
    );
    const verificationEvent = await getLatestEvent(
        knownEventTypes.operations.verify,
        operationId.toString(),
    );
    const verificationInput = {
        eventId: verificationEvent.id,
        eventType: verificationEvent.type,
        aggregateId: verificationEvent.aggregateId,
        data:
            verificationEvent.data && typeof verificationEvent.data === 'object'
                ? (verificationEvent.data as Record<string, unknown>)
                : {},
    };
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: verificationEvent,
        input: verificationInput,
    });
    assert.ok(run);
    const startedRun = await startAutomationRun(run.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);

    const result = await executeAutomationRun(startedRun);

    assert.strictEqual(result.status, 'succeeded');
    const updatedRaisedBed = await getRaisedBed(raisedBedId);
    const updatedField = updatedRaisedBed?.fields.find(
        (candidate) => candidate.id === field.id,
    );
    assert.strictEqual(updatedField?.sowingLocation, 'direct');
    assert.strictEqual(
        updatedField?.plantScheduledDate?.toISOString(),
        scheduledDate,
    );
    const scheduleEvents = await getEvents(
        knownEventTypes.raisedBedFields.plantSchedule,
        [fieldAggregateId],
    );
    assert.strictEqual(scheduleEvents.length, 1);
    assert.ok(
        scheduleEvents[0]?.data &&
            typeof scheduleEvents[0].data === 'object' &&
            !Array.isArray(scheduleEvents[0].data),
    );
    assert.strictEqual(
        Reflect.get(scheduleEvents[0].data, 'sowingLocation'),
        'direct',
    );
    assert.strictEqual(
        Reflect.get(scheduleEvents[0].data, 'scheduledDate'),
        scheduledDate,
    );

    const replayRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'replay',
        sourceEvent: verificationEvent,
        input: verificationInput,
    });
    assert.ok(replayRun);
    const startedReplay = await startAutomationRun(replayRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedReplay);

    const replayResult = await executeAutomationRun(startedReplay);

    assert.strictEqual(replayResult.status, 'skipped');
    assert.strictEqual(
        (
            await getEvents(knownEventTypes.raisedBedFields.plantSchedule, [
                fieldAggregateId,
            ])
        ).length,
        1,
    );
});

test('image plant-status review automation previews operation completion images in dry run', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createAutomationRaisedBedContext();
    const fieldAggregateId = `${raisedBedId}|0`;
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(fieldAggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-04-01T08:00:00.000Z',
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(fieldAggregateId, {
            status: 'sowed',
        }),
    );
    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.ok(field);

    const operationId = await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
        raisedBedFieldId: field.id,
    });
    const operationImageDate = new Date('2026-05-10T08:00:00.000Z');
    await createEvent({
        ...knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: 'automations-test',
            images: [
                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/operations/test-field.jpg',
                'https://example.com/not-gredice-storage.jpg',
            ],
        }),
        createdAt: operationImageDate,
    });
    const event = await getLatestEvent(
        knownEventTypes.operations.complete,
        operationId.toString(),
    );
    const definition = await createAutomationDefinition({
        key: 'test.image-plant-status-review',
        name: 'Image plant status review',
        status: 'enabled',
        graph: operationImagePlantStatusReviewAutomationGraph(),
    });
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: event,
        dryRun: true,
        input: {
            eventId: event.id,
            eventType: event.type,
            aggregateId: event.aggregateId,
            data:
                event.data && typeof event.data === 'object'
                    ? (event.data as Record<string, unknown>)
                    : {},
        },
    });
    assert.ok(run);
    const startedRun = await startAutomationRun(run.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);

    const result = await executeAutomationRun(startedRun);

    assert.strictEqual(result.status, 'succeeded');
    const runWithSteps = await getAutomationRunWithSteps(startedRun.id);
    const actionStep = runWithSteps?.steps.find(
        (step) => step.nodeId === 'review-plant-statuses',
    );
    assert.strictEqual(actionStep?.status, 'succeeded');
    assert.ok(
        actionStep?.output &&
            typeof actionStep.output === 'object' &&
            !Array.isArray(actionStep.output),
    );
    assert.strictEqual(
        Reflect.get(actionStep.output, 'source'),
        'operationCompletion',
    );
    assert.strictEqual(Reflect.get(actionStep.output, 'imageCount'), 1);
    assert.strictEqual(
        Reflect.get(actionStep.output, 'imageDate'),
        operationImageDate.toISOString(),
    );
    assert.strictEqual(
        Reflect.get(actionStep.output, 'skippedInvalidImageCount'),
        1,
    );
    assert.strictEqual(Reflect.get(actionStep.output, 'plantedFieldCount'), 1);
});

test('image plant-status review automation uses AI analysis reference date in dry run', async () => {
    createTestDb();
    const { accountId, raisedBedId } = await createAutomationRaisedBedContext();
    const fieldAggregateId = `${raisedBedId}|0`;
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(fieldAggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-04-01T08:00:00.000Z',
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(fieldAggregateId, {
            status: 'sowed',
        }),
    );
    const imageDate = '2026-05-10T08:00:00.000Z';
    await createEvent({
        ...knownEvents.raisedBeds.aiAnalysisV1(raisedBedId.toString(), {
            markdown: 'AI review',
            imageUrl:
                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/operations/test-field.jpg',
            imageUrls: [
                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/operations/test-field.jpg',
            ],
            model: 'test-model',
            analyzedAt: '2026-06-05T08:00:00.000Z',
            referenceDate: imageDate,
            accountId,
        }),
        createdAt: new Date('2026-06-05T08:00:00.000Z'),
    });
    const event = await getLatestEvent(
        knownEventTypes.raisedBeds.aiAnalysis,
        raisedBedId.toString(),
    );
    const definition = await createAutomationDefinition({
        key: 'test.image-plant-status-review-ai-reference-date',
        name: 'Image plant status review AI reference date',
        status: 'enabled',
        graph: raisedBedAiAnalysisImagePlantStatusReviewAutomationGraph(),
    });
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: event,
        dryRun: true,
        input: {
            eventId: event.id,
            eventType: event.type,
            aggregateId: event.aggregateId,
            data:
                event.data && typeof event.data === 'object'
                    ? (event.data as Record<string, unknown>)
                    : {},
        },
    });
    assert.ok(run);
    const startedRun = await startAutomationRun(run.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);

    const result = await executeAutomationRun(startedRun);

    assert.strictEqual(result.status, 'succeeded');
    const runWithSteps = await getAutomationRunWithSteps(startedRun.id);
    const actionStep = runWithSteps?.steps.find(
        (step) => step.nodeId === 'review-plant-statuses',
    );
    assert.strictEqual(actionStep?.status, 'succeeded');
    assert.ok(
        actionStep?.output &&
            typeof actionStep.output === 'object' &&
            !Array.isArray(actionStep.output),
    );
    assert.strictEqual(
        Reflect.get(actionStep.output, 'source'),
        'raisedBedAiAnalysis',
    );
    assert.strictEqual(Reflect.get(actionStep.output, 'imageDate'), imageDate);
    assert.strictEqual(Reflect.get(actionStep.output, 'imageCount'), 1);
});

test('image plant-status review automation skips non-dry runs when AI Gateway credentials are blank', async (t) => {
    const originalApiKey = process.env.AI_GATEWAY_API_KEY;
    const originalOidcToken = process.env.VERCEL_OIDC_TOKEN;
    t.after(() => {
        if (typeof originalApiKey === 'string') {
            process.env.AI_GATEWAY_API_KEY = originalApiKey;
        } else {
            delete process.env.AI_GATEWAY_API_KEY;
        }

        if (typeof originalOidcToken === 'string') {
            process.env.VERCEL_OIDC_TOKEN = originalOidcToken;
        } else {
            delete process.env.VERCEL_OIDC_TOKEN;
        }
    });
    process.env.AI_GATEWAY_API_KEY = '   ';
    process.env.VERCEL_OIDC_TOKEN = '';

    createTestDb();
    const definition = await createAutomationDefinition({
        key: 'test.image-plant-status-review-blank-ai-config',
        name: 'Image plant status review blank AI config',
        status: 'enabled',
        graph: operationImagePlantStatusReviewAutomationGraph(),
    });
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'test',
        dryRun: false,
        input: {
            eventType: knownEventTypes.operations.complete,
            aggregateId: 'operation:credential-check',
            data: {
                images: [
                    'https://myegtvromcktt2y7.public.blob.vercel-storage.com/operations/test-field.jpg',
                ],
            },
            createdAt: '2026-06-01T08:00:00.000Z',
        },
    });
    assert.ok(run);
    const startedRun = await startAutomationRun(run.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);

    const result = await executeAutomationRun(startedRun);

    assert.strictEqual(result.status, 'skipped');
    const runWithSteps = await getAutomationRunWithSteps(startedRun.id);
    const actionStep = runWithSteps?.steps.find(
        (step) => step.nodeId === 'review-plant-statuses',
    );
    assert.strictEqual(actionStep?.status, 'skipped');
    assert.ok(
        actionStep?.output &&
            typeof actionStep.output === 'object' &&
            !Array.isArray(actionStep.output),
    );
    assert.strictEqual(
        Reflect.get(actionStep.output, 'reason'),
        'AI Gateway credentials are not configured.',
    );
});

test('automation runner seeds the initial event cursor without backfilling historical events', async () => {
    createTestDb();
    await storage().delete(automationEventCursors);
    const { raisedBedId } = await createAutomationRaisedBedContext();
    const aggregateId = `${raisedBedId}|0`;
    await createEvent({
        ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sowed',
        }),
        createdAt: new Date('2026-02-01T08:00:00.000Z'),
    });
    const historicalEvent = await getLatestEvent(
        knownEventTypes.raisedBedFields.plantUpdate,
        aggregateId,
    );

    const initialResult = await enqueueAutomationRunsFromDomainEvents({
        limit: 10,
    });

    assert.strictEqual(initialResult.scannedEvents, 0);
    assert.strictEqual(initialResult.enqueuedRuns, 0);
    assert.strictEqual(initialResult.lastEventId, historicalEvent.id);
    assert.strictEqual(await getAutomationEventCursor(), historicalEvent.id);
    assert.deepStrictEqual(
        await listAutomationRuns({ sourceEventId: historicalEvent.id }),
        [],
    );

    await createEvent({
        ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sowed',
        }),
        createdAt: new Date('2026-02-02T08:00:00.000Z'),
    });
    const liveEvent = await getLatestEvent(
        knownEventTypes.raisedBedFields.plantUpdate,
        aggregateId,
    );

    const liveResult = await enqueueAutomationRunsFromDomainEvents({
        limit: 10,
    });

    assert.strictEqual(liveResult.scannedEvents, 1);
    assert.ok(liveResult.enqueuedRuns >= 1);
    assert.strictEqual(liveResult.lastEventId, liveEvent.id);
    assert.strictEqual(await getAutomationEventCursor(), liveEvent.id);
    const liveRuns = await listAutomationRuns({ sourceEventId: liveEvent.id });
    assert.strictEqual(liveRuns.length, liveResult.enqueuedRuns);
    assert.ok(liveRuns.every((run) => run.sourceEventId === liveEvent.id));
    for (const run of liveRuns) {
        await completeAutomationRun({
            id: run.id,
            status: 'skipped',
            output: { testCleanup: true },
        });
    }
});

test('automation runner enqueues and processes due default automation runs', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createAutomationRaisedBedContext();
    await ensureDefaultAutomationDefinitions();

    const aggregateId = `${raisedBedId}|0`;
    await createEvent({
        ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sowed',
        }),
        createdAt: new Date('2026-06-01T08:00:00.000Z'),
    });
    const event = await getLatestEvent(
        knownEventTypes.raisedBedFields.plantUpdate,
        aggregateId,
    );
    const [definition] = await listEnabledAutomationDefinitionsForEventType(
        event.type,
    );
    assert.ok(definition);
    await createAutomationRun({
        automationDefinition: definition,
        source: 'event',
        sourceEvent: event,
        input: {
            eventId: event.id,
            eventType: event.type,
            aggregateId: event.aggregateId,
            data:
                event.data && typeof event.data === 'object'
                    ? (event.data as Record<string, unknown>)
                    : {},
        },
    });

    const result = await processDueAutomationRuns({
        limit: 10,
        lockedBy: 'automations-test',
    });

    assert.strictEqual(result.claimedRuns, 1);
    assert.strictEqual(result.succeeded, 1);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-06-01T08:00:00.000Z',
            '2026-06-02T08:00:00.000Z',
            '2026-06-03T08:00:00.000Z',
            '2026-06-04T08:00:00.000Z',
            '2026-06-05T08:00:00.000Z',
        ],
    );
});
