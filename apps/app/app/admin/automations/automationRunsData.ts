import 'server-only';

import {
    type AutomationDefinitionRunSummary,
    type AutomationRunStatus,
    listAutomationRuns,
    type SelectAutomationDefinition,
    type SelectAutomationRun,
} from '@gredice/storage';
import type {
    AutomationDefinitionListItem,
    AutomationRunListItem,
    AutomationRunsPage,
} from './types';

export const automationQueuePageSize = 50;
const maxAutomationQueuePageSize = 100;

function dateToIso(value: Date | null) {
    return value ? value.toISOString() : null;
}

export function serializeAutomationRun(
    run: SelectAutomationRun,
): AutomationRunListItem {
    return {
        id: run.id,
        automationDefinitionId: run.automationDefinitionId,
        automationDefinitionKey: run.automationDefinitionKey,
        automationDefinitionName: run.automationDefinitionName,
        source: run.source,
        sourceEventType: run.sourceEventType,
        sourceAggregateId: run.sourceAggregateId,
        parentRunId: run.parentRunId,
        status: run.status,
        dryRun: run.dryRun,
        attempt: run.attempt,
        maxAttempts: run.maxAttempts,
        nextRunAt: run.nextRunAt.toISOString(),
        lockedAt: dateToIso(run.lockedAt),
        lockedBy: run.lockedBy,
        errorMessage: run.errorMessage,
        startedAt: dateToIso(run.startedAt),
        completedAt: dateToIso(run.completedAt),
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
    };
}

export function serializeAutomationDefinition({
    actionSummary,
    definition,
    runSummary,
    triggerSummary,
}: {
    actionSummary: string;
    definition: SelectAutomationDefinition;
    runSummary?: AutomationDefinitionRunSummary;
    triggerSummary: string;
}): AutomationDefinitionListItem {
    return {
        id: definition.id,
        key: definition.key,
        name: definition.name,
        status: definition.status,
        triggerSummary,
        actionSummary,
        latestRun: runSummary?.latestRun
            ? serializeAutomationRun(runSummary.latestRun)
            : null,
        failedRunsCount: runSummary?.failedRunsCount ?? 0,
        updatedAt: definition.updatedAt.toISOString(),
    };
}

function normalizeLimit(limit: number | undefined) {
    if (!limit || !Number.isFinite(limit)) {
        return automationQueuePageSize;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), maxAutomationQueuePageSize);
}

export async function listAutomationRunsPage({
    failedOnly,
    limit,
    offset = 0,
    status,
}: {
    failedOnly?: boolean;
    limit?: number;
    offset?: number;
    status?: AutomationRunStatus | AutomationRunStatus[];
}): Promise<AutomationRunsPage> {
    const pageSize = normalizeLimit(limit);
    const rows = await listAutomationRuns({
        failedOnly,
        status,
        limit: pageSize + 1,
        offset,
    });
    const hasMore = rows.length > pageSize;
    const runs = rows.slice(0, pageSize).map(serializeAutomationRun);

    return {
        runs,
        hasMore,
        nextOffset: hasMore ? offset + pageSize : null,
        pageSize,
    };
}
