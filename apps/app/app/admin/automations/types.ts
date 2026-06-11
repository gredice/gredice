import type {
    AutomationDefinitionStatus,
    AutomationRunSource,
    AutomationRunStatus,
} from '@gredice/storage';

export type AutomationRunListItem = {
    id: number;
    automationDefinitionId: number;
    automationDefinitionKey: string;
    automationDefinitionName: string;
    source: AutomationRunSource;
    sourceEventType: string | null;
    sourceAggregateId: string | null;
    parentRunId: number | null;
    status: AutomationRunStatus;
    dryRun: boolean;
    attempt: number;
    maxAttempts: number;
    nextRunAt: string;
    lockedAt: string | null;
    lockedBy: string | null;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type AutomationRunsPage = {
    runs: AutomationRunListItem[];
    hasMore: boolean;
    nextOffset: number | null;
    pageSize: number;
};

export type AutomationDefinitionListItem = {
    id: number;
    key: string;
    name: string;
    status: AutomationDefinitionStatus;
    triggerSummary: string;
    actionSummary: string;
    updatedAt: string;
};
