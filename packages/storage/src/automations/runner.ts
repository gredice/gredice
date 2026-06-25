import {
    advanceAutomationEventCursor,
    claimDueAutomationRuns,
    createAutomationRun,
    enqueueAutomationRunsForEvent,
    getAutomationEventCursor,
    getRunnableAutomationEventTypes,
    listDomainEventsAfterId,
    listEnabledAutomationDefinitionsForTriggerModule,
    recoverStaleAutomationRuns,
} from '../repositories/automationsRepo';
import { ensureDefaultAutomationDefinitions } from './defaults';
import { executeAutomationRun } from './executor';
import {
    automationModuleKeys,
    getScheduleOccurrence,
    isScheduleTriggerModuleKey,
} from './modules';

const defaultEventBatchLimit = 500;
const defaultRunBatchLimit = 25;
const defaultRunMaxBatches = 10;
const defaultRunMaxDurationMs = 45_000;
const defaultRunMinRemainingMs = 5_000;
const defaultStaleRunMinutes = 15;

export type AutomationProcessingStopReason =
    | 'queue_empty'
    | 'time_budget'
    | 'batch_limit';

type AutomationProcessingResult = {
    claimedRuns: number;
    succeeded: number;
    skipped: number;
    failed: number;
    retrying: number;
    recoveredStaleRuns: number;
    failedStaleRuns: number;
    processedBatches: number;
    processingDurationMs: number;
    processingTimeBudgetMs: number;
    processingStopReason: AutomationProcessingStopReason;
};

export type AutomationRunnerResult = {
    scannedEvents: number;
    scannedSchedules: number;
    enqueuedRuns: number;
    enqueuedEventRuns: number;
    enqueuedScheduledRuns: number;
    claimedRuns: number;
    succeeded: number;
    skipped: number;
    failed: number;
    retrying: number;
    recoveredStaleRuns: number;
    failedStaleRuns: number;
    processedBatches: number;
    processingDurationMs: number;
    processingTimeBudgetMs: number;
    processingStopReason: AutomationProcessingStopReason;
};

export async function enqueueAutomationRunsFromSchedules({
    now = new Date(),
    limit = 500,
}: {
    now?: Date;
    limit?: number;
} = {}) {
    await ensureDefaultAutomationDefinitions();
    const scheduleDefinitions = await Promise.all(
        [
            automationModuleKeys.triggerSchedule,
            automationModuleKeys.triggerScheduleMonthly,
        ].map((triggerModuleKey) =>
            listEnabledAutomationDefinitionsForTriggerModule(triggerModuleKey),
        ),
    );
    const definitions = Array.from(
        new Map(
            scheduleDefinitions
                .flat()
                .map((definition) => [definition.id, definition]),
        ).values(),
    );
    let enqueuedRuns = 0;

    for (const definition of definitions.slice(0, limit)) {
        const trigger = definition.graph.nodes.find(
            (node) =>
                node.kind === 'trigger' &&
                isScheduleTriggerModuleKey(node.moduleKey),
        );
        if (!trigger) {
            continue;
        }

        const occurrence = getScheduleOccurrence(trigger, now);
        if (!occurrence) {
            continue;
        }

        const run = await createAutomationRun({
            automationDefinition: definition,
            source: 'schedule',
            sourceEventType: occurrence.eventType,
            sourceAggregateId: occurrence.aggregateId,
            input: occurrence.input,
        });

        if (run) {
            enqueuedRuns += 1;
        }
    }

    return {
        scannedSchedules: Math.min(definitions.length, limit),
        enqueuedRuns,
    };
}

export async function enqueueAutomationRunsFromDomainEvents({
    limit = defaultEventBatchLimit,
}: {
    limit?: number;
} = {}) {
    await ensureDefaultAutomationDefinitions();
    const [cursor, eventTypes] = await Promise.all([
        getAutomationEventCursor(),
        getRunnableAutomationEventTypes(),
    ]);
    if (eventTypes.length === 0) {
        return {
            scannedEvents: 0,
            enqueuedRuns: 0,
            lastEventId: cursor,
        };
    }

    const events = await listDomainEventsAfterId({
        afterEventId: cursor,
        eventTypes,
        limit,
    });
    let enqueuedRuns = 0;
    let lastEventId = cursor;

    for (const event of events) {
        const runs = await enqueueAutomationRunsForEvent(event);
        enqueuedRuns += runs.length;
        lastEventId = Math.max(lastEventId, event.id);
    }

    if (lastEventId > cursor) {
        await advanceAutomationEventCursor({ lastEventId });
    }

    return {
        scannedEvents: events.length,
        enqueuedRuns,
        lastEventId,
    };
}

export async function processDueAutomationRuns({
    limit = defaultRunBatchLimit,
    maxBatches = defaultRunMaxBatches,
    maxDurationMs = defaultRunMaxDurationMs,
    minRemainingMs = defaultRunMinRemainingMs,
    lockedBy = 'automation-runner',
    getTimeMs = Date.now,
}: {
    limit?: number;
    maxBatches?: number;
    maxDurationMs?: number;
    minRemainingMs?: number;
    lockedBy?: string;
    getTimeMs?: () => number;
} = {}) {
    const startedAtMs = getTimeMs();
    const safeLimit = Math.max(0, Math.floor(limit));
    const safeMaxBatches = Math.max(0, Math.floor(maxBatches));
    const safeMaxDurationMs = Math.max(0, maxDurationMs);
    const safeMinRemainingMs = Math.max(0, minRemainingMs);
    const staleBefore = new Date(
        Date.now() - defaultStaleRunMinutes * 60 * 1000,
    );
    const staleResult = await recoverStaleAutomationRuns({ staleBefore });
    const result: AutomationProcessingResult = {
        claimedRuns: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        retrying: 0,
        recoveredStaleRuns: staleResult.recovered,
        failedStaleRuns: staleResult.failed,
        processedBatches: 0,
        processingDurationMs: 0,
        processingTimeBudgetMs: safeMaxDurationMs,
        processingStopReason: 'queue_empty',
    };

    let currentTimeMs = getTimeMs();
    result.processingDurationMs = Math.max(0, currentTimeMs - startedAtMs);
    let lastBatchDurationMs = 0;

    while (safeLimit > 0 && result.processedBatches < safeMaxBatches) {
        if (result.processedBatches > 0) {
            const elapsedMs = Math.max(0, currentTimeMs - startedAtMs);
            const estimatedNextBatchMs = Math.max(lastBatchDurationMs, 1);
            if (
                elapsedMs + estimatedNextBatchMs + safeMinRemainingMs >
                safeMaxDurationMs
            ) {
                result.processingStopReason = 'time_budget';
                break;
            }
        }

        const batchStartedAtMs = currentTimeMs;
        const runs = await claimDueAutomationRuns({
            limit: safeLimit,
            lockedBy,
        });

        if (runs.length === 0) {
            result.processingStopReason = 'queue_empty';
            break;
        }

        result.claimedRuns += runs.length;
        result.processedBatches += 1;

        const runResults = await Promise.all(
            runs.map((run) => executeAutomationRun(run)),
        );

        for (const runResult of runResults) {
            if (runResult.status === 'succeeded') {
                result.succeeded += 1;
            } else if (runResult.status === 'skipped') {
                result.skipped += 1;
            } else if (runResult.status === 'retrying') {
                result.retrying += 1;
            } else {
                result.failed += 1;
            }
        }

        currentTimeMs = getTimeMs();
        lastBatchDurationMs = Math.max(0, currentTimeMs - batchStartedAtMs);
        result.processingDurationMs = Math.max(0, currentTimeMs - startedAtMs);
    }

    if (
        safeLimit > 0 &&
        result.processedBatches >= safeMaxBatches &&
        result.processingStopReason === 'queue_empty'
    ) {
        result.processingStopReason = 'batch_limit';
    }

    return result;
}

export async function runAutomations({
    eventBatchLimit = defaultEventBatchLimit,
    scheduleBatchLimit,
    runBatchLimit = defaultRunBatchLimit,
    runMaxBatches = defaultRunMaxBatches,
    runMaxDurationMs = defaultRunMaxDurationMs,
    runMinRemainingMs = defaultRunMinRemainingMs,
    lockedBy = 'automation-runner',
}: {
    eventBatchLimit?: number;
    scheduleBatchLimit?: number;
    runBatchLimit?: number;
    runMaxBatches?: number;
    runMaxDurationMs?: number;
    runMinRemainingMs?: number;
    lockedBy?: string;
} = {}): Promise<AutomationRunnerResult> {
    const scheduleResult = await enqueueAutomationRunsFromSchedules({
        limit: scheduleBatchLimit,
    });
    const enqueueResult = await enqueueAutomationRunsFromDomainEvents({
        limit: eventBatchLimit,
    });
    const processResult = await processDueAutomationRuns({
        limit: runBatchLimit,
        maxBatches: runMaxBatches,
        maxDurationMs: runMaxDurationMs,
        minRemainingMs: runMinRemainingMs,
        lockedBy,
    });

    return {
        scannedEvents: enqueueResult.scannedEvents,
        scannedSchedules: scheduleResult.scannedSchedules,
        enqueuedRuns: enqueueResult.enqueuedRuns + scheduleResult.enqueuedRuns,
        enqueuedEventRuns: enqueueResult.enqueuedRuns,
        enqueuedScheduledRuns: scheduleResult.enqueuedRuns,
        ...processResult,
    };
}
