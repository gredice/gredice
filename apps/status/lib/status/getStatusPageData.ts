import 'server-only';
import { defaultServices } from './defaultServices';
import type {
    CheckDetails,
    CheckHistoryItem,
    ChecklyAccountSummary,
    ChecklyCredentials,
    CheckStatus,
    CheckSummary,
    ServiceStatusItem,
    StatusLevel,
    StatusPageData,
} from './types';

const CHECKLY_API_BASE_URL = 'https://api.checklyhq.com';
const CHECKLY_CHECKS_PAGE_SIZE = 100;
const DEFAULT_STATUS_TAG = 'gredice-status';

export async function getStatusPageData(): Promise<StatusPageData> {
    const updatedAt = new Date().toISOString();
    const statusTag =
        readOptionalEnv('CHECKLY_STATUS_TAG') ?? DEFAULT_STATUS_TAG;
    const apiKey = readOptionalEnv('CHECKLY_API_KEY');

    if (!apiKey) {
        return {
            isConfigured: false,
            overallStatus: 'unknown',
            services: createUnknownServices(),
            sourceError:
                'CHECKLY_API_KEY is not configured for this deployment.',
            statusTag,
            updatedAt,
        };
    }

    try {
        const credentials = await getCredentials(apiKey);

        if (!credentials) {
            return {
                isConfigured: true,
                overallStatus: 'unknown',
                services: createUnknownServices(),
                sourceError:
                    'Unable to resolve a Checkly account for this API key.',
                statusTag,
                updatedAt,
            };
        }

        const checks = await listDetailedChecks(credentials, statusTag);

        if (checks.length === 0) {
            return {
                isConfigured: true,
                overallStatus: 'unknown',
                services: createUnknownServices(),
                sourceError: `No Checkly checks found with tag "${statusTag}".`,
                statusTag,
                updatedAt,
            };
        }

        const checkStatuses = await listCheckStatuses(credentials).catch(
            (error: unknown) => {
                if (isChecklyNotFoundError(error)) {
                    return [];
                }

                throw error;
            },
        );
        const statusByCheckId = new Map(
            checkStatuses.map((status) => [status.checkId, status]),
        );
        const historiesByCheckId = await listCheckHistories(
            credentials,
            checks,
        );
        const services = checks.map((check) =>
            createServiceStatus(
                check,
                statusByCheckId.get(check.id) ?? null,
                historiesByCheckId.get(check.id) ?? [],
            ),
        );

        return {
            isConfigured: true,
            overallStatus: getOverallStatus(services),
            services,
            sourceError: null,
            statusTag,
            updatedAt,
        };
    } catch (error) {
        return {
            isConfigured: true,
            overallStatus: 'unknown',
            services: createUnknownServices(),
            sourceError: getSafeErrorMessage(error),
            statusTag,
            updatedAt,
        };
    }
}

async function getCredentials(
    apiKey: string,
): Promise<ChecklyCredentials | null> {
    const accountId = readOptionalEnv('CHECKLY_ACCOUNT_ID');

    if (accountId) {
        return { accountId, apiKey };
    }

    const accounts = await listAccounts(apiKey);
    const [account] = accounts;

    if (!account) {
        return null;
    }

    return {
        accountId: account.id,
        apiKey,
    };
}

async function listDetailedChecks(
    credentials: ChecklyCredentials,
    statusTag: string,
): Promise<CheckDetails[]> {
    const summaries = await listCheckSummaries(credentials, statusTag);
    const checks = await Promise.all(
        summaries.map((summary) => retrieveCheck(credentials, summary.id)),
    );

    return checks
        .filter((check) => check !== null)
        .sort(
            (a, b) =>
                getServiceOrder(a) - getServiceOrder(b) ||
                a.name.localeCompare(b.name),
        );
}

async function listCheckSummaries(
    credentials: ChecklyCredentials,
    statusTag: string,
): Promise<CheckSummary[]> {
    const results: CheckSummary[] = [];
    let page = 1;

    while (true) {
        const params = new URLSearchParams({
            applyGroupSettings: 'true',
            limit: CHECKLY_CHECKS_PAGE_SIZE.toString(),
            page: page.toString(),
        });

        if (statusTag) {
            params.append('tag', statusTag);
        }

        const payload = await fetchChecklyJson(
            `/v1/checks?${params.toString()}`,
            credentials,
        );
        const summaries = parseArray(payload, parseCheckSummary);

        results.push(...summaries);

        if (summaries.length < CHECKLY_CHECKS_PAGE_SIZE) {
            return results;
        }

        page += 1;
    }
}

async function retrieveCheck(
    credentials: ChecklyCredentials,
    checkId: string,
): Promise<CheckDetails | null> {
    const payload = await fetchChecklyJson(
        `/v1/checks/${encodeURIComponent(checkId)}?applyGroupSettings=true`,
        credentials,
    );

    return parseCheckDetails(payload);
}

async function listCheckStatuses(
    credentials: ChecklyCredentials,
): Promise<CheckStatus[]> {
    const payload = await fetchChecklyJson('/v1/check-statuses', credentials);

    return parseArray(payload, parseCheckStatus);
}

async function listCheckHistories(
    credentials: ChecklyCredentials,
    checks: CheckDetails[],
): Promise<Map<string, CheckHistoryItem[]>> {
    const entries = await Promise.all(
        checks.map(async (check) => {
            const history = await listCheckHistory(credentials, check.id).catch(
                () => [],
            );

            return [check.id, history] as const;
        }),
    );

    return new Map(entries);
}

async function listCheckHistory(
    credentials: ChecklyCredentials,
    checkId: string,
): Promise<CheckHistoryItem[]> {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 24 * 60 * 60;
    const params = new URLSearchParams({
        from: from.toString(),
        limit: '12',
        resultType: 'FINAL',
        to: now.toString(),
    });
    const payload = await fetchChecklyJson(
        `/v2/check-results/${encodeURIComponent(checkId)}?${params.toString()}`,
        credentials,
    );
    const entries = readUnknownArray(payload, 'entries');

    return entries.map(parseCheckHistoryItem).filter((item) => item !== null);
}

async function listAccounts(apiKey: string): Promise<ChecklyAccountSummary[]> {
    const response = await fetch(`${CHECKLY_API_BASE_URL}/v1/accounts`, {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        next: {
            revalidate: 3600,
        },
    });

    assertChecklyResponse(response);

    const payload: unknown = await response.json();

    return parseArray(payload, parseAccountSummary);
}

async function fetchChecklyJson(
    path: string,
    credentials: ChecklyCredentials,
): Promise<unknown> {
    const response = await fetch(`${CHECKLY_API_BASE_URL}${path}`, {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${credentials.apiKey}`,
            'X-Checkly-Account': credentials.accountId,
        },
        next: {
            revalidate: 60,
        },
    });

    assertChecklyResponse(response);

    const payload: unknown = await response.json();
    return payload;
}

function createUnknownServices(): ServiceStatusItem[] {
    return defaultServices.map((service) => ({
        checkId: null,
        checkType: null,
        hasErrors: null,
        hasFailures: null,
        history: [],
        id: service.id,
        isDegraded: null,
        lastCheckRunId: null,
        lastRunLocation: null,
        longestRun: null,
        name: service.name,
        shortestRun: null,
        sslDaysRemaining: null,
        status: 'unknown',
        updatedAt: null,
        url: service.url,
    }));
}

function createServiceStatus(
    check: CheckDetails,
    status: CheckStatus | null,
    history: CheckHistoryItem[],
): ServiceStatusItem {
    const defaultService = findDefaultService(check);

    return {
        checkId: check.id,
        checkType: check.checkType,
        hasErrors: status?.hasErrors ?? null,
        hasFailures: status?.hasFailures ?? null,
        history,
        id: defaultService?.id ?? check.id,
        isDegraded: status?.isDegraded ?? null,
        lastCheckRunId: status?.lastCheckRunId ?? null,
        lastRunLocation: status?.lastRunLocation ?? null,
        longestRun: status?.longestRun ?? null,
        name: defaultService?.name ?? check.name,
        shortestRun: status?.shortestRun ?? null,
        sslDaysRemaining: status?.sslDaysRemaining ?? null,
        status: getServiceStatus(status),
        updatedAt: status?.updatedAt ?? history[0]?.startedAt ?? null,
        url: check.url,
    };
}

function getServiceOrder(check: CheckDetails) {
    const serviceIndex = defaultServices.findIndex((service) =>
        urlsShareHost(service.url, check.url),
    );

    return serviceIndex === -1 ? Number.MAX_SAFE_INTEGER : serviceIndex;
}

function findDefaultService(check: CheckDetails) {
    return defaultServices.find(
        (service) =>
            urlsShareHost(service.url, check.url) ||
            namesReferToSameService(service.id, check.name),
    );
}

function urlsShareHost(left: string, right: string | null) {
    if (!right) {
        return false;
    }

    try {
        return new URL(left).hostname === new URL(right).hostname;
    } catch {
        return false;
    }
}

function namesReferToSameService(serviceId: string, checkName: string) {
    const normalizedName = checkName.toLowerCase();

    if (serviceId === 'www') {
        return normalizedName.includes('www');
    }

    return normalizedName.includes(serviceId);
}

function getServiceStatus(status: CheckStatus | null): StatusLevel {
    if (!status) {
        return 'unknown';
    }

    if (status.hasErrors || status.hasFailures) {
        return 'down';
    }

    if (status.isDegraded) {
        return 'degraded';
    }

    return 'operational';
}

function getOverallStatus(services: ServiceStatusItem[]): StatusLevel {
    if (services.length === 0) {
        return 'unknown';
    }

    if (services.some((service) => service.status === 'down')) {
        return 'down';
    }

    if (services.some((service) => service.status === 'degraded')) {
        return 'degraded';
    }

    if (services.every((service) => service.status === 'operational')) {
        return 'operational';
    }

    return 'unknown';
}

function parseCheckSummary(value: unknown): CheckSummary | null {
    const id = readString(value, 'id');
    const checkType = readString(value, 'checkType');

    if (!id) {
        return null;
    }

    return {
        checkType,
        id,
    };
}

function parseAccountSummary(value: unknown): ChecklyAccountSummary | null {
    const id = readString(value, 'id');

    if (!id) {
        return null;
    }

    return { id };
}

function parseCheckDetails(value: unknown): CheckDetails | null {
    const id = readString(value, 'id');
    const name = readString(value, 'name');

    if (!id || !name) {
        return null;
    }

    const request = readRecord(value, 'request');

    return {
        checkType: readString(value, 'checkType'),
        id,
        name,
        tags: readStringArray(value, 'tags'),
        url: request ? readString(request, 'url') : null,
    };
}

function parseCheckStatus(value: unknown): CheckStatus | null {
    const checkId = readString(value, 'checkId');

    if (!checkId) {
        return null;
    }

    return {
        checkId,
        hasErrors: readBoolean(value, 'hasErrors'),
        hasFailures: readBoolean(value, 'hasFailures'),
        isDegraded: readBoolean(value, 'isDegraded'),
        lastCheckRunId: readString(value, 'lastCheckRunId'),
        lastRunLocation: readString(value, 'lastRunLocation'),
        longestRun: readNumber(value, 'longestRun'),
        name: readString(value, 'name') ?? checkId,
        shortestRun: readNumber(value, 'shortestRun'),
        sslDaysRemaining: readNumber(value, 'sslDaysRemaining'),
        updatedAt: readString(value, 'updated_at'),
    };
}

function parseCheckHistoryItem(value: unknown): CheckHistoryItem | null {
    const id = readString(value, 'id');

    if (!id) {
        return null;
    }

    return {
        id,
        responseTime: readNumber(value, 'responseTime'),
        startedAt:
            readString(value, 'startedAt') ?? readString(value, 'created_at'),
        status: getServiceStatus({
            checkId: '',
            hasErrors: readBoolean(value, 'hasErrors'),
            hasFailures: readBoolean(value, 'hasFailures'),
            isDegraded: readBoolean(value, 'isDegraded'),
            lastCheckRunId: null,
            lastRunLocation: null,
            longestRun: null,
            name: '',
            shortestRun: null,
            sslDaysRemaining: null,
            updatedAt: null,
        }),
    };
}

function parseArray<T>(
    value: unknown,
    parseItem: (item: unknown) => T | null,
): T[] {
    if (!Array.isArray(value)) {
        throw new Error('Checkly returned an unexpected response shape.');
    }

    const results: T[] = [];

    for (const item of value) {
        const result = parseItem(item);

        if (result) {
            results.push(result);
        }
    }

    return results;
}

function readUnknownArray(value: unknown, key: string): unknown[] {
    if (!isRecord(value)) {
        return [];
    }

    const child = value[key];

    if (!Array.isArray(child)) {
        return [];
    }

    return child;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(
    value: unknown,
    key: string,
): Record<string, unknown> | null {
    if (!isRecord(value)) {
        return null;
    }

    const child = value[key];

    if (!isRecord(child)) {
        return null;
    }

    return child;
}

function readString(value: unknown, key: string): string | null {
    if (!isRecord(value)) {
        return null;
    }

    const child = value[key];

    if (typeof child !== 'string' || child.trim() === '') {
        return null;
    }

    return child;
}

function readBoolean(value: unknown, key: string): boolean | null {
    if (!isRecord(value)) {
        return null;
    }

    const child = value[key];

    if (typeof child !== 'boolean') {
        return null;
    }

    return child;
}

function readNumber(value: unknown, key: string): number | null {
    if (!isRecord(value)) {
        return null;
    }

    const child = value[key];

    if (typeof child !== 'number' || !Number.isFinite(child)) {
        return null;
    }

    return child;
}

function readStringArray(value: unknown, key: string): string[] {
    if (!isRecord(value)) {
        return [];
    }

    const child = value[key];

    if (!Array.isArray(child)) {
        return [];
    }

    return child.filter((item) => typeof item === 'string');
}

function readOptionalEnv(name: string): string | null {
    const value = process.env[name]?.trim();

    if (!value) {
        return null;
    }

    return value;
}

function getSafeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'Unable to load Checkly status.';
}

function assertChecklyResponse(response: Response) {
    if (!response.ok) {
        throw new ChecklyApiError(response.status);
    }
}

function isChecklyNotFoundError(error: unknown) {
    return error instanceof ChecklyApiError && error.status === 404;
}

class ChecklyApiError extends Error {
    constructor(readonly status: number) {
        super(`Checkly returned HTTP ${status}.`);
    }
}
