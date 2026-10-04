import {
    type DeliveryRunCompletionOverrideInput,
    DeliveryRunCompletionOverrideReasons,
    type DeliveryRunExceptionOutcome,
    DeliveryRunExceptionOutcomes,
    type DeliveryRunExceptionReason,
    DeliveryRunExceptionReasons,
    type DeliveryRunStopOperationKind,
    DeliveryRunStopOperationKinds,
} from '@gredice/storage';

export class DeliveryMutationRequestError extends Error {
    override name = 'DeliveryMutationRequestError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function completionOverride(
    value: unknown,
): DeliveryRunCompletionOverrideInput {
    if (
        !isRecord(value) ||
        Object.keys(value).length !== 1 ||
        !('reason' in value)
    ) {
        throw new DeliveryMutationRequestError(
            'Razlog dovršetka bez pune provjere nije valjan.',
        );
    }
    switch (value.reason) {
        case DeliveryRunCompletionOverrideReasons.DEVICE_UNAVAILABLE:
        case DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY:
        case DeliveryRunCompletionOverrideReasons.MANUAL_HANDOFF:
        case DeliveryRunCompletionOverrideReasons.OTHER_OPERATIONAL:
            return { reason: value.reason };
        default:
            throw new DeliveryMutationRequestError(
                'Razlog dovršetka bez pune provjere nije valjan.',
            );
    }
}

export function expectedRouteRevision(value: unknown) {
    if (
        !isRecord(value) ||
        !Number.isInteger(value.expectedRouteRevision) ||
        typeof value.expectedRouteRevision !== 'number' ||
        value.expectedRouteRevision < 0
    ) {
        throw new DeliveryMutationRequestError(
            'Nedostaje valjana revizija rute.',
        );
    }
    return value.expectedRouteRevision;
}

export function parseDeliveryStopMutation(
    value: unknown,
    kind: DeliveryRunStopOperationKind,
) {
    if (!isRecord(value)) {
        throw new DeliveryMutationRequestError('Neispravna promjena dostave.');
    }
    const routeRevision = expectedRouteRevision(value);
    if (
        typeof value.clientOperationId !== 'string' ||
        value.clientOperationId.trim().length === 0 ||
        value.clientOperationId.trim().length > 128
    ) {
        throw new DeliveryMutationRequestError(
            'Nedostaje identifikator promjene.',
        );
    }
    if (typeof value.occurredAt !== 'string') {
        throw new DeliveryMutationRequestError('Nedostaje vrijeme promjene.');
    }
    const occurredAt = new Date(value.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) {
        throw new DeliveryMutationRequestError(
            'Vrijeme promjene nije valjano.',
        );
    }
    if (
        kind !== DeliveryRunStopOperationKinds.ARRIVE &&
        kind !== DeliveryRunStopOperationKinds.DELIVER
    ) {
        throw new DeliveryMutationRequestError('Neispravna vrsta promjene.');
    }
    const allowedKeys = new Set([
        'clientOperationId',
        'expectedRouteRevision',
        'occurredAt',
        ...(kind === DeliveryRunStopOperationKinds.DELIVER
            ? ['notes', 'completionOverride']
            : []),
    ]);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
        throw new DeliveryMutationRequestError(
            'Promjena dostave sadrži nepodržane podatke.',
        );
    }
    if (kind === DeliveryRunStopOperationKinds.ARRIVE && 'notes' in value) {
        throw new DeliveryMutationRequestError(
            'Napomena nije dopuštena za potvrdu dolaska.',
        );
    }
    if (
        kind === DeliveryRunStopOperationKinds.ARRIVE &&
        'completionOverride' in value
    ) {
        throw new DeliveryMutationRequestError(
            'Razlog dovršetka nije dopušten za potvrdu dolaska.',
        );
    }
    let notes: string | undefined;
    if (kind === DeliveryRunStopOperationKinds.DELIVER && 'notes' in value) {
        if (typeof value.notes !== 'string') {
            throw new DeliveryMutationRequestError('Napomena nije valjana.');
        }
        notes = value.notes.trim() || undefined;
        if (notes && notes.length > 1_000) {
            throw new DeliveryMutationRequestError(
                'Napomena smije imati najviše 1000 znakova.',
            );
        }
    }
    const parsedCompletionOverride =
        kind === DeliveryRunStopOperationKinds.DELIVER &&
        'completionOverride' in value
            ? completionOverride(value.completionOverride)
            : undefined;
    return {
        kind,
        expectedRouteRevision: routeRevision,
        clientOperationId: value.clientOperationId.trim(),
        occurredAt,
        ...(notes ? { notes } : {}),
        ...(parsedCompletionOverride
            ? { completionOverride: parsedCompletionOverride }
            : {}),
    };
}

function exceptionOutcome(value: unknown): DeliveryRunExceptionOutcome {
    switch (value) {
        case DeliveryRunExceptionOutcomes.DEFERRED:
        case DeliveryRunExceptionOutcomes.FAILED:
        case DeliveryRunExceptionOutcomes.CANCELLED:
            return value;
        default:
            throw new DeliveryMutationRequestError('Neispravan ishod dostave.');
    }
}

function exceptionReason(value: unknown): DeliveryRunExceptionReason {
    switch (value) {
        case DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE:
        case DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE:
        case DeliveryRunExceptionReasons.ADDRESS_WRONG:
        case DeliveryRunExceptionReasons.HARVEST_DAMAGED:
        case DeliveryRunExceptionReasons.HARVEST_MISSING:
        case DeliveryRunExceptionReasons.CANCELLATION:
        case DeliveryRunExceptionReasons.OPERATIONAL_OTHER:
            return value;
        default:
            throw new DeliveryMutationRequestError(
                'Neispravan razlog dostave.',
            );
    }
}

export function parseDeliveryExceptionMutation(value: unknown) {
    if (!isRecord(value)) {
        throw new DeliveryMutationRequestError('Neispravna promjena dostave.');
    }
    const routeRevision = expectedRouteRevision(value);
    if (
        typeof value.clientOperationId !== 'string' ||
        value.clientOperationId.trim().length === 0 ||
        value.clientOperationId.trim().length > 128
    ) {
        throw new DeliveryMutationRequestError(
            'Nedostaje identifikator promjene.',
        );
    }
    if (typeof value.occurredAt !== 'string') {
        throw new DeliveryMutationRequestError('Nedostaje vrijeme promjene.');
    }
    const occurredAt = new Date(value.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) {
        throw new DeliveryMutationRequestError(
            'Vrijeme promjene nije valjano.',
        );
    }
    if (!Array.isArray(value.exceptions) || value.exceptions.length === 0) {
        throw new DeliveryMutationRequestError(
            'Nedostaje ishod barem jedne dostave.',
        );
    }
    const exceptions = value.exceptions.map((item) => {
        if (
            !isRecord(item) ||
            typeof item.stopId !== 'number' ||
            !Number.isInteger(item.stopId) ||
            item.stopId <= 0
        ) {
            throw new DeliveryMutationRequestError(
                'Stanica promjene nije valjana.',
            );
        }
        const note =
            typeof item.note === 'string' && item.note.trim()
                ? item.note.trim()
                : undefined;
        if (note && note.length > 1_000) {
            throw new DeliveryMutationRequestError(
                'Napomena smije imati najviše 1000 znakova.',
            );
        }
        return {
            stopId: item.stopId,
            outcome: exceptionOutcome(item.outcome),
            reason: exceptionReason(item.reason),
            ...(note ? { note } : {}),
        };
    });
    return {
        expectedRouteRevision: routeRevision,
        clientOperationId: value.clientOperationId.trim(),
        occurredAt,
        exceptions,
    };
}
