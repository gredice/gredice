type DeliveryHandoffMutationBase = {
    clientOperationId: string;
    occurredAt: Date;
};

export type DeliveryHandoffMutationRequest =
    | (DeliveryHandoffMutationBase & {
          kind: 'scan';
          tracePath: string;
      })
    | (DeliveryHandoffMutationBase & {
          kind: 'mark-item';
          stopId: number;
          outcome: 'no-label' | 'missing';
      })
    | (DeliveryHandoffMutationBase & {
          kind: 'mark-item';
          stopId: number;
          outcome: 'skipped';
          reason:
              | 'scanner-unavailable'
              | 'label-unreadable'
              | 'manual-verification'
              | 'other-operational';
      });

const operationIdPattern = /^[A-Za-z0-9_-]{8,128}$/;
const maximumHandoffMutationBatchSize = 100;
const maximumPostgresInteger = 2_147_483_647;
const isoDatePattern =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+-](\d{2}):(\d{2}))$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
    const allowedKeys = new Set(allowed);
    return Object.keys(value).every((key) => allowedKeys.has(key));
}

function parseIsoDate(value: unknown) {
    if (typeof value !== 'string') return null;
    const match = isoDatePattern.exec(value);
    if (!match) return null;

    const [
        ,
        year,
        month,
        day,
        hour,
        minute,
        second,
        ,
        offsetHour,
        offsetMinute,
    ] = match;
    if (
        !year ||
        !month ||
        !day ||
        !hour ||
        !minute ||
        !second ||
        Number(month) < 1 ||
        Number(month) > 12 ||
        Number(day) < 1 ||
        Number(day) >
            new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate() ||
        Number(hour) > 23 ||
        Number(minute) > 59 ||
        Number(second) > 59 ||
        (offsetHour !== undefined && Number(offsetHour) > 23) ||
        (offsetMinute !== undefined && Number(offsetMinute) > 59)
    ) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function parseMutationBase(value: Record<string, unknown>) {
    if (
        typeof value.clientOperationId !== 'string' ||
        !operationIdPattern.test(value.clientOperationId)
    ) {
        return null;
    }
    const occurredAt = parseIsoDate(value.occurredAt);
    return occurredAt
        ? { clientOperationId: value.clientOperationId, occurredAt }
        : null;
}

function parseMutation(value: unknown): DeliveryHandoffMutationRequest | null {
    if (!isRecord(value)) return null;
    const base = parseMutationBase(value);
    if (!base) return null;

    switch (value.kind) {
        case 'scan': {
            if (
                !hasOnlyKeys(value, [
                    'kind',
                    'clientOperationId',
                    'occurredAt',
                    'tracePath',
                ]) ||
                typeof value.tracePath !== 'string' ||
                value.tracePath.length === 0 ||
                value.tracePath.length > 2_048
            ) {
                return null;
            }
            const tracePath = value.tracePath.trim();
            return tracePath.length > 0
                ? { ...base, kind: 'scan', tracePath }
                : null;
        }
        case 'mark-item': {
            if (
                typeof value.stopId !== 'number' ||
                !Number.isSafeInteger(value.stopId) ||
                value.stopId <= 0 ||
                value.stopId > maximumPostgresInteger
            ) {
                return null;
            }
            if (value.outcome === 'skipped') {
                if (
                    !hasOnlyKeys(value, [
                        'kind',
                        'clientOperationId',
                        'occurredAt',
                        'stopId',
                        'outcome',
                        'reason',
                    ]) ||
                    (value.reason !== 'scanner-unavailable' &&
                        value.reason !== 'label-unreadable' &&
                        value.reason !== 'manual-verification' &&
                        value.reason !== 'other-operational')
                ) {
                    return null;
                }
                return {
                    ...base,
                    kind: 'mark-item',
                    stopId: value.stopId,
                    outcome: 'skipped',
                    reason: value.reason,
                };
            }
            if (
                !hasOnlyKeys(value, [
                    'kind',
                    'clientOperationId',
                    'occurredAt',
                    'stopId',
                    'outcome',
                ]) ||
                (value.outcome !== 'no-label' && value.outcome !== 'missing')
            ) {
                return null;
            }
            return {
                ...base,
                kind: 'mark-item',
                stopId: value.stopId,
                outcome: value.outcome,
            };
        }
        default:
            return null;
    }
}

export function parseDeliveryHandoffMutationRequest(value: unknown) {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, ['expectedRetryAttempt', 'mutations']) ||
        typeof value.expectedRetryAttempt !== 'number' ||
        !Number.isSafeInteger(value.expectedRetryAttempt) ||
        value.expectedRetryAttempt < 0 ||
        !Array.isArray(value.mutations) ||
        value.mutations.length === 0 ||
        value.mutations.length > maximumHandoffMutationBatchSize
    ) {
        return null;
    }

    const parsed: DeliveryHandoffMutationRequest[] = [];
    const operationIds = new Set<string>();
    for (const valueMutation of value.mutations) {
        const mutation = parseMutation(valueMutation);
        if (!mutation || operationIds.has(mutation.clientOperationId)) {
            return null;
        }
        operationIds.add(mutation.clientOperationId);
        parsed.push(mutation);
    }
    return {
        expectedRetryAttempt: value.expectedRetryAttempt,
        mutations: parsed,
    };
}
