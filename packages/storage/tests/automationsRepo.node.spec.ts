import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
    type AutomationGraph,
    acceptOperation,
    automationDefinitions,
    automationEventCursors,
    automationModuleKeys,
    automationRunSteps,
    automationRuns,
    automationScheduleEventType,
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
    FARM_RAISED_BED_WEEDING_OPERATION_ID,
    FREE_WATERING_OPERATION_ID,
    farmRaisedBedWeedingAutomationKey,
    farmRaisedBedWeedingBiweeklyAnchorDate,
    farms,
    getAutomationDefinitionByKey,
    getAutomationEventCursor,
    getAutomationRunWithSteps,
    getEvents,
    getFarmAcceptedOperationsByScheduleRange,
    getFarms,
    getOperations,
    getRaisedBed,
    knownEvents,
    knownEventTypes,
    listAutomationDefinitionRunSummaries,
    listAutomationDefinitions,
    listAutomationRuns,
    listEnabledAutomationDefinitionsForEventType,
    operationImagePlantStatusReviewAutomationGraph,
    plantRemovalOperationStatusAutomationGraph,
    plantRemovalOperationStatusAutomationKey,
    processDueAutomationRuns,
    RAISED_BED_WATERING_50L_OPERATION_ID,
    recordAutomationRunStep,
    retryFailedAutomationRun,
    seasonalSowedWateringAutomationGraph,
    seedlingTransplantDirectSowingLocationAutomationGraph,
    seedlingTransplantWateringAutomationGraph,
    setRaisedBedFieldWeedState,
    startAutomationRun,
    storage,
    updateAutomationDefinition,
    upsertRaisedBedField,
    validateAutomationGraph,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

afterEach(async () => {
    await storage().delete(automationRunSteps);
    await storage().delete(automationRuns);
    await storage().delete(automationDefinitions);
    await storage().delete(automationEventCursors);
});

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

async function getAutomationRunForEvent(
    automationDefinitionId: number,
    sourceEventId: number,
) {
    const runs = await listAutomationRuns({
        automationDefinitionId,
        sourceEventId,
    });
    assert.strictEqual(runs.length, 1);
    const run = runs[0];
    assert.ok(run);
    return run;
}

async function getScheduledFreeWateringDates(
    accountId: string,
    gardenId: number,
    raisedBedId: number,
) {
    return getScheduledOperationDates(
        accountId,
        gardenId,
        raisedBedId,
        FREE_WATERING_OPERATION_ID,
    );
}

async function getScheduledOperationDates(
    accountId: string,
    gardenId: number,
    raisedBedId: number,
    entityId: number,
) {
    const operations = await getOperations(accountId, gardenId, raisedBedId);

    return operations
        .filter(
            (operation) =>
                operation.entityId === entityId && operation.scheduledDate,
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

function monthlyLogAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerScheduleMonthly,
                position: { x: 0, y: 0 },
                config: {
                    dayOfMonth: 1,
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'log',
                kind: 'action',
                moduleKey: automationModuleKeys.actionLog,
                position: { x: 280, y: 0 },
                config: {
                    message: 'Quick automation test reached the log action.',
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
}

function scheduleLogAutomationGraph(
    config: Record<string, unknown>,
): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerSchedule,
                position: { x: 0, y: 0 },
                config,
            },
            {
                id: 'log',
                kind: 'action',
                moduleKey: automationModuleKeys.actionLog,
                position: { x: 280, y: 0 },
                config: {
                    message: 'Schedule reached log action.',
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
}

function addUtcDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}

function monthlyScheduleRunInput(index: number) {
    return {
        scheduleType: 'monthly',
        triggerModuleKey: automationModuleKeys.triggerScheduleMonthly,
        occurrenceKey: `test.monthly-log:${index}`,
        period: '2026-06',
        occurrenceDate: '2026-06-01T08:00:00.000Z',
    };
}

function biweeklyScheduleRunInput({
    occurrenceDate,
    occurrenceKey = `test.biweekly:${occurrenceDate}`,
    weekOffset = 0,
}: {
    occurrenceDate: string;
    occurrenceKey?: string;
    weekOffset?: number;
}) {
    return {
        scheduleType: 'biweekly',
        frequency: 'biweekly',
        triggerModuleKey: automationModuleKeys.triggerSchedule,
        occurrenceKey,
        occurrenceDate: occurrenceDate.slice(0, 10),
        enqueuedAt: occurrenceDate,
        timeZone: 'Europe/Zagreb',
        intervalWeeks: 2,
        anchorDate: farmRaisedBedWeedingBiweeklyAnchorDate,
        weekOffset,
        dayOfWeek: 'monday',
        daysOfWeek: ['monday'],
    };
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

    const firstRun = await getAutomationRunForEvent(definition.id, event.id);
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

test('automation definition run summaries are independent per definition', async () => {
    createTestDb();
    const firstDefinition = await createAutomationDefinition({
        key: 'test.summary-first-automation',
        name: 'Summary first automation',
        status: 'enabled',
        graph: seasonalSowedWateringAutomationGraph(),
    });
    const secondDefinition = await createAutomationDefinition({
        key: 'test.summary-second-automation',
        name: 'Summary second automation',
        status: 'enabled',
        graph: seasonalSowedWateringAutomationGraph(),
    });
    const firstFailedRun = await createAutomationRun({
        automationDefinition: firstDefinition,
        source: 'test',
        input: { order: 'first-failed' },
    });
    assert.ok(firstFailedRun);
    await completeAutomationRun({
        id: firstFailedRun.id,
        status: 'failed',
        errorMessage: 'Expected test failure.',
    });

    const firstLatestRun = await createAutomationRun({
        automationDefinition: firstDefinition,
        source: 'test',
        input: { order: 'first-latest' },
    });
    assert.ok(firstLatestRun);
    await completeAutomationRun({
        id: firstLatestRun.id,
        status: 'succeeded',
        output: { ok: true },
    });

    const secondFailedRun = await createAutomationRun({
        automationDefinition: secondDefinition,
        source: 'test',
        input: { order: 'second-failed' },
    });
    assert.ok(secondFailedRun);
    await completeAutomationRun({
        id: secondFailedRun.id,
        status: 'failed',
        errorMessage: 'Expected second test failure.',
    });

    const summaries = await listAutomationDefinitionRunSummaries([
        firstDefinition.id,
        secondDefinition.id,
        -1,
    ]);
    const summariesByDefinitionId = new Map(
        summaries.map((summary) => [summary.automationDefinitionId, summary]),
    );

    assert.strictEqual(
        summariesByDefinitionId.get(firstDefinition.id)?.latestRun?.id,
        firstLatestRun.id,
    );
    assert.strictEqual(
        summariesByDefinitionId.get(firstDefinition.id)?.failedRunsCount,
        1,
    );
    assert.strictEqual(
        summariesByDefinitionId.get(secondDefinition.id)?.latestRun?.id,
        secondFailedRun.id,
    );
    assert.strictEqual(
        summariesByDefinitionId.get(secondDefinition.id)?.failedRunsCount,
        1,
    );
    assert.deepStrictEqual(summariesByDefinitionId.get(-1), {
        automationDefinitionId: -1,
        latestRun: null,
        failedRunsCount: 0,
    });
});

test('manual retry reuses a failed automation run and clears failed summary after success', async () => {
    createTestDb();
    const definition = await createAutomationDefinition({
        key: 'test.manual-retry-automation',
        name: 'Manual retry automation',
        status: 'enabled',
        graph: seasonalSowedWateringAutomationGraph(),
    });
    const createdRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'test',
        input: { order: 'manual-retry' },
        maxAttempts: 1,
    });
    assert.ok(createdRun);

    const startedRun = await startAutomationRun(createdRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);
    assert.strictEqual(startedRun.source, 'test');
    assert.strictEqual(startedRun.dryRun, true);
    assert.strictEqual(startedRun.attempt, 1);
    assert.strictEqual(startedRun.maxAttempts, 1);

    await completeAutomationRun({
        id: startedRun.id,
        status: 'failed',
        errorMessage: 'Expected retry test failure.',
    });

    const [failedSummary] = await listAutomationDefinitionRunSummaries([
        definition.id,
    ]);
    assert.strictEqual(failedSummary?.failedRunsCount, 1);

    const retryAt = new Date('2026-06-13T10:00:00.000Z');
    const retriedRun = await retryFailedAutomationRun({
        id: startedRun.id,
        manualRequestedByUserId: null,
        retryAt,
    });

    assert.ok(retriedRun);
    assert.strictEqual(retriedRun.id, startedRun.id);
    assert.strictEqual(retriedRun.source, 'manual');
    assert.strictEqual(retriedRun.status, 'retrying');
    assert.strictEqual(retriedRun.dryRun, false);
    assert.strictEqual(retriedRun.attempt, 1);
    assert.strictEqual(retriedRun.maxAttempts, 2);
    assert.strictEqual(retriedRun.completedAt, null);
    assert.strictEqual(
        retriedRun.nextRunAt.toISOString(),
        retryAt.toISOString(),
    );

    const [claimedRetry] = await claimDueAutomationRuns({
        limit: 1,
        now: retryAt,
        lockedBy: 'automations-test',
    });
    assert.ok(claimedRetry);
    assert.strictEqual(claimedRetry.id, startedRun.id);
    assert.strictEqual(claimedRetry.source, 'manual');
    assert.strictEqual(claimedRetry.dryRun, false);
    assert.strictEqual(claimedRetry.attempt, 2);
    assert.strictEqual(claimedRetry.maxAttempts, 2);

    await completeAutomationRun({
        id: claimedRetry.id,
        status: 'succeeded',
        output: { ok: true },
    });

    const [succeededSummary] = await listAutomationDefinitionRunSummaries([
        definition.id,
    ]);
    assert.strictEqual(succeededSummary?.latestRun?.id, startedRun.id);
    assert.strictEqual(succeededSummary?.latestRun?.status, 'succeeded');
    assert.strictEqual(succeededSummary?.failedRunsCount, 0);

    const runs = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.deepStrictEqual(
        runs.map((run) => run.id),
        [startedRun.id],
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

test('automation processor drains quick single-concurrency runs across batches', async () => {
    createTestDb();
    const definition = await createAutomationDefinition({
        key: 'test.quick-batch-automation',
        name: 'Quick batch automation',
        status: 'enabled',
        maxConcurrentRuns: 1,
        graph: monthlyLogAutomationGraph(),
    });

    for (let index = 0; index < 3; index += 1) {
        const run = await createAutomationRun({
            automationDefinition: definition,
            source: 'test',
            input: monthlyScheduleRunInput(index),
        });
        assert.ok(run);
    }

    const result = await processDueAutomationRuns({
        limit: 1,
        maxBatches: 5,
        maxDurationMs: 10_000,
        minRemainingMs: 1_000,
        lockedBy: 'automations-test',
    });

    assert.strictEqual(result.claimedRuns, 3);
    assert.strictEqual(result.processedBatches, 3);
    assert.strictEqual(result.succeeded, 3);
    assert.strictEqual(result.processingStopReason, 'queue_empty');
});

test('automation processor waits for next cron cycle when measured batches are slow', async () => {
    createTestDb();
    const definition = await createAutomationDefinition({
        key: 'test.slow-measured-batch-automation',
        name: 'Slow measured batch automation',
        status: 'enabled',
        maxConcurrentRuns: 1,
        graph: monthlyLogAutomationGraph(),
    });

    for (let index = 0; index < 3; index += 1) {
        const run = await createAutomationRun({
            automationDefinition: definition,
            source: 'test',
            input: monthlyScheduleRunInput(index),
        });
        assert.ok(run);
    }

    const observedTimes = [0, 0, 6_000];
    let timeIndex = 0;
    const result = await processDueAutomationRuns({
        limit: 1,
        maxBatches: 5,
        maxDurationMs: 10_000,
        minRemainingMs: 2_000,
        lockedBy: 'automations-test',
        getTimeMs: () =>
            observedTimes[Math.min(timeIndex++, observedTimes.length - 1)] ?? 0,
    });

    assert.strictEqual(result.claimedRuns, 1);
    assert.strictEqual(result.processedBatches, 1);
    assert.strictEqual(result.succeeded, 1);
    assert.strictEqual(result.processingDurationMs, 6_000);
    assert.strictEqual(result.processingStopReason, 'time_budget');

    const remainingRuns = await listAutomationRuns({
        automationDefinitionId: definition.id,
        status: 'queued',
    });
    assert.strictEqual(remainingRuns.length, 2);
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

test('daily schedule automation enqueues once per local day and executes', async () => {
    createTestDb();
    const definition = await createAutomationDefinition({
        key: 'test.daily-schedule',
        name: 'Daily schedule',
        status: 'enabled',
        graph: scheduleLogAutomationGraph({
            frequency: 'daily',
            timeZone: 'Europe/Zagreb',
        }),
    });

    const firstResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-23T08:00:00.000Z'),
    });
    const duplicateResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-23T21:00:00.000Z'),
    });
    const nextDayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-24T08:00:00.000Z'),
    });

    assert.strictEqual(firstResult.enqueuedRuns, 1);
    assert.strictEqual(duplicateResult.enqueuedRuns, 0);
    assert.strictEqual(nextDayResult.enqueuedRuns, 1);

    const runs = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.strictEqual(runs.length, 2);
    assert.ok(
        runs.every(
            (run) => run.sourceEventType === automationScheduleEventType,
        ),
    );
    assert.deepStrictEqual(runs.map((run) => run.input.scheduleType).sort(), [
        'daily',
        'daily',
    ]);

    const processResult = await processDueAutomationRuns({
        limit: 10,
        lockedBy: 'automations-test',
    });
    assert.strictEqual(processResult.succeeded, 2);
});

test('weekly schedule automation supports selected weekdays', async () => {
    createTestDb();
    const definition = await createAutomationDefinition({
        key: 'test.weekday-schedule',
        name: 'Weekday schedule',
        status: 'enabled',
        graph: scheduleLogAutomationGraph({
            frequency: 'weekly',
            daysOfWeek: ['tuesday', 'friday'],
            timeZone: 'Europe/Zagreb',
        }),
    });

    const offDayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-22T08:00:00.000Z'),
    });
    const tuesdayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-23T08:00:00.000Z'),
    });
    const duplicateTuesdayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-23T09:00:00.000Z'),
    });
    const fridayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-26T08:00:00.000Z'),
    });

    assert.strictEqual(offDayResult.enqueuedRuns, 0);
    assert.strictEqual(tuesdayResult.enqueuedRuns, 1);
    assert.strictEqual(duplicateTuesdayResult.enqueuedRuns, 0);
    assert.strictEqual(fridayResult.enqueuedRuns, 1);

    const runs = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.strictEqual(runs.length, 2);
    assert.deepStrictEqual(
        runs
            .map((run) => run.input.dayOfWeek)
            .filter((dayOfWeek) => typeof dayOfWeek === 'string')
            .sort(),
        ['friday', 'tuesday'],
    );
});

test('biweekly schedule automation respects anchor week', async () => {
    createTestDb();
    const definition = await createAutomationDefinition({
        key: 'test.biweekly-schedule',
        name: 'Biweekly schedule',
        status: 'enabled',
        graph: scheduleLogAutomationGraph({
            frequency: 'biweekly',
            dayOfWeek: 'tuesday',
            anchorDate: '2026-06-01',
            timeZone: 'Europe/Zagreb',
        }),
    });

    const firstWeekResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-02T08:00:00.000Z'),
    });
    const skippedWeekResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-09T08:00:00.000Z'),
    });
    const secondOccurrenceResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-16T08:00:00.000Z'),
    });
    const duplicateSecondOccurrenceResult =
        await enqueueAutomationRunsFromSchedules({
            now: new Date('2026-06-16T09:00:00.000Z'),
        });

    assert.strictEqual(firstWeekResult.enqueuedRuns, 1);
    assert.strictEqual(skippedWeekResult.enqueuedRuns, 0);
    assert.strictEqual(secondOccurrenceResult.enqueuedRuns, 1);
    assert.strictEqual(duplicateSecondOccurrenceResult.enqueuedRuns, 0);

    const runs = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.strictEqual(runs.length, 2);
    assert.deepStrictEqual(
        runs
            .map((run) => run.input.weekOffset)
            .filter((weekOffset) => typeof weekOffset === 'number')
            .sort(),
        [0, 2],
    );
});

test('schedule trigger validates cadence config', () => {
    const invalidTimeZone = validateAutomationGraph(
        scheduleLogAutomationGraph({
            frequency: 'daily',
            timeZone: 'Not/AZone',
        }),
    );
    assert.strictEqual(invalidTimeZone.ok, false);
    assert.ok(
        invalidTimeZone.errors.includes(
            'timeZone must be a valid IANA time zone.',
        ),
    );

    const invalidMonthlyDay = validateAutomationGraph(
        scheduleLogAutomationGraph({
            frequency: 'monthly',
            dayOfMonth: 32,
        }),
    );
    assert.strictEqual(invalidMonthlyDay.ok, false);
    assert.ok(
        invalidMonthlyDay.errors.includes(
            'dayOfMonth must be an integer from 1 to 31.',
        ),
    );

    const invalidWeekday = validateAutomationGraph(
        scheduleLogAutomationGraph({
            frequency: 'weekly',
            daysOfWeek: ['noday'],
        }),
    );
    assert.strictEqual(invalidWeekday.ok, false);
    assert.ok(
        invalidWeekday.errors.includes(
            'daysOfWeek must contain valid weekdays.',
        ),
    );

    const missingBiweeklyAnchor = validateAutomationGraph(
        scheduleLogAutomationGraph({
            frequency: 'biweekly',
            dayOfWeek: 'tuesday',
        }),
    );
    assert.strictEqual(missingBiweeklyAnchor.ok, false);
    assert.ok(
        missingBiweeklyAnchor.errors.includes(
            'anchorDate must be a valid YYYY-MM-DD date.',
        ),
    );
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

test('default farm raised-bed weeding automation stays draft until enabled', async () => {
    createTestDb();

    await ensureDefaultAutomationDefinitions();
    const draftDefinition = await getAutomationDefinitionByKey(
        farmRaisedBedWeedingAutomationKey,
    );
    assert.ok(draftDefinition);
    assert.strictEqual(draftDefinition.status, 'draft');
    assert.strictEqual(
        draftDefinition.triggerModuleKey,
        automationModuleKeys.triggerSchedule,
    );
    assert.deepStrictEqual(
        draftDefinition.metadata.operationEntityId,
        FARM_RAISED_BED_WEEDING_OPERATION_ID,
    );

    const enabledDefinition = await updateAutomationDefinition(
        draftDefinition.id,
        { status: 'enabled' },
    );
    assert.ok(enabledDefinition);

    await ensureDefaultAutomationDefinitions();
    const preservedDefinition = await getAutomationDefinitionByKey(
        farmRaisedBedWeedingAutomationKey,
    );
    assert.ok(preservedDefinition);
    assert.strictEqual(preservedDefinition.status, 'enabled');
});

test('default farm raised-bed weeding automation filters farms and prevents duplicate occurrence operations', async () => {
    createTestDb();
    await createFarm({
        name: 'Automation Weeding Farm A',
        latitude: 45.7,
        longitude: 16.1,
    });
    const deletedFarmId = await createFarm({
        name: 'Automation Weeding Deleted Farm',
        latitude: 45.6,
        longitude: 16.0,
    });
    await storage()
        .update(farms)
        .set({ isDeleted: true })
        .where(eq(farms.id, deletedFarmId));

    const activeFarms = (await getFarms()).filter((farm) => !farm.isDeleted);
    assert.ok(activeFarms.length > 0);

    const { farmRaisedBedWeeding } = await ensureDefaultAutomationDefinitions();
    const enabledDefinition = await updateAutomationDefinition(
        farmRaisedBedWeeding.id,
        { status: 'enabled' },
    );
    assert.ok(enabledDefinition);

    const dryRun = await createAutomationRun({
        automationDefinition: enabledDefinition,
        source: 'test',
        input: biweeklyScheduleRunInput({
            occurrenceDate: '2026-01-05T08:00:00.000Z',
        }),
    });
    assert.ok(dryRun);
    const startedDryRun = await startAutomationRun(dryRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedDryRun);
    const dryRunResult = await executeAutomationRun(startedDryRun);
    assert.strictEqual(dryRunResult.status, 'succeeded');
    const dryRunWithSteps = await getAutomationRunWithSteps(dryRun.id);
    const dryRunActionStep = dryRunWithSteps?.steps.find(
        (step) => step.nodeId === 'create-farm-weeding-operations',
    );
    assert.ok(dryRunActionStep);
    assert.strictEqual(
        dryRunActionStep.output.createdCount,
        activeFarms.length,
    );
    assert.strictEqual(dryRunActionStep.output.skippedCount, 0);

    const firstResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-01-05T08:00:00.000Z'),
    });
    const duplicateResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-01-05T09:00:00.000Z'),
    });
    const offWeekResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-01-12T08:00:00.000Z'),
    });

    assert.strictEqual(firstResult.enqueuedRuns, 1);
    assert.strictEqual(duplicateResult.enqueuedRuns, 0);
    assert.strictEqual(offWeekResult.enqueuedRuns, 0);

    const processResult = await processDueAutomationRuns({
        limit: 10,
        lockedBy: 'automations-test',
    });
    assert.strictEqual(processResult.succeeded, 1);

    const occurrenceStart = new Date('2026-01-05T08:00:00.000Z');
    const occurrenceEnd = addUtcDays(occurrenceStart, 1);
    for (const farm of activeFarms) {
        const farmOperations = await getFarmAcceptedOperationsByScheduleRange({
            farmId: farm.id,
            from: occurrenceStart,
            to: occurrenceEnd,
        });
        const weedingOperations = farmOperations.filter(
            (operation) =>
                operation.entityId === FARM_RAISED_BED_WEEDING_OPERATION_ID,
        );

        assert.strictEqual(weedingOperations.length, 1);
        assert.strictEqual(weedingOperations[0]?.farmId, farm.id);
        assert.strictEqual(weedingOperations[0]?.gardenId, null);
        assert.strictEqual(weedingOperations[0]?.raisedBedId, null);
        assert.strictEqual(weedingOperations[0]?.raisedBedFieldId, null);
    }

    const deletedFarmOperations =
        await getFarmAcceptedOperationsByScheduleRange({
            farmId: deletedFarmId,
            from: occurrenceStart,
            to: occurrenceEnd,
        });
    assert.strictEqual(
        deletedFarmOperations.filter(
            (operation) =>
                operation.entityId === FARM_RAISED_BED_WEEDING_OPERATION_ID,
        ).length,
        0,
    );

    const firstRun = (
        await listAutomationRuns({
            automationDefinitionId: enabledDefinition.id,
        })
    ).find((run) => run.source === 'schedule');
    assert.ok(firstRun);
    assert.strictEqual(firstRun.input.weekOffset, 0);

    const replayRun = await createAutomationRun({
        automationDefinition: enabledDefinition,
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
            from: occurrenceStart,
            to: occurrenceEnd,
        });
        assert.strictEqual(
            farmOperations.filter(
                (operation) =>
                    operation.entityId === FARM_RAISED_BED_WEEDING_OPERATION_ID,
            ).length,
            1,
        );
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

    const run = await getAutomationRunForEvent(definition.id, event.id);
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

test('plant-attributes automation skips replay when target status already exists', async () => {
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
                moduleKey:
                    automationModuleKeys.actionUpdateRaisedBedFieldPlantAttributes,
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

test('generic plant-attributes automation updates status and sowing location together', async () => {
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
                moduleKey: automationModuleKeys.triggerDomainEvent,
                kind: 'trigger' as const,
                position: { x: 0, y: 0 },
                config: {
                    eventType: knownEventTypes.operations.complete,
                },
            },
            {
                id: 'update-plant-attributes',
                moduleKey:
                    automationModuleKeys.actionUpdateRaisedBedFieldPlantAttributes,
                kind: 'action' as const,
                position: { x: 280, y: 0 },
                config: {
                    targetStatus: 'sprouted',
                    targetSowingLocation: 'direct',
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-update-plant-attributes',
                source: 'trigger',
                target: 'update-plant-attributes',
            },
        ],
    };
    const definition = await createAutomationDefinition({
        key: 'test.operation-complete-plant-attributes',
        name: 'Operation completion updates plant attributes',
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
    assert.strictEqual(updatedField?.sowingLocation, 'direct');
    assert.strictEqual(
        updatedField?.plantScheduledDate?.toISOString(),
        scheduledDate,
    );
    assert.strictEqual(
        (
            await getEvents(knownEventTypes.raisedBedFields.plantUpdate, [
                fieldAggregateId,
            ])
        ).length,
        1,
    );
    assert.strictEqual(
        (
            await getEvents(knownEventTypes.raisedBedFields.plantSchedule, [
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
    assert.strictEqual(
        (
            await getEvents(knownEventTypes.raisedBedFields.plantSchedule, [
                fieldAggregateId,
            ])
        ).length,
        1,
    );
});

test('default plant-removal automation marks the operation target removed after verification', async () => {
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

    await ensureDefaultAutomationDefinitions();
    const definition = await getAutomationDefinitionByKey(
        plantRemovalOperationStatusAutomationKey,
    );
    assert.ok(definition);
    assert.strictEqual(
        definition.triggerEventType,
        knownEventTypes.operations.verify,
    );
    assert.deepStrictEqual(
        definition.graph,
        plantRemovalOperationStatusAutomationGraph(),
    );
    assert.deepStrictEqual(definition.metadata, {
        managedBy: 'gredice',
        defaultAutomation: true,
        operationEntityId: 346,
        targetStatus: 'removed',
    });

    const operationId = await createOperation({
        accountId,
        entityId: 346,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
        raisedBedFieldId: field.id,
    });
    await createEvent(
        knownEvents.operations.verifiedV1(operationId.toString(), {
            verifiedBy: 'automations-test',
        }),
    );
    const event = await getLatestEvent(
        knownEventTypes.operations.verify,
        operationId.toString(),
    );
    const run = await getAutomationRunForEvent(definition.id, event.id);
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
    assert.strictEqual(updatedField?.plantStatus, 'removed');
    assert.strictEqual(updatedField?.active, false);
    assert.ok(updatedField?.plantRemovedDate);
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
    const run = await getAutomationRunForEvent(
        definition.id,
        verificationEvent.id,
    );
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

test('seedling transplant watering automation queues 50L waterings for the next two days after verification', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createAutomationRaisedBedContext();
    const fieldAggregateId = `${raisedBedId}|0`;
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(fieldAggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-05-15T08:00:00.000Z',
            sowingLocation: 'greenhouse',
        }),
    );
    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields[0];
    assert.ok(field);

    const verificationDate = new Date('2026-06-01T08:00:00.000Z');
    const firstWateringDate = addUtcDays(verificationDate, 1);
    const secondWateringDate = addUtcDays(verificationDate, 2);
    const preexisting50LWateringId = await createOperation({
        accountId,
        entityId: RAISED_BED_WATERING_50L_OPERATION_ID,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });
    await createEvent(
        knownEvents.operations.scheduledV1(
            preexisting50LWateringId.toString(),
            {
                scheduledDate: firstWateringDate.toISOString(),
            },
        ),
    );
    const preexisting20LWateringId = await createOperation({
        accountId,
        entityId: FREE_WATERING_OPERATION_ID,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });
    await createEvent(
        knownEvents.operations.scheduledV1(
            preexisting20LWateringId.toString(),
            {
                scheduledDate: secondWateringDate.toISOString(),
            },
        ),
    );

    const transplantOperationId = await createOperation({
        accountId,
        entityId: 593,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
        raisedBedFieldId: field.id,
    });
    await createEvent({
        ...knownEvents.operations.verifiedV1(transplantOperationId.toString(), {
            verifiedBy: 'automations-test',
        }),
        createdAt: verificationDate,
    });
    const event = await getLatestEvent(
        knownEventTypes.operations.verify,
        transplantOperationId.toString(),
    );
    const graph = seedlingTransplantWateringAutomationGraph();
    const definition = await createAutomationDefinition({
        key: 'test.seedling-transplant-waterings',
        name: 'Seedling transplant waterings',
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
    assert.deepStrictEqual(
        await getScheduledOperationDates(
            accountId,
            gardenId,
            raisedBedId,
            RAISED_BED_WATERING_50L_OPERATION_ID,
        ),
        [firstWateringDate.toISOString(), secondWateringDate.toISOString()],
    );

    const runWithSteps = await getAutomationRunWithSteps(startedRun.id);
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
        input,
    });
    assert.ok(replayRun);
    const startedReplay = await startAutomationRun(replayRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedReplay);

    const replayResult = await executeAutomationRun(startedReplay);

    assert.strictEqual(replayResult.status, 'skipped');
    assert.deepStrictEqual(
        await getScheduledOperationDates(
            accountId,
            gardenId,
            raisedBedId,
            RAISED_BED_WATERING_50L_OPERATION_ID,
        ),
        [firstWateringDate.toISOString(), secondWateringDate.toISOString()],
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
    await setRaisedBedFieldWeedState({
        level: 'heavy',
        observedAt: new Date(imageDate),
        positionIndex: 1,
        raisedBedId,
        source: 'ai',
    });
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
    assert.strictEqual(Reflect.get(actionStep.output, 'plantedFieldCount'), 1);
    assert.strictEqual(Reflect.get(actionStep.output, 'trackedFieldCount'), 2);
    assert.strictEqual(
        Reflect.get(actionStep.output, 'fieldWeedStateCount'),
        1,
    );
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
    assert.strictEqual(liveResult.enqueuedRuns, 0);
    assert.strictEqual(liveResult.lastEventId, liveEvent.id);
    assert.strictEqual(await getAutomationEventCursor(), liveEvent.id);
    const liveRuns = await listAutomationRuns({ sourceEventId: liveEvent.id });
    assert.ok(liveRuns.length >= 1);
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
    await getAutomationRunForEvent(definition.id, event.id);

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
