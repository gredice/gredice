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
import { automationModuleKeys, getMonthlyScheduleOccurrence } from './modules';

const defaultEventBatchLimit = 500;
const defaultRunBatchLimit = 25;
const defaultStaleRunMinutes = 15;

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
};

export async function enqueueAutomationRunsFromSchedules({
    now = new Date(),
    limit = 500,
}: {
    now?: Date;
    limit?: number;
} = {}) {
    await ensureDefaultAutomationDefinitions();
    const definitions = await listEnabledAutomationDefinitionsForTriggerModule(
        automationModuleKeys.triggerScheduleMonthly,
    );
    let enqueuedRuns = 0;

    for (const definition of definitions.slice(0, limit)) {
        const trigger = definition.graph.nodes.find(
            (node) =>
                node.kind === 'trigger' &&
                node.moduleKey === automationModuleKeys.triggerScheduleMonthly,
        );
        if (!trigger) {
            continue;
        }

        const occurrence = getMonthlyScheduleOccurrence(trigger, now);
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
    lockedBy = 'automation-runner',
}: {
    limit?: number;
    lockedBy?: string;
} = {}) {
    const staleBefore = new Date(
        Date.now() - defaultStaleRunMinutes * 60 * 1000,
    );
    const staleResult = await recoverStaleAutomationRuns({ staleBefore });
    const runs = await claimDueAutomationRuns({ limit, lockedBy });
    const result = {
        claimedRuns: runs.length,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        retrying: 0,
        recoveredStaleRuns: staleResult.recovered,
        failedStaleRuns: staleResult.failed,
    };

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

    return result;
}

export async function runAutomations({
    eventBatchLimit = defaultEventBatchLimit,
    scheduleBatchLimit,
    runBatchLimit = defaultRunBatchLimit,
    lockedBy = 'automation-runner',
}: {
    eventBatchLimit?: number;
    scheduleBatchLimit?: number;
    runBatchLimit?: number;
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
