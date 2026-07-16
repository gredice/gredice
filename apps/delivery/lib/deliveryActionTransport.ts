import type {
    DeliveryActionTransportResult,
    DeliveryHandoffCommand,
    DeliveryHandoffOperationResult,
    DeliveryRouteActionCommand,
    DeliveryServerActionCommand,
} from './deliveryActionQueue';
import { isDeliveryHandoffCommand } from './deliveryActionQueue';
import { assertDeliveryOfflineWritesAllowed } from './deliveryOfflineEvents';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
    const allowedKeys = new Set(allowed);
    return Object.keys(value).every((key) => allowedKeys.has(key));
}

function validRevision(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function validStopId(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0 &&
        value <= 2_147_483_647
    );
}

function validRetryAttempt(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
}

function validHandoffItemState(value: unknown) {
    return (
        value === 'unverified' ||
        value === 'scanned' ||
        value === 'no-label' ||
        value === 'missing' ||
        value === 'skipped'
    );
}

function validHandoffSkipReason(value: unknown) {
    return (
        value === 'scanner-unavailable' ||
        value === 'label-unreadable' ||
        value === 'manual-verification' ||
        value === 'other-operational'
    );
}

function responseCode(value: unknown) {
    if (
        isRecord(value) &&
        typeof value.code === 'string' &&
        /^[a-z0-9-]{1,128}$/.test(value.code)
    ) {
        return value.code;
    }
    return undefined;
}

export function deliveryActionHttpFailure(
    status: number,
    value: unknown,
): DeliveryActionTransportResult {
    const code = responseCode(value);
    return status === 408 || status === 425 || status === 429 || status >= 500
        ? { status: 'retryable-failure', code }
        : { status: 'permanent-failure', code };
}

export function deliveryActionAcknowledgement(
    value: unknown,
    command: DeliveryRouteActionCommand,
): DeliveryActionTransportResult {
    if (
        !isRecord(value) ||
        value.clientOperationId !== command.operationId ||
        typeof value.replayed !== 'boolean'
    ) {
        return {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        };
    }
    if (command.kind === 'exception') {
        const outcomes = Array.isArray(value.outcomes) ? value.outcomes : null;
        const outcomesMatch =
            outcomes?.length === command.exceptions.length &&
            command.exceptions.every((exception) =>
                outcomes.some(
                    (outcome) =>
                        isRecord(outcome) &&
                        outcome.stopId === exception.stopId &&
                        outcome.outcome === exception.outcome &&
                        outcome.reason === exception.reason,
                ),
            );
        if (
            !validRevision(value.routeRevision) ||
            typeof value.reroutePending !== 'boolean' ||
            typeof value.runCompleted !== 'boolean' ||
            !outcomesMatch
        ) {
            return {
                status: 'retryable-failure',
                code: 'invalid-acknowledgement',
            };
        }
        return {
            status: value.replayed ? 'exact-duplicate' : 'applied',
            routeRevision: value.routeRevision,
            reroutePending: value.reroutePending,
            runCompleted: value.runCompleted,
        };
    }
    const result = value.result;
    if (
        !isRecord(result) ||
        result.kind !== command.kind ||
        result.targetStopId !== command.stopId ||
        !Array.isArray(result.affectedStopIds) ||
        result.affectedStopIds.length === 0 ||
        !result.affectedStopIds.every(validStopId) ||
        !validRevision(result.routeRevision) ||
        typeof result.reroutePending !== 'boolean' ||
        typeof result.runCompleted !== 'boolean'
    ) {
        return {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        };
    }
    return {
        status: value.replayed ? 'exact-duplicate' : 'applied',
        routeRevision: result.routeRevision,
        reroutePending: result.reroutePending,
        runCompleted: result.runCompleted,
    };
}

function handoffResult(
    value: unknown,
    command: DeliveryHandoffCommand,
): DeliveryHandoffOperationResult | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
            'kind',
            'outcome',
            'affectedStopIds',
            'itemState',
            'reason',
        ]) ||
        !Array.isArray(value.affectedStopIds) ||
        !value.affectedStopIds.every(validStopId) ||
        new Set(value.affectedStopIds).size !== value.affectedStopIds.length
    ) {
        return null;
    }
    const expectedKind =
        command.kind === 'verification-scan' ? 'scan' : 'mark-item';
    if (value.kind !== expectedKind) return null;
    const outcome = value.outcome;
    if (
        outcome !== 'applied' &&
        outcome !== 'already-applied' &&
        outcome !== 'stale' &&
        outcome !== 'invalid' &&
        outcome !== 'wrong-stop' &&
        outcome !== 'item-not-found'
    ) {
        return null;
    }
    const emptyOutcome =
        outcome === 'invalid' ||
        outcome === 'wrong-stop' ||
        outcome === 'item-not-found';
    if (emptyOutcome) {
        const outcomeMatchesKind =
            outcome === 'wrong-stop' ||
            (command.kind === 'verification-scan' && outcome === 'invalid') ||
            (command.kind === 'verification-mark' &&
                outcome === 'item-not-found');
        return outcomeMatchesKind &&
            value.affectedStopIds.length === 0 &&
            value.itemState === undefined &&
            value.reason === undefined
            ? { kind: expectedKind, outcome, affectedStopIds: [] }
            : null;
    }
    if (value.affectedStopIds.length === 0) return null;
    if (
        command.kind === 'verification-mark' &&
        (value.affectedStopIds.length !== 1 ||
            value.affectedStopIds[0] !== command.itemStopId)
    ) {
        return null;
    }
    const expectedItemState =
        command.kind === 'verification-scan' ? 'scanned' : command.outcome;
    if (
        value.itemState !== expectedItemState ||
        !validHandoffItemState(value.itemState)
    ) {
        return null;
    }
    const expectedReason =
        command.kind === 'verification-mark' && command.outcome === 'skipped'
            ? command.reason
            : undefined;
    if (
        value.reason !== expectedReason ||
        (value.reason !== undefined && !validHandoffSkipReason(value.reason))
    ) {
        return null;
    }
    return {
        kind: expectedKind,
        outcome,
        affectedStopIds: [...value.affectedStopIds],
        itemState: value.itemState,
        ...(value.reason ? { reason: value.reason } : {}),
    };
}

export function deliveryHandoffAcknowledgement(
    value: unknown,
    command: DeliveryHandoffCommand,
): DeliveryActionTransportResult {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, ['results']) ||
        !Array.isArray(value.results) ||
        value.results.length !== 1
    ) {
        return {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        };
    }
    const receipt = value.results[0];
    if (
        !isRecord(receipt) ||
        !hasOnlyKeys(receipt, [
            'clientOperationId',
            'retryAttempt',
            'replayed',
            'result',
        ]) ||
        receipt.clientOperationId !== command.operationId ||
        !validRetryAttempt(receipt.retryAttempt) ||
        receipt.retryAttempt !== command.expectedRetryAttempt ||
        typeof receipt.replayed !== 'boolean'
    ) {
        return {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        };
    }
    const result = handoffResult(receipt.result, command);
    if (!result) {
        return {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        };
    }
    return {
        status: 'handoff-acknowledged',
        replayed: receipt.replayed,
        retryAttempt: receipt.retryAttempt,
        result,
    };
}

function endpoint(command: DeliveryServerActionCommand) {
    const runId = encodeURIComponent(command.runId);
    if (isDeliveryHandoffCommand(command)) {
        return `/api/driver/runs/${runId}/stops/${command.stopId}/handoff/mutations`;
    }
    if (command.kind === 'exception') {
        return `/api/driver/runs/${runId}/exceptions`;
    }
    return `/api/driver/runs/${runId}/stops/${command.stopId}/${command.kind}`;
}

function requestBody(command: DeliveryServerActionCommand) {
    if (isDeliveryHandoffCommand(command)) {
        const mutation = {
            clientOperationId: command.operationId,
            occurredAt: command.occurredAt,
            ...(command.kind === 'verification-scan'
                ? { kind: 'scan', tracePath: command.tracePath }
                : {
                      kind: 'mark-item',
                      stopId: command.itemStopId,
                      outcome: command.outcome,
                      ...(command.reason ? { reason: command.reason } : {}),
                  }),
        };
        return {
            expectedRetryAttempt: command.expectedRetryAttempt,
            mutations: [mutation],
        };
    }
    const common = {
        clientOperationId: command.operationId,
        occurredAt: command.occurredAt,
        expectedRouteRevision: command.expectedRouteRevision,
    };
    if (command.kind === 'exception') {
        return { ...common, exceptions: command.exceptions };
    }
    if (command.kind === 'deliver') {
        return {
            ...common,
            ...(command.notes ? { notes: command.notes } : {}),
        };
    }
    return common;
}

export async function sendDeliveryAction(
    command: DeliveryServerActionCommand,
): Promise<DeliveryActionTransportResult> {
    assertDeliveryOfflineWritesAllowed();
    let response: Response;
    try {
        response = await fetch(endpoint(command), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody(command)),
        });
    } catch {
        return { status: 'retryable-failure', code: 'offline' };
    }
    const value: unknown = await response.json().catch(() => null);
    assertDeliveryOfflineWritesAllowed();
    if (!response.ok) return deliveryActionHttpFailure(response.status, value);
    return isDeliveryHandoffCommand(command)
        ? deliveryHandoffAcknowledgement(value, command)
        : deliveryActionAcknowledgement(value, command);
}
