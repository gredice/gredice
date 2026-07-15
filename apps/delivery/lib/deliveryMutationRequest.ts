import {
    type DeliveryRunExceptionOutcome,
    DeliveryRunExceptionOutcomes,
    type DeliveryRunExceptionReason,
    DeliveryRunExceptionReasons,
} from '@gredice/storage';

export class DeliveryMutationRequestError extends Error {
    override name = 'DeliveryMutationRequestError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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
