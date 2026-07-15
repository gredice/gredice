import type {
    DeliveryActionCommand,
    DeliveryActionTransportResult,
    DeliveryVerificationScanCommand,
} from './deliveryActionQueue';
import { assertDeliveryOfflineWritesAllowed } from './deliveryOfflineEvents';

type ServerDeliveryActionCommand = Exclude<
    DeliveryActionCommand,
    DeliveryVerificationScanCommand
>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function validRevision(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function validStopId(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
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
    command: ServerDeliveryActionCommand,
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

function endpoint(command: ServerDeliveryActionCommand) {
    const runId = encodeURIComponent(command.runId);
    if (command.kind === 'exception') {
        return `/api/driver/runs/${runId}/exceptions`;
    }
    return `/api/driver/runs/${runId}/stops/${command.stopId}/${command.kind}`;
}

function requestBody(command: ServerDeliveryActionCommand) {
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
    command: ServerDeliveryActionCommand,
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
    return response.ok
        ? deliveryActionAcknowledgement(value, command)
        : deliveryActionHttpFailure(response.status, value);
}
