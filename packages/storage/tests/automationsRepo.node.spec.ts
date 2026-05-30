import assert from 'node:assert/strict';
import test from 'node:test';
import {
    automationEventCursors,
    automationModuleKeys,
    claimDueAutomationRuns,
    completeAutomationRun,
    createAccount,
    createAutomationDefinition,
    createAutomationRun,
    createEvent,
    createOperation,
    enqueueAutomationRunsFromDomainEvents,
    ensureDefaultAutomationDefinitions,
    executeAutomationRun,
    FREE_WATERING_OPERATION_ID,
    getAutomationEventCursor,
    getAutomationRunWithSteps,
    getEvents,
    getOperations,
    getRaisedBed,
    knownEvents,
    knownEventTypes,
    listAutomationDefinitions,
    listAutomationRuns,
    listEnabledAutomationDefinitionsForEventType,
    processDueAutomationRuns,
    recordAutomationRunStep,
    seasonalSowedWateringAutomationGraph,
    startAutomationRun,
    storage,
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
            completedAt: '2026-05-01T08:00:00.000Z',
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
