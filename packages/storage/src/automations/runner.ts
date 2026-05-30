import {
    advanceAutomationEventCursor,
    claimDueAutomationRuns,
    enqueueAutomationRunsForEvent,
    getAutomationEventCursor,
    getRunnableAutomationEventTypes,
    listDomainEventsAfterId,
    recoverStaleAutomationRuns,
} from '../repositories/automationsRepo';
import { ensureDefaultAutomationDefinitions } from './defaults';
import { executeAutomationRun } from './executor';

const defaultEventBatchLimit = 500;
const defaultRunBatchLimit = 25;
const defaultStaleRunMinutes = 15;

export type AutomationRunnerResult = {
    scannedEvents: number;
    enqueuedRuns: number;
    claimedRuns: number;
    succeeded: number;
    skipped: number;
    failed: number;
    retrying: number;
    recoveredStaleRuns: number;
    failedStaleRuns: number;
};

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

    for (const run of runs) {
        const runResult = await executeAutomationRun(run);
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
    runBatchLimit = defaultRunBatchLimit,
    lockedBy = 'automation-runner',
}: {
    eventBatchLimit?: number;
    runBatchLimit?: number;
    lockedBy?: string;
} = {}): Promise<AutomationRunnerResult> {
    const enqueueResult = await enqueueAutomationRunsFromDomainEvents({
        limit: eventBatchLimit,
    });
    const processResult = await processDueAutomationRuns({
        limit: runBatchLimit,
        lockedBy,
    });

    return {
        scannedEvents: enqueueResult.scannedEvents,
        enqueuedRuns: enqueueResult.enqueuedRuns,
        ...processResult,
    };
}
