import type {
    PickupManifestCommand,
    PickupManifestTransportResult,
} from './pickupManifestQueue';

function responseCode(value: unknown) {
    return typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        typeof value.code === 'string'
        ? value.code
        : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function hasValidAffectedStopIds(value: unknown): value is number[] {
    return (
        Array.isArray(value) &&
        value.every(
            (stopId) =>
                typeof stopId === 'number' &&
                Number.isInteger(stopId) &&
                stopId > 0,
        )
    );
}

function validateStoredResult(
    value: unknown,
    command: PickupManifestCommand,
): 'success' | 'scan-not-found' | 'scan-ambiguous' | 'invalid' {
    if (!isRecord(value)) return 'invalid';
    const affectedStopIds = value.affectedStopIds;
    if (!hasValidAffectedStopIds(affectedStopIds)) return 'invalid';

    if (command.kind === 'scan') {
        if (value.kind !== 'scan') return 'invalid';
        if (value.outcome === 'not-found') {
            return affectedStopIds.length === 0 ? 'scan-not-found' : 'invalid';
        }
        if (value.outcome === 'ambiguous') {
            return affectedStopIds.length === 0 ? 'scan-ambiguous' : 'invalid';
        }
        return (value.outcome === 'applied' ||
            value.outcome === 'already-applied') &&
            value.itemState === 'scanned' &&
            affectedStopIds.length > 0
            ? 'success'
            : 'invalid';
    }

    if (command.kind === 'manual-outcome') {
        return value.kind === 'mark-item' &&
            (value.outcome === 'applied' ||
                value.outcome === 'already-applied') &&
            value.itemState === command.outcome &&
            affectedStopIds.length > 0
            ? 'success'
            : 'invalid';
    }

    return value.kind === 'confirm-manifest' &&
        (value.outcome === 'applied' || value.outcome === 'already-applied') &&
        value.manifestId === command.manifestId &&
        value.manifestState === 'confirmed'
        ? 'success'
        : 'invalid';
}

export function pickupManifestTransportResult(
    value: unknown,
    command: PickupManifestCommand,
): PickupManifestTransportResult {
    if (!isRecord(value) || !Array.isArray(value.results)) {
        return {
            status: 'retryable-failure',
            code: 'invalid-server-response',
        };
    }
    const matchingResults = value.results.filter(
        (candidate) =>
            isRecord(candidate) &&
            candidate.clientOperationId === command.operationId,
    );
    if (matchingResults.length !== 1) {
        return {
            status: 'retryable-failure',
            code: 'missing-operation-result',
        };
    }
    const result = matchingResults[0];
    if (
        !result ||
        typeof result.replayed !== 'boolean' ||
        !('result' in result)
    ) {
        return {
            status: 'retryable-failure',
            code: 'invalid-server-response',
        };
    }
    const storedResult = validateStoredResult(result.result, command);
    if (storedResult === 'scan-not-found') {
        return {
            status: 'permanent-failure',
            code: 'pickup-trace-not-found',
        };
    }
    if (storedResult === 'scan-ambiguous') {
        return {
            status: 'permanent-failure',
            code: 'pickup-trace-ambiguous',
        };
    }
    if (storedResult === 'invalid') {
        return {
            status: 'retryable-failure',
            code: 'invalid-server-response',
        };
    }
    return result.replayed
        ? { status: 'exact-duplicate' }
        : { status: 'applied' };
}

export function pickupManifestHttpFailure(
    status: number,
    value: unknown,
): PickupManifestTransportResult {
    const retryable =
        status === 408 || status === 425 || status === 429 || status >= 500;
    return {
        status: retryable ? 'retryable-failure' : 'permanent-failure',
        code:
            responseCode(value) ??
            (retryable
                ? 'pickup-manifest-sync-failed'
                : 'pickup-manifest-request-rejected'),
    };
}
