export type StatusLevel = 'operational' | 'degraded' | 'down' | 'unknown';

export type DefaultService = {
    id: string;
    name: string;
    url: string;
};

export type ChecklyCredentials = {
    accountId: string;
    apiKey: string;
};

export type ChecklyAccountSummary = {
    id: string;
};

export type CheckSummary = {
    checkType: string | null;
    id: string;
};

export type CheckDetails = CheckSummary & {
    name: string;
    tags: string[];
    url: string | null;
};

export type CheckStatus = {
    checkId: string;
    hasErrors: boolean | null;
    hasFailures: boolean | null;
    isDegraded: boolean | null;
    lastCheckRunId: string | null;
    lastRunLocation: string | null;
    longestRun: number | null;
    name: string;
    shortestRun: number | null;
    sslDaysRemaining: number | null;
    updatedAt: string | null;
};

export type CheckHistoryItem = {
    id: string;
    responseTime: number | null;
    startedAt: string | null;
    status: StatusLevel;
};

export type ServiceStatusItem = {
    checkId: string | null;
    checkType: string | null;
    hasErrors: boolean | null;
    hasFailures: boolean | null;
    history: CheckHistoryItem[];
    id: string;
    isDegraded: boolean | null;
    lastCheckRunId: string | null;
    lastRunLocation: string | null;
    longestRun: number | null;
    name: string;
    shortestRun: number | null;
    sslDaysRemaining: number | null;
    status: StatusLevel;
    updatedAt: string | null;
    url: string | null;
};

export type StatusPageData = {
    isConfigured: boolean;
    overallStatus: StatusLevel;
    services: ServiceStatusItem[];
    sourceError: string | null;
    statusTag: string;
    updatedAt: string;
};
