import { normalizeHarvestTraceScanValue } from './harvestTraceScan';

type DeliveryPickupMutationBase = {
    clientOperationId: string;
    occurredAt: Date;
};

export type DeliveryPickupMutationRequest =
    | (DeliveryPickupMutationBase & {
          kind: 'scan';
          traceToken: string;
      })
    | (DeliveryPickupMutationBase & {
          kind: 'mark-item';
          stopId: number;
          outcome: 'ready' | 'missing-label' | 'not-ready';
      })
    | (DeliveryPickupMutationBase & {
          kind: 'confirm-manifest';
          manifestId: string;
      });

const operationIdPattern = /^[A-Za-z0-9_-]{8,128}$/;
const maximumPickupMutationBatchSize = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function mutationBase(value: Record<string, unknown>) {
    if (
        typeof value.clientOperationId !== 'string' ||
        !operationIdPattern.test(value.clientOperationId) ||
        typeof value.occurredAt !== 'string'
    ) {
        return null;
    }
    const occurredAt = new Date(value.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) return null;
    return {
        clientOperationId: value.clientOperationId,
        occurredAt,
    };
}

function parseMutation(value: unknown): DeliveryPickupMutationRequest | null {
    if (!isRecord(value)) return null;
    const base = mutationBase(value);
    if (!base) return null;

    switch (value.kind) {
        case 'scan': {
            if (typeof value.traceToken !== 'string') return null;
            const traceToken = normalizeHarvestTraceScanValue(value.traceToken);
            return traceToken ? { ...base, kind: 'scan', traceToken } : null;
        }
        case 'mark-item':
            return typeof value.stopId === 'number' &&
                Number.isInteger(value.stopId) &&
                value.stopId > 0 &&
                (value.outcome === 'ready' ||
                    value.outcome === 'missing-label' ||
                    value.outcome === 'not-ready')
                ? {
                      ...base,
                      kind: 'mark-item',
                      stopId: value.stopId,
                      outcome: value.outcome,
                  }
                : null;
        case 'confirm-manifest':
            return typeof value.manifestId === 'string' &&
                value.manifestId.trim() === value.manifestId &&
                value.manifestId.length > 0 &&
                value.manifestId.length <= 256
                ? {
                      ...base,
                      kind: 'confirm-manifest',
                      manifestId: value.manifestId,
                  }
                : null;
        default:
            return null;
    }
}

export function parseDeliveryPickupMutationRequest(
    value: unknown,
    _now = new Date(),
) {
    if (
        !isRecord(value) ||
        !Array.isArray(value.mutations) ||
        value.mutations.length === 0 ||
        value.mutations.length > maximumPickupMutationBatchSize
    ) {
        return null;
    }
    const mutations = value.mutations.map(parseMutation);
    if (mutations.some((mutation) => mutation === null)) return null;
    const parsed = mutations.filter(
        (mutation): mutation is DeliveryPickupMutationRequest =>
            mutation !== null,
    );
    if (
        new Set(parsed.map((mutation) => mutation.clientOperationId)).size !==
        parsed.length
    ) {
        return null;
    }
    return parsed;
}
