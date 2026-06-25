import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
    createEntity,
    createEvent,
    createFarm,
    createOperation,
    createOutletOffer,
    enqueueAutomationRunsFromDomainEvents,
    enqueueAutomationRunsFromSchedules,
    ensureDefaultAutomationDefinitions,
    executeAutomationRun,
    FARM_GREENHOUSE_PLANT_INVENTORY_OPERATION_ID,
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
    getRaisedBedOperationsByScheduleRange,
    greenhouseSeedlingWateringAutomationGraph,
    greenhouseSeedlingWateringAutomationKey,
    knownEvents,
    knownEventTypes,
    listActiveRaisedBedOperationTargets,
    listAutomationDefinitionRunSummaries,
    listAutomationDefinitions,
    listAutomationRuns,
    listEnabledAutomationDefinitionsForEventType,
    monthlyFarmInventoryOperationConfigs,
    monthlyFarmInventoryOperationsAutomationKey,
    operationImagePlantStatusReviewAutomationGraph,
    plantRemovalOperationStatusAutomationGraph,
    plantRemovalOperationStatusAutomationKey,
    processDueAutomationRuns,
    RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
    RAISED_BED_WATERING_50L_OPERATION_ID,
    raisedBedDetailedInspectionAutomationGraph,
    raisedBedDetailedInspectionAutomationKey,
    raisedBedPhotoOperationsAutomationKey,
    raisedBeds,
    recordAutomationRunStep,
    retryFailedAutomationRun,
    seasonalSowedWateringAutomationGraph,
    seedlingTransplantDirectSowingLocationAutomationGraph,
    seedlingTransplantWateringAutomationGraph,
    setRaisedBedFieldWeedState,
    startAutomationRun,
    storage,
    updateAutomationDefinition,
    updateEntity,
    updateRaisedBed,
    upsertEntityType,
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
        farmId,
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

function raisedBedOperationsAutomationGraph({
    entityId,
    acceptOnCreate = true,
}: {
    entityId: number;
    acceptOnCreate?: boolean;
}): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerSchedule,
                position: { x: 0, y: 0 },
                config: {
                    frequency: 'weekly',
                    daysOfWeek: ['tuesday', 'friday'],
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'create-raised-bed-operations',
                kind: 'action',
                moduleKey: automationModuleKeys.actionCreateRaisedBedOperations,
                position: { x: 320, y: 0 },
                config: {
                    entityId,
                    entityTypeName: 'operation',
                    scheduledInDays: 0,
                    acceptOnCreate,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-create-raised-bed-operations',
                source: 'trigger',
                target: 'create-raised-bed-operations',
            },
        ],
    };
}

function addUtcDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}

function weeklyScheduleInput(dateKey: string, dayOfWeek = 'tuesday') {
    return {
        scheduleType: 'weekly',
        frequency: 'weekly',
        triggerModuleKey: automationModuleKeys.triggerSchedule,
        occurrenceKey: `${automationModuleKeys.triggerSchedule}:Europe/Zagreb:weekly:${dateKey}:${dayOfWeek}`,
        occurrenceDate: dateKey,
        dayOfWeek,
        daysOfWeek: ['tuesday', 'friday'],
        intervalWeeks: 1,
        timeZone: 'Europe/Zagreb',
        enqueuedAt: `${dateKey}T08:00:00.000Z`,
    };
}

async function executeManualAutomationRun(
    automationDefinition: Awaited<
        ReturnType<typeof createAutomationDefinition>
    >,
    input: Record<string, unknown>,
    options: { dryRun?: boolean } = {},
) {
    const run = await createAutomationRun({
        automationDefinition,
        source: 'manual',
        dryRun: options.dryRun,
        input,
    });
    assert.ok(run);
    const startedRun = await startAutomationRun(run.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);
    const result = await executeAutomationRun(startedRun);
    const runWithSteps = await getAutomationRunWithSteps(startedRun.id);
    assert.ok(runWithSteps);

    return { result, run: runWithSteps };
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

function greenhouseSeedlingWateringAutomationGraphForEntity(
    entityId: number,
): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerSchedule,
                position: { x: 0, y: 0 },
                config: {
                    frequency: 'daily',
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'create-greenhouse-seedling-waterings',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionCreateGreenhouseSeedlingWateringOperations,
                position: { x: 320, y: 0 },
                config: {
                    entityId,
                    entityTypeName: 'operation',
                    scheduledInDays: 0,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-action',
                source: 'trigger',
                target: 'create-greenhouse-seedling-waterings',
            },
        ],
    };
}

function dailyScheduleRunInput(date: Date, key: string) {
    const occurrenceDate = date.toISOString().slice(0, 10);

    return {
        scheduleType: 'daily',
        frequency: 'daily',
        triggerModuleKey: automationModuleKeys.triggerSchedule,
        occurrenceKey: `${key}:${occurrenceDate}`,
        occurrenceDate,
        timeZone: 'Europe/Zagreb',
        enqueuedAt: date.toISOString(),
    };
}

async function createAutomationRunForMonthlyFarmInventory({
    enqueuedAt,
    referenceDate,
    dryRun = false,
}: {
    enqueuedAt?: Date;
    referenceDate: Date;
    dryRun?: boolean;
}) {
    await ensureDefaultAutomationDefinitions();
    const definition = await getAutomationDefinitionByKey(
        monthlyFarmInventoryOperationsAutomationKey,
    );
    assert.ok(definition);
    const occurrenceDate = referenceDate.toISOString().slice(0, 10);
    const input = {
        scheduleType: 'monthly',
        frequency: 'monthly',
        triggerModuleKey: automationModuleKeys.triggerSchedule,
        occurrenceKey: `test.monthly-farm-inventory-${randomUUID()}:${occurrenceDate}`,
        occurrenceDate,
        timeZone: 'Europe/Zagreb',
        dayOfMonth: referenceDate.getUTCDate(),
        enqueuedAt: (enqueuedAt ?? referenceDate).toISOString(),
    };
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'schedule',
        sourceEventType: automationScheduleEventType,
        sourceAggregateId: input.occurrenceKey,
        dryRun,
        input,
    });
    assert.ok(run);

    const startedRun = await startAutomationRun(run.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);

    const result = await executeAutomationRun(startedRun);
    const runWithSteps = await getAutomationRunWithSteps(startedRun.id);
    const actionStep = runWithSteps?.steps.find(
        (step) =>
            step.nodeId === 'create-inventory-operations' &&
            step.moduleKind === 'action',
    );
    assert.ok(actionStep);

    return {
        result,
        actionOutput: actionStep.output,
    };
}

async function createAutomationRunForDailyGreenhouseWatering({
    entityId,
    enqueuedAt,
    referenceDate,
    dryRun = false,
}: {
    entityId: number;
    enqueuedAt?: Date;
    referenceDate: Date;
    dryRun?: boolean;
}) {
    const definition = await createAutomationDefinition({
        key: `test.greenhouse-seedling-watering-${entityId}-${randomUUID()}`,
        name: 'Greenhouse seedling watering',
        status: 'enabled',
        graph: greenhouseSeedlingWateringAutomationGraphForEntity(entityId),
    });
    const input = dailyScheduleRunInput(
        enqueuedAt ?? referenceDate,
        `test.greenhouse-seedling-watering-${entityId}`,
    );
    input.occurrenceDate = referenceDate.toISOString().slice(0, 10);
    input.occurrenceKey = `test.greenhouse-seedling-watering-${entityId}:${input.occurrenceDate}`;
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'schedule',
        sourceEventType: automationScheduleEventType,
        sourceAggregateId:
            typeof input.occurrenceKey === 'string'
                ? input.occurrenceKey
                : undefined,
        dryRun,
        input,
    });
    assert.ok(run);

    const startedRun = await startAutomationRun(run.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedRun);

    const result = await executeAutomationRun(startedRun);
    const runWithSteps = await getAutomationRunWithSteps(startedRun.id);
    const actionStep = runWithSteps?.steps.find(
        (step) =>
            step.nodeId === 'create-greenhouse-seedling-waterings' &&
            step.moduleKind === 'action',
    );
    assert.ok(actionStep);

    return {
        result,
        actionOutput: actionStep.output,
    };
}

async function createTestPlantSortForOutlet() {
    const entityTypeName = `automation-outlet-plant-sort-${randomUUID()}`;
    await upsertEntityType({
        name: entityTypeName,
        label: 'Automation Outlet Plant Sort',
    });
    const entityId = await createEntity(entityTypeName);
    await updateEntity({
        id: entityId,
        entityTypeName,
        state: 'published',
    });

    return entityId;
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
                    dayOfMonth: 15,
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
        now: new Date('2026-06-14T08:00:00.000Z'),
    });
    const duplicateResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-14T09:00:00.000Z'),
    });
    const offDayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-15T08:00:00.000Z'),
    });

    assert.strictEqual(firstResult.enqueuedRuns, 2);
    assert.strictEqual(duplicateResult.enqueuedRuns, 0);
    assert.strictEqual(offDayResult.enqueuedRuns, 2);

    const runs = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.strictEqual(runs.length, 1);
    assert.strictEqual(runs[0]?.source, 'schedule');
    assert.strictEqual(
        runs[0]?.sourceAggregateId,
        'trigger.scheduleMonthly:Europe/Zagreb:2026-06:day-15',
    );
    assert.strictEqual(runs[0]?.input.occurrenceDate, '2026-06-15');
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
        now: new Date('2026-06-22T08:00:00.000Z'),
    });
    const duplicateResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-22T21:00:00.000Z'),
    });
    const nextDayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-23T08:00:00.000Z'),
    });

    assert.strictEqual(firstResult.enqueuedRuns, 3);
    assert.strictEqual(duplicateResult.enqueuedRuns, 0);
    assert.strictEqual(nextDayResult.enqueuedRuns, 2);

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
    assert.deepStrictEqual(
        runs
            .map((run) => run.input.occurrenceDate)
            .filter((occurrenceDate) => typeof occurrenceDate === 'string')
            .sort(),
        ['2026-06-23', '2026-06-24'],
    );

    await processDueAutomationRuns({
        limit: 10,
        lockedBy: 'automations-test',
    });
    const processedRuns = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.deepStrictEqual(processedRuns.map((run) => run.status).sort(), [
        'succeeded',
        'succeeded',
    ]);
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
        now: new Date('2026-06-21T08:00:00.000Z'),
    });
    const tuesdayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-22T08:00:00.000Z'),
    });
    const duplicateTuesdayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-22T09:00:00.000Z'),
    });
    const fridayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-25T08:00:00.000Z'),
    });

    assert.strictEqual(offDayResult.enqueuedRuns, 1);
    assert.strictEqual(tuesdayResult.enqueuedRuns, 3);
    assert.strictEqual(duplicateTuesdayResult.enqueuedRuns, 0);
    assert.strictEqual(fridayResult.enqueuedRuns, 3);

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
    assert.deepStrictEqual(
        runs
            .map((run) => run.input.occurrenceDate)
            .filter((occurrenceDate) => typeof occurrenceDate === 'string')
            .sort(),
        ['2026-06-23', '2026-06-26'],
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
        now: new Date('2026-06-01T08:00:00.000Z'),
    });
    const skippedWeekResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-08T08:00:00.000Z'),
    });
    const secondOccurrenceResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-15T08:00:00.000Z'),
    });
    const duplicateSecondOccurrenceResult =
        await enqueueAutomationRunsFromSchedules({
            now: new Date('2026-06-15T09:00:00.000Z'),
        });

    assert.strictEqual(firstWeekResult.enqueuedRuns, 3);
    assert.strictEqual(skippedWeekResult.enqueuedRuns, 2);
    assert.strictEqual(secondOccurrenceResult.enqueuedRuns, 3);
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
    assert.deepStrictEqual(
        runs
            .map((run) => run.input.occurrenceDate)
            .filter((occurrenceDate) => typeof occurrenceDate === 'string')
            .sort(),
        ['2026-06-02', '2026-06-16'],
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
    const deletedFarmId = await createFarm({
        name: 'Automation Inventory Deleted Farm',
        latitude: 44.5,
        longitude: 15.1,
    });
    await storage()
        .update(farms)
        .set({ isDeleted: true })
        .where(eq(farms.id, deletedFarmId));
    const activeFarms = (await getFarms()).filter((farm) => !farm.isDeleted);
    const occurrenceDate = new Date('2026-07-01T00:00:00.000Z');
    const enqueuedAt = new Date('2026-06-30T08:00:00.000Z');
    const operationConfigs = monthlyFarmInventoryOperationConfigs;
    const greenhousePlantInventoryOperationConfigs = operationConfigs.filter(
        (operationConfig) =>
            Reflect.get(operationConfig, 'requiresGreenhouseOrOutletPlants') ===
            true,
    );
    const unconditionalOperationConfigs = operationConfigs.filter(
        (operationConfig) =>
            Reflect.get(operationConfig, 'requiresGreenhouseOrOutletPlants') !==
            true,
    );
    assert.deepStrictEqual(
        greenhousePlantInventoryOperationConfigs.map(
            (operationConfig) => operationConfig.entityId,
        ),
        [FARM_GREENHOUSE_PLANT_INVENTORY_OPERATION_ID],
    );
    const expectedSkippedIneligibleCount =
        activeFarms.length * greenhousePlantInventoryOperationConfigs.length;
    const expectedCreatedCount =
        activeFarms.length * unconditionalOperationConfigs.length - 1;
    const preexistingFarm = activeFarms[0];
    assert.ok(preexistingFarm);
    const preexistingOperationId = await createOperation({
        entityId: unconditionalOperationConfigs[0].entityId,
        entityTypeName: unconditionalOperationConfigs[0].entityTypeName,
        farmId: preexistingFarm.id,
        timestamp: occurrenceDate,
    });
    await acceptOperation(preexistingOperationId);
    await ensureDefaultAutomationDefinitions();
    const definition = await getAutomationDefinitionByKey(
        monthlyFarmInventoryOperationsAutomationKey,
    );
    assert.ok(definition);
    const triggerNode = definition.graph.nodes.find(
        (node) => node.kind === 'trigger',
    );
    const actionNode = definition.graph.nodes.find(
        (node) =>
            node.moduleKey ===
            automationModuleKeys.actionCreateFarmInventoryOperations,
    );
    assert.strictEqual(
        triggerNode?.moduleKey,
        automationModuleKeys.triggerSchedule,
    );
    assert.deepStrictEqual(triggerNode?.config, {
        frequency: 'monthly',
        dayOfMonth: 1,
        timeZone: 'Europe/Zagreb',
    });
    assert.deepStrictEqual(actionNode?.config.operations, operationConfigs);

    const enqueueResult = await enqueueAutomationRunsFromSchedules({
        now: enqueuedAt,
    });
    const duplicateResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-30T09:00:00.000Z'),
    });
    const offDayResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-07-01T08:00:00.000Z'),
    });
    assert.strictEqual(enqueueResult.enqueuedRuns, 2);
    assert.strictEqual(duplicateResult.enqueuedRuns, 0);
    assert.strictEqual(offDayResult.enqueuedRuns, 1);

    const [scheduledRun] = await listAutomationRuns({
        automationDefinitionId: definition.id,
    });
    assert.ok(scheduledRun);
    assert.strictEqual(
        scheduledRun.sourceAggregateId,
        'trigger.schedule:Europe/Zagreb:monthly:2026-07:day-1',
    );
    assert.strictEqual(scheduledRun.input.occurrenceDate, '2026-07-01');
    assert.strictEqual(scheduledRun.input.enqueuedAt, enqueuedAt.toISOString());

    const dryRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'test',
        input: scheduledRun.input,
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
        (step) => step.nodeId === 'create-inventory-operations',
    );
    assert.ok(dryRunActionStep);
    assert.strictEqual(
        dryRunActionStep.output.createdCount,
        expectedCreatedCount,
    );
    assert.strictEqual(dryRunActionStep.output.skippedScheduledCount, 1);
    assert.strictEqual(
        dryRunActionStep.output.skippedIneligibleCount,
        expectedSkippedIneligibleCount,
    );
    assert.strictEqual(dryRunActionStep.output.repairedScheduledCount, 1);

    const processResult = await processDueAutomationRuns({
        limit: 10,
        lockedBy: 'automations-test',
    });
    assert.strictEqual(processResult.succeeded, 1);
    assert.strictEqual(processResult.skipped, 2);

    const expectedScheduledDates = unconditionalOperationConfigs.map(
        (operationConfig) =>
            addUtcDays(
                occurrenceDate,
                operationConfig.scheduledInDays,
            ).toISOString(),
    );
    for (const farm of activeFarms) {
        const farmOperations = await getFarmAcceptedOperationsByScheduleRange({
            farmId: farm.id,
            from: occurrenceDate,
            to: addUtcDays(occurrenceDate, 1),
        });
        const inventoryOperations = farmOperations
            .filter((operation) =>
                unconditionalOperationConfigs.some(
                    (operationConfig) =>
                        operationConfig.entityId === operation.entityId,
                ),
            )
            .sort((left, right) => left.entityId - right.entityId);

        assert.strictEqual(
            inventoryOperations.length,
            unconditionalOperationConfigs.length,
            `Expected ${unconditionalOperationConfigs.length} inventory operations for farm ${farm.id}, got ${JSON.stringify(
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

    const deletedFarmOperations =
        await getFarmAcceptedOperationsByScheduleRange({
            farmId: deletedFarmId,
            from: occurrenceDate,
            to: addUtcDays(occurrenceDate, 1),
        });
    assert.strictEqual(deletedFarmOperations.length, 0);

    const scheduledRunWithSteps = await getAutomationRunWithSteps(
        scheduledRun.id,
    );
    const actionStep = scheduledRunWithSteps?.steps.find(
        (step) => step.nodeId === 'create-inventory-operations',
    );
    assert.ok(actionStep);
    assert.strictEqual(actionStep.output.createdCount, expectedCreatedCount);
    assert.strictEqual(actionStep.output.skippedScheduledCount, 1);
    assert.strictEqual(
        actionStep.output.skippedIneligibleCount,
        expectedSkippedIneligibleCount,
    );
    assert.strictEqual(actionStep.output.repairedScheduledCount, 1);

    const replayRun = await createAutomationRun({
        automationDefinition: definition,
        source: 'replay',
        input: scheduledRun.input,
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
            from: occurrenceDate,
            to: addUtcDays(occurrenceDate, 1),
        });
        const inventoryOperations = farmOperations.filter((operation) =>
            unconditionalOperationConfigs.some(
                (operationConfig) =>
                    operationConfig.entityId === operation.entityId,
            ),
        );
        assert.strictEqual(
            inventoryOperations.length,
            unconditionalOperationConfigs.length,
        );
    }
    const replayRunWithSteps = await getAutomationRunWithSteps(replayRun.id);
    const replayActionStep = replayRunWithSteps?.steps.find(
        (step) => step.nodeId === 'create-inventory-operations',
    );
    assert.ok(replayActionStep);
    assert.strictEqual(replayActionStep.output.createdCount, 0);
    assert.strictEqual(
        replayActionStep.output.skippedScheduledCount,
        activeFarms.length * unconditionalOperationConfigs.length,
    );
    assert.strictEqual(
        replayActionStep.output.skippedIneligibleCount,
        expectedSkippedIneligibleCount,
    );
    assert.strictEqual(replayActionStep.output.repairedScheduledCount, 0);
});

test('monthly farm inventory automation creates greenhouse plant inventory for farms with greenhouse fields', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await createFarm({
        name: 'Automation Inventory Greenhouse Farm',
        latitude: 45.8,
        longitude: 15.9,
    });
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Automation Inventory Garden ${accountId}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `automation-inventory-block-${accountId}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const otherFarmId = await createFarm({
        name: 'Automation Inventory No Greenhouse Farm',
        latitude: 46.2,
        longitude: 16.3,
    });
    const fieldAggregateId = `${raisedBedId}|0`;
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(fieldAggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-08-20T08:00:00.000Z',
            sowingLocation: 'greenhouse',
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(fieldAggregateId, {
            status: 'sprouted',
        }),
    );

    const { result, actionOutput } =
        await createAutomationRunForMonthlyFarmInventory({
            referenceDate: new Date('2026-09-01T00:00:00.000Z'),
        });

    assert.strictEqual(result.status, 'succeeded');
    const activeFarmCount = Reflect.get(actionOutput, 'farmCount');
    if (typeof activeFarmCount !== 'number') {
        assert.fail('Expected monthly inventory output to include farmCount.');
    }
    assert.strictEqual(
        Reflect.get(actionOutput, 'skippedIneligibleCount'),
        activeFarmCount - 1,
    );
    assert.strictEqual(Reflect.get(actionOutput, 'activeOutletOfferCount'), 0);

    const farmOperations = await getFarmAcceptedOperationsByScheduleRange({
        farmId,
        from: new Date('2026-09-01T00:00:00.000Z'),
        to: new Date('2026-09-02T00:00:00.000Z'),
    });
    const greenhouseInventoryOperations = farmOperations.filter(
        (operation) =>
            operation.entityId === FARM_GREENHOUSE_PLANT_INVENTORY_OPERATION_ID,
    );
    assert.strictEqual(greenhouseInventoryOperations.length, 1);
    assert.strictEqual(
        greenhouseInventoryOperations[0]?.scheduledDate?.toISOString(),
        '2026-09-01T00:00:00.000Z',
    );

    const otherFarmOperations = await getFarmAcceptedOperationsByScheduleRange({
        farmId: otherFarmId,
        from: new Date('2026-09-01T00:00:00.000Z'),
        to: new Date('2026-09-02T00:00:00.000Z'),
    });
    assert.strictEqual(
        otherFarmOperations.filter(
            (operation) =>
                operation.entityId ===
                FARM_GREENHOUSE_PLANT_INVENTORY_OPERATION_ID,
        ).length,
        0,
    );

    await storage()
        .update(raisedBeds)
        .set({ isDeleted: true })
        .where(eq(raisedBeds.id, raisedBedId));
    await storage()
        .update(farms)
        .set({ isDeleted: true })
        .where(eq(farms.id, farmId));
    await storage()
        .update(farms)
        .set({ isDeleted: true })
        .where(eq(farms.id, otherFarmId));
});

test('monthly farm inventory automation treats active outlet stock as greenhouse plant inventory eligibility', async () => {
    createTestDb();
    const firstFarmId = await createFarm({
        name: 'Automation Inventory Outlet Farm A',
        latitude: 45.9,
        longitude: 16.0,
    });
    const secondFarmId = await createFarm({
        name: 'Automation Inventory Outlet Farm B',
        latitude: 46.0,
        longitude: 16.1,
    });
    const plantSortId = await createTestPlantSortForOutlet();
    await createOutletOffer({
        plantSortId,
        sowingDate: new Date('2026-08-15T00:00:00.000Z'),
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPriceCents: 199,
        comparePriceCents: 349,
        quantity: 4,
        startAt: new Date('2026-08-31T00:00:00.000Z'),
        endAt: new Date('2026-09-02T00:00:00.000Z'),
        status: 'published',
        adminNotes: null,
    });

    const { result, actionOutput } =
        await createAutomationRunForMonthlyFarmInventory({
            referenceDate: new Date('2026-09-01T00:00:00.000Z'),
            enqueuedAt: new Date('2026-08-31T08:00:00.000Z'),
        });

    assert.strictEqual(result.status, 'succeeded');
    assert.strictEqual(Reflect.get(actionOutput, 'activeOutletOfferCount'), 1);
    assert.strictEqual(Reflect.get(actionOutput, 'skippedIneligibleCount'), 0);

    for (const farmId of [firstFarmId, secondFarmId]) {
        const farmOperations = await getFarmAcceptedOperationsByScheduleRange({
            farmId,
            from: new Date('2026-09-01T00:00:00.000Z'),
            to: new Date('2026-09-02T00:00:00.000Z'),
        });
        assert.strictEqual(
            farmOperations.filter(
                (operation) =>
                    operation.entityId ===
                    FARM_GREENHOUSE_PLANT_INVENTORY_OPERATION_ID,
            ).length,
            1,
        );
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
        now: new Date('2026-01-04T08:00:00.000Z'),
    });
    const duplicateResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-01-04T09:00:00.000Z'),
    });
    const offWeekResult = await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-01-11T08:00:00.000Z'),
    });

    assert.strictEqual(firstResult.enqueuedRuns, 2);
    assert.strictEqual(duplicateResult.enqueuedRuns, 0);
    assert.strictEqual(offWeekResult.enqueuedRuns, 1);

    const processResult = await processDueAutomationRuns({
        limit: 10,
        lockedBy: 'automations-test',
    });
    assert.strictEqual(processResult.succeeded, 1);
    assert.strictEqual(processResult.skipped, 2);

    const occurrenceStart = new Date('2026-01-05T00:00:00.000Z');
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
    assert.strictEqual(firstRun.input.occurrenceDate, '2026-01-05');

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

test('default raised-bed photo automation enqueues only Tuesday and Friday occurrences', async () => {
    createTestDb();
    await ensureDefaultAutomationDefinitions();
    const definition = await getAutomationDefinitionByKey(
        raisedBedPhotoOperationsAutomationKey,
    );
    assert.ok(definition);
    assert.strictEqual(definition.status, 'enabled');
    const validation = validateAutomationGraph(definition.graph);
    assert.strictEqual(validation.ok, true);

    const definitions = await listAutomationDefinitions({ limit: 100 });
    for (const candidate of definitions) {
        if (candidate.id !== definition.id) {
            await updateAutomationDefinition(candidate.id, {
                status: 'disabled',
            });
        }
    }
    const getPhotoRunCount = async () =>
        (
            await listAutomationRuns({
                automationDefinitionId: definition.id,
            })
        ).length;

    await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-24T08:00:00.000Z'),
    });
    assert.strictEqual(await getPhotoRunCount(), 0);

    await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-22T08:00:00.000Z'),
    });
    assert.strictEqual(await getPhotoRunCount(), 1);

    await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-22T09:00:00.000Z'),
    });
    assert.strictEqual(await getPhotoRunCount(), 1);

    await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-25T08:00:00.000Z'),
    });
    assert.strictEqual(await getPhotoRunCount(), 2);
});

test('default raised-bed detailed inspection automation stays draft until enabled', async () => {
    createTestDb();

    await ensureDefaultAutomationDefinitions();
    const definition = await getAutomationDefinitionByKey(
        raisedBedDetailedInspectionAutomationKey,
    );

    assert.ok(definition);
    assert.strictEqual(definition.status, 'draft');
    assert.strictEqual(
        definition.triggerModuleKey,
        automationModuleKeys.triggerSchedule,
    );
    assert.deepStrictEqual(
        definition.graph,
        raisedBedDetailedInspectionAutomationGraph(),
    );
    assert.deepStrictEqual(definition.metadata, {
        managedBy: 'gredice',
        defaultAutomation: true,
        operationEntityId: RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
        operationEntityName: 'detailedRaisedBedInspection',
        operationEntityLabel: 'Detaljno pregledavanje gredice',
        dayOfWeek: 'monday',
        timeZone: 'Europe/Zagreb',
        resolvedFromIssue: 3700,
        implementsIssue: 3702,
    });

    const enabledDefinition = await updateAutomationDefinition(definition.id, {
        status: 'enabled',
    });
    assert.ok(enabledDefinition);

    await ensureDefaultAutomationDefinitions();
    const preservedDefinition = await getAutomationDefinitionByKey(
        raisedBedDetailedInspectionAutomationKey,
    );
    assert.ok(preservedDefinition);
    assert.strictEqual(preservedDefinition.status, 'enabled');
});

test('default raised-bed detailed inspection automation creates one weekly operation per active raised bed', async (t) => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Raised-bed inspection ${accountId}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `raised-bed-inspection-${accountId}`,
    );
    const firstActiveRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const secondActiveRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const inactiveRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const abandonedRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const deletedRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const createdRaisedBedIds = [
        firstActiveRaisedBedId,
        secondActiveRaisedBedId,
        inactiveRaisedBedId,
        abandonedRaisedBedId,
        deletedRaisedBedId,
    ];
    t.after(async () => {
        for (const raisedBedId of createdRaisedBedIds) {
            await updateRaisedBed({ id: raisedBedId, status: 'new' }).catch(
                () => undefined,
            );
        }
    });
    await updateRaisedBed({ id: firstActiveRaisedBedId, status: 'active' });
    await updateRaisedBed({ id: secondActiveRaisedBedId, status: 'active' });
    await updateRaisedBed({ id: inactiveRaisedBedId, status: 'new' });
    await updateRaisedBed({ id: abandonedRaisedBedId, status: 'abandoned' });
    await updateRaisedBed({ id: deletedRaisedBedId, status: 'active' });
    await storage()
        .update(raisedBeds)
        .set({ isDeleted: true })
        .where(eq(raisedBeds.id, deletedRaisedBedId));
    const expectedRecipientCount = (await listActiveRaisedBedOperationTargets())
        .length;

    const { raisedBedDetailedInspection } =
        await ensureDefaultAutomationDefinitions();
    const enabledDefinition = await updateAutomationDefinition(
        raisedBedDetailedInspection.id,
        { status: 'enabled' },
    );
    assert.ok(enabledDefinition);

    const definitions = await listAutomationDefinitions({ limit: 100 });
    for (const candidate of definitions) {
        if (candidate.id !== enabledDefinition.id) {
            await updateAutomationDefinition(candidate.id, {
                status: 'disabled',
            });
        }
    }

    const dryRun = await executeManualAutomationRun(
        enabledDefinition,
        {
            ...weeklyScheduleInput('2026-06-22', 'monday'),
            daysOfWeek: ['monday'],
        },
        { dryRun: true },
    );
    assert.strictEqual(dryRun.result.status, 'succeeded');
    const dryRunActionStep = dryRun.run.steps.find(
        (step) =>
            step.moduleKey ===
            automationModuleKeys.actionCreateRaisedBedOperations,
    );
    assert.ok(dryRunActionStep);
    assert.strictEqual(
        Reflect.get(dryRunActionStep.output, 'recipientCount'),
        expectedRecipientCount,
    );
    assert.strictEqual(
        Reflect.get(dryRunActionStep.output, 'skippedExistingCount'),
        0,
    );
    assert.strictEqual(
        Reflect.get(dryRunActionStep.output, 'projectedCreateCount'),
        expectedRecipientCount,
    );

    const getInspectionRunCount = async () =>
        (
            await listAutomationRuns({
                automationDefinitionId: enabledDefinition.id,
            })
        ).filter((run) => run.source === 'schedule').length;

    await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-21T08:00:00.000Z'),
    });
    assert.strictEqual(await getInspectionRunCount(), 1);

    await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-21T09:00:00.000Z'),
    });
    assert.strictEqual(await getInspectionRunCount(), 1);

    await enqueueAutomationRunsFromSchedules({
        now: new Date('2026-06-23T08:00:00.000Z'),
    });
    assert.strictEqual(await getInspectionRunCount(), 1);

    const processResult = await processDueAutomationRuns({
        limit: 10,
        lockedBy: 'automations-test',
    });
    assert.strictEqual(processResult.succeeded, 1);

    const scheduledRun = (
        await listAutomationRuns({
            automationDefinitionId: enabledDefinition.id,
        })
    ).find((run) => run.source === 'schedule');
    assert.ok(scheduledRun);
    assert.strictEqual(scheduledRun.input.occurrenceDate, '2026-06-22');

    const operations = await getRaisedBedOperationsByScheduleRange({
        raisedBedIds: createdRaisedBedIds,
        from: new Date('2026-06-22T00:00:00.000Z'),
        to: new Date('2026-06-23T00:00:00.000Z'),
    });
    const inspectionOperations = operations
        .filter(
            (operation) =>
                operation.entityId ===
                RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
        )
        .sort(
            (left, right) => (left.raisedBedId ?? 0) - (right.raisedBedId ?? 0),
        );

    assert.deepStrictEqual(
        inspectionOperations.map((operation) => operation.raisedBedId),
        [firstActiveRaisedBedId, secondActiveRaisedBedId].sort(
            (left, right) => left - right,
        ),
    );
    assert.ok(inspectionOperations.every((operation) => operation.isAccepted));
    assert.ok(
        inspectionOperations.every(
            (operation) => operation.raisedBedFieldId === null,
        ),
    );
    assert.deepStrictEqual(
        inspectionOperations.map((operation) =>
            operation.scheduledDate?.toISOString(),
        ),
        ['2026-06-22T00:00:00.000Z', '2026-06-22T00:00:00.000Z'],
    );

    const replayRun = await createAutomationRun({
        automationDefinition: enabledDefinition,
        source: 'replay',
        input: scheduledRun.input,
    });
    assert.ok(replayRun);
    const startedReplay = await startAutomationRun(replayRun.id, {
        lockedBy: 'automations-test',
    });
    assert.ok(startedReplay);

    const replayResult = await executeAutomationRun(startedReplay);

    assert.strictEqual(replayResult.status, 'skipped');
    const replayOperations = await getRaisedBedOperationsByScheduleRange({
        raisedBedIds: createdRaisedBedIds,
        from: new Date('2026-06-22T00:00:00.000Z'),
        to: new Date('2026-06-23T00:00:00.000Z'),
    });
    assert.strictEqual(
        replayOperations.filter(
            (operation) =>
                operation.entityId ===
                RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
        ).length,
        2,
    );
});

test('raised-bed operation automation filters inactive deleted and abandoned raised beds', async (t) => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Raised-bed photo filtering ${accountId}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `raised-bed-photo-filtering-${accountId}`,
    );
    const activeRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const secondActiveRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const inactiveRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const abandonedRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const deletedRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const createdRaisedBedIds = [
        activeRaisedBedId,
        secondActiveRaisedBedId,
        inactiveRaisedBedId,
        abandonedRaisedBedId,
        deletedRaisedBedId,
    ];
    t.after(async () => {
        for (const raisedBedId of createdRaisedBedIds) {
            await updateRaisedBed({ id: raisedBedId, status: 'new' }).catch(
                () => undefined,
            );
        }
    });
    await updateRaisedBed({ id: activeRaisedBedId, status: 'active' });
    await updateRaisedBed({ id: secondActiveRaisedBedId, status: 'active' });
    await updateRaisedBed({ id: inactiveRaisedBedId, status: 'new' });
    await updateRaisedBed({ id: abandonedRaisedBedId, status: 'abandoned' });
    await updateRaisedBed({ id: deletedRaisedBedId, status: 'active' });
    await storage()
        .update(raisedBeds)
        .set({ isDeleted: true })
        .where(eq(raisedBeds.id, deletedRaisedBedId));
    const expectedRecipientCount = (await listActiveRaisedBedOperationTargets())
        .length;

    const entityId = 9_920_001;
    const definition = await createAutomationDefinition({
        key: 'test.raised-bed-photo-filtering',
        name: 'Raised-bed photo filtering',
        status: 'enabled',
        graph: raisedBedOperationsAutomationGraph({ entityId }),
    });

    const { result, run } = await executeManualAutomationRun(
        definition,
        weeklyScheduleInput('2026-06-23'),
    );

    assert.strictEqual(result.status, 'succeeded');
    const operations = await getRaisedBedOperationsByScheduleRange({
        raisedBedIds: createdRaisedBedIds,
        from: new Date('2026-06-23T00:00:00.000Z'),
        to: new Date('2026-06-24T00:00:00.000Z'),
    });
    const photoOperations = operations
        .filter((operation) => operation.entityId === entityId)
        .sort(
            (left, right) => (left.raisedBedId ?? 0) - (right.raisedBedId ?? 0),
        );

    assert.deepStrictEqual(
        photoOperations.map((operation) => operation.raisedBedId),
        [activeRaisedBedId, secondActiveRaisedBedId].sort(
            (left, right) => left - right,
        ),
    );
    assert.ok(photoOperations.every((operation) => operation.isAccepted));
    assert.ok(
        photoOperations.every(
            (operation) => operation.raisedBedFieldId === null,
        ),
    );
    assert.deepStrictEqual(
        photoOperations.map((operation) =>
            operation.scheduledDate?.toISOString(),
        ),
        ['2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z'],
    );

    const actionStep = run.steps.find(
        (step) =>
            step.moduleKey ===
            automationModuleKeys.actionCreateRaisedBedOperations,
    );
    assert.ok(actionStep);
    assert.strictEqual(
        Reflect.get(actionStep.output, 'recipientCount'),
        expectedRecipientCount,
    );
    assert.strictEqual(
        Reflect.get(actionStep.output, 'skippedExistingCount'),
        0,
    );
});

test('raised-bed operation automation reports existing skips and prevents duplicates', async (t) => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Raised-bed photo duplicates ${accountId}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `raised-bed-photo-duplicates-${accountId}`,
    );
    const firstRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const secondRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    t.after(async () => {
        await updateRaisedBed({ id: firstRaisedBedId, status: 'new' }).catch(
            () => undefined,
        );
        await updateRaisedBed({ id: secondRaisedBedId, status: 'new' }).catch(
            () => undefined,
        );
    });
    await updateRaisedBed({ id: firstRaisedBedId, status: 'active' });
    await updateRaisedBed({ id: secondRaisedBedId, status: 'active' });
    const expectedRecipientCount = (await listActiveRaisedBedOperationTargets())
        .length;

    const entityId = 9_920_002;
    const scheduledDate = new Date('2026-06-23T00:00:00.000Z');
    const preexistingOperationId = await createOperation({
        entityId,
        entityTypeName: 'operation',
        accountId,
        gardenId,
        raisedBedId: firstRaisedBedId,
        timestamp: scheduledDate,
    });
    await createEvent(
        knownEvents.operations.scheduledV1(preexistingOperationId.toString(), {
            scheduledDate: scheduledDate.toISOString(),
        }),
    );
    const definition = await createAutomationDefinition({
        key: 'test.raised-bed-photo-duplicates',
        name: 'Raised-bed photo duplicates',
        status: 'enabled',
        graph: raisedBedOperationsAutomationGraph({ entityId }),
    });

    const dryRun = await executeManualAutomationRun(
        definition,
        weeklyScheduleInput('2026-06-23'),
        { dryRun: true },
    );
    assert.strictEqual(dryRun.result.status, 'succeeded');
    const dryRunActionStep = dryRun.run.steps.find(
        (step) =>
            step.moduleKey ===
            automationModuleKeys.actionCreateRaisedBedOperations,
    );
    assert.ok(dryRunActionStep);
    assert.strictEqual(
        Reflect.get(dryRunActionStep.output, 'recipientCount'),
        expectedRecipientCount,
    );
    assert.strictEqual(
        Reflect.get(dryRunActionStep.output, 'skippedExistingCount'),
        1,
    );
    assert.strictEqual(
        Reflect.get(dryRunActionStep.output, 'projectedCreateCount'),
        expectedRecipientCount - 1,
    );

    const firstRun = await executeManualAutomationRun(
        definition,
        weeklyScheduleInput('2026-06-23'),
    );
    assert.strictEqual(firstRun.result.status, 'succeeded');

    const replayRun = await executeManualAutomationRun(
        definition,
        weeklyScheduleInput('2026-06-23'),
    );
    assert.strictEqual(replayRun.result.status, 'skipped');
    const replayActionStep = replayRun.run.steps.find(
        (step) =>
            step.moduleKey ===
            automationModuleKeys.actionCreateRaisedBedOperations,
    );
    assert.ok(replayActionStep);
    assert.strictEqual(
        Reflect.get(replayActionStep.output, 'recipientCount'),
        expectedRecipientCount,
    );
    assert.strictEqual(
        Reflect.get(replayActionStep.output, 'skippedExistingCount'),
        expectedRecipientCount,
    );

    const operations = await getRaisedBedOperationsByScheduleRange({
        raisedBedIds: [firstRaisedBedId, secondRaisedBedId],
        from: new Date('2026-06-23T00:00:00.000Z'),
        to: new Date('2026-06-24T00:00:00.000Z'),
    });
    const photoOperations = operations.filter(
        (operation) => operation.entityId === entityId,
    );
    assert.strictEqual(photoOperations.length, 2);
    assert.deepStrictEqual(
        photoOperations
            .map((operation) => operation.raisedBedId)
            .sort((left, right) => (left ?? 0) - (right ?? 0)),
        [firstRaisedBedId, secondRaisedBedId].sort(
            (left, right) => left - right,
        ),
    );
});

test('raised-bed operation automation repairs partial existing operations on retry', async (t) => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Raised-bed photo repair ${accountId}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `raised-bed-photo-repair-${accountId}`,
    );
    const firstRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const secondRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    t.after(async () => {
        await updateRaisedBed({ id: firstRaisedBedId, status: 'new' }).catch(
            () => undefined,
        );
        await updateRaisedBed({ id: secondRaisedBedId, status: 'new' }).catch(
            () => undefined,
        );
    });
    await updateRaisedBed({ id: firstRaisedBedId, status: 'active' });
    await updateRaisedBed({ id: secondRaisedBedId, status: 'active' });
    const expectedRecipientCount = (await listActiveRaisedBedOperationTargets())
        .length;

    const entityId = 9_920_003;
    const scheduledDate = new Date('2026-06-23T00:00:00.000Z');
    const partialOperationId = await createOperation({
        entityId,
        entityTypeName: 'operation',
        accountId,
        gardenId,
        raisedBedId: firstRaisedBedId,
        timestamp: scheduledDate,
    });
    const definition = await createAutomationDefinition({
        key: 'test.raised-bed-photo-repair',
        name: 'Raised-bed photo repair',
        status: 'enabled',
        graph: raisedBedOperationsAutomationGraph({ entityId }),
    });

    const { result, run } = await executeManualAutomationRun(
        definition,
        weeklyScheduleInput('2026-06-23'),
    );

    assert.strictEqual(result.status, 'succeeded');
    const actionStep = run.steps.find(
        (step) =>
            step.moduleKey ===
            automationModuleKeys.actionCreateRaisedBedOperations,
    );
    assert.ok(actionStep);
    assert.strictEqual(
        Reflect.get(actionStep.output, 'recipientCount'),
        expectedRecipientCount,
    );
    assert.strictEqual(
        Reflect.get(actionStep.output, 'skippedExistingCount'),
        1,
    );
    assert.strictEqual(
        Reflect.get(actionStep.output, 'createdCount'),
        expectedRecipientCount - 1,
    );
    assert.deepStrictEqual(
        Reflect.get(actionStep.output, 'repairedAcceptedOperationIds'),
        [partialOperationId],
    );
    assert.deepStrictEqual(
        Reflect.get(actionStep.output, 'repairedScheduledOperationIds'),
        [partialOperationId],
    );

    const operations = await getRaisedBedOperationsByScheduleRange({
        raisedBedIds: [firstRaisedBedId, secondRaisedBedId],
        from: new Date('2026-06-23T00:00:00.000Z'),
        to: new Date('2026-06-24T00:00:00.000Z'),
    });
    const photoOperations = operations.filter(
        (operation) => operation.entityId === entityId,
    );
    assert.strictEqual(photoOperations.length, 2);

    const repairedOperation = photoOperations.find(
        (operation) => operation.id === partialOperationId,
    );
    assert.ok(repairedOperation);
    assert.strictEqual(repairedOperation.isAccepted, true);
    assert.strictEqual(
        repairedOperation.scheduledDate?.toISOString(),
        scheduledDate.toISOString(),
    );
});

test('default greenhouse seedling watering automation is enabled daily', async () => {
    createTestDb();
    await ensureDefaultAutomationDefinitions();

    const definition = await getAutomationDefinitionByKey(
        greenhouseSeedlingWateringAutomationKey,
    );

    assert.ok(definition);
    assert.strictEqual(definition.status, 'enabled');
    assert.strictEqual(
        definition.triggerModuleKey,
        automationModuleKeys.triggerSchedule,
    );
    assert.deepStrictEqual(
        definition.graph,
        greenhouseSeedlingWateringAutomationGraph(),
    );
    assert.deepStrictEqual(definition.metadata, {
        managedBy: 'gredice',
        defaultAutomation: true,
        operationEntityId: 655,
        operationInternalName: 'waterGreenhouseSeedlings',
        operationName: 'Zalijevanje presadnica u stakleniku',
        resolvedFromIssue: 3700,
    });
});

test('greenhouse seedling watering dry run reports no-op farms', async () => {
    createTestDb();
    const entityId = 9_920_001;
    await createFarm({
        name: 'Automation Greenhouse No-op Farm',
        latitude: 45.8,
        longitude: 15.9,
    });
    const { result, actionOutput } =
        await createAutomationRunForDailyGreenhouseWatering({
            entityId,
            referenceDate: new Date('2026-08-01T08:00:00.000Z'),
            dryRun: true,
        });

    assert.strictEqual(result.status, 'succeeded');
    assert.strictEqual(Reflect.get(actionOutput, 'dryRun'), true);
    assert.strictEqual(Reflect.get(actionOutput, 'eligibleFarmCount'), 0);
    assert.strictEqual(Reflect.get(actionOutput, 'projectedCreateCount'), 0);
    assert.strictEqual(
        Reflect.get(actionOutput, 'skippedFarmCount'),
        Reflect.get(actionOutput, 'activeFarmCount'),
    );
    assert.strictEqual(
        Reflect.get(actionOutput, 'existingOperationSkipCount'),
        0,
    );
});

test('greenhouse seedling watering treats active outlet stock as eligible greenhouse care', async () => {
    createTestDb();
    const entityId = 9_920_002;
    const referenceDate = new Date('2026-08-03T08:00:00.000Z');
    await createFarm({
        name: 'Automation Greenhouse Outlet Farm',
        latitude: 45.9,
        longitude: 16.0,
    });
    const plantSortId = await createTestPlantSortForOutlet();
    await createOutletOffer({
        plantSortId,
        sowingDate: new Date('2026-07-20T00:00:00.000Z'),
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPriceCents: 199,
        comparePriceCents: 349,
        quantity: 3,
        startAt: new Date('2026-08-03T00:00:00.000Z'),
        endAt: new Date('2026-08-04T00:00:00.000Z'),
        status: 'published',
        adminNotes: null,
    });

    const { result, actionOutput } =
        await createAutomationRunForDailyGreenhouseWatering({
            entityId,
            referenceDate,
            dryRun: true,
        });

    assert.strictEqual(result.status, 'succeeded');
    assert.strictEqual(Reflect.get(actionOutput, 'activeOutletOfferCount'), 1);
    assert.strictEqual(
        Reflect.get(actionOutput, 'eligibleFarmCount'),
        Reflect.get(actionOutput, 'activeFarmCount'),
    );
    assert.strictEqual(Reflect.get(actionOutput, 'skippedFarmCount'), 0);
    const eligibleFarms = Reflect.get(actionOutput, 'eligibleFarms');
    assert.ok(Array.isArray(eligibleFarms));
    assert.ok(
        eligibleFarms.every((farm) => {
            const reasons =
                farm && typeof farm === 'object'
                    ? Reflect.get(farm, 'reasons')
                    : null;
            return (
                Array.isArray(reasons) && reasons.includes('activeOutletStock')
            );
        }),
    );
});

test('greenhouse seedling watering checks outlet availability at enqueue time', async () => {
    createTestDb();
    const entityId = 9_920_006;
    const occurrenceDate = new Date('2026-10-03T00:00:00.000Z');
    const enqueuedAt = new Date('2026-10-02T22:05:00.000Z');
    await createFarm({
        name: 'Automation Greenhouse Future Outlet Farm',
        latitude: 45.9,
        longitude: 16.0,
    });
    const plantSortId = await createTestPlantSortForOutlet();
    await createOutletOffer({
        plantSortId,
        sowingDate: new Date('2026-09-20T00:00:00.000Z'),
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPriceCents: 199,
        comparePriceCents: 349,
        quantity: 3,
        startAt: new Date('2026-10-03T00:00:00.000Z'),
        endAt: new Date('2026-10-04T00:00:00.000Z'),
        status: 'published',
        adminNotes: null,
    });

    const { actionOutput } =
        await createAutomationRunForDailyGreenhouseWatering({
            entityId,
            referenceDate: occurrenceDate,
            enqueuedAt,
            dryRun: true,
        });

    assert.strictEqual(Reflect.get(actionOutput, 'activeOutletOfferCount'), 0);
    assert.strictEqual(
        Reflect.get(actionOutput, 'outletAvailabilityCheckedAt'),
        enqueuedAt.toISOString(),
    );
    const eligibleFarms = Reflect.get(actionOutput, 'eligibleFarms');
    assert.ok(
        !Array.isArray(eligibleFarms) ||
            eligibleFarms.every((farm) => {
                const reasons =
                    farm && typeof farm === 'object'
                        ? Reflect.get(farm, 'reasons')
                        : null;
                return (
                    !Array.isArray(reasons) ||
                    !reasons.includes('activeOutletStock')
                );
            }),
    );
});

test('greenhouse seedling watering creates one operation for farms with greenhouse fields', async () => {
    createTestDb();
    const entityId = 9_920_003;
    const referenceDate = new Date('2026-08-10T08:00:00.000Z');
    const { farmId, raisedBedId } = await createAutomationRaisedBedContext();
    const fieldAggregateId = `${raisedBedId}|0`;
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(fieldAggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-08-01T08:00:00.000Z',
            sowingLocation: 'greenhouse',
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(fieldAggregateId, {
            status: 'sprouted',
        }),
    );

    const { result, actionOutput } =
        await createAutomationRunForDailyGreenhouseWatering({
            entityId,
            referenceDate,
        });

    assert.strictEqual(result.status, 'succeeded');
    assert.strictEqual(Reflect.get(actionOutput, 'dryRun'), false);
    const eligibleFarms = Reflect.get(actionOutput, 'eligibleFarms');
    assert.ok(Array.isArray(eligibleFarms));
    assert.ok(
        eligibleFarms.some((farm) => {
            if (!farm || typeof farm !== 'object') {
                return false;
            }

            return (
                Reflect.get(farm, 'farmId') === farmId &&
                Reflect.get(farm, 'greenhouseFieldCount') === 1
            );
        }),
    );

    const farmOperations = await getFarmAcceptedOperationsByScheduleRange({
        farmId,
        from: new Date('2026-08-10T00:00:00.000Z'),
        to: new Date('2026-08-11T00:00:00.000Z'),
    });
    const wateringOperations = farmOperations.filter(
        (operation) => operation.entityId === entityId,
    );
    assert.strictEqual(wateringOperations.length, 1);
    assert.strictEqual(wateringOperations[0]?.farmId, farmId);
    assert.strictEqual(
        wateringOperations[0]?.scheduledDate?.toISOString(),
        '2026-08-10T00:00:00.000Z',
    );
});

test('greenhouse seedling watering skips duplicate farm-date operations', async () => {
    createTestDb();
    const entityId = 9_920_004;
    const referenceDate = new Date('2026-08-11T08:00:00.000Z');
    const { farmId, raisedBedId } = await createAutomationRaisedBedContext();
    const fieldAggregateId = `${raisedBedId}|0`;
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(fieldAggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-08-01T08:00:00.000Z',
            sowingLocation: 'greenhouse',
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(fieldAggregateId, {
            status: 'sowed',
        }),
    );
    const existingOperationId = await createOperation({
        entityId,
        entityTypeName: 'operation',
        farmId,
        timestamp: new Date('2026-08-11T00:00:00.000Z'),
    });
    await acceptOperation(existingOperationId);
    await createEvent(
        knownEvents.operations.scheduledV1(existingOperationId.toString(), {
            scheduledDate: '2026-08-11T00:00:00.000Z',
        }),
    );

    const { actionOutput } =
        await createAutomationRunForDailyGreenhouseWatering({
            entityId,
            referenceDate,
        });

    const existingOperationSkips = Reflect.get(
        actionOutput,
        'existingOperationSkips',
    );
    assert.ok(Array.isArray(existingOperationSkips));
    assert.ok(
        existingOperationSkips.some((skip) => {
            if (!skip || typeof skip !== 'object') {
                return false;
            }

            return (
                Reflect.get(skip, 'farmId') === farmId &&
                Reflect.get(skip, 'operationId') === existingOperationId
            );
        }),
    );

    const farmOperations = await getFarmAcceptedOperationsByScheduleRange({
        farmId,
        from: new Date('2026-08-11T00:00:00.000Z'),
        to: new Date('2026-08-12T00:00:00.000Z'),
    });
    const wateringOperations = farmOperations.filter(
        (operation) => operation.entityId === entityId,
    );
    assert.deepStrictEqual(
        wateringOperations.map((operation) => operation.id),
        [existingOperationId],
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
