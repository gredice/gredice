import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';

export const PLANTING_TASK_DURATION_MINUTES = 5;

export const FIELD_STATUSES_TO_INCLUDE = new Set(['new', 'planned', 'sowed']);
export const FIELD_COMPLETED_STATUSES = new Set(['sowed']);
export const OPERATION_STATUSES_TO_INCLUDE = new Set([
    'new',
    'planned',
    'completed',
    'cancelled',
]);

export function isFieldApproved(status?: string) {
    return status === 'planned';
}

export function isFieldCompleted(status?: string) {
    if (!status) {
        return false;
    }

    return FIELD_COMPLETED_STATUSES.has(status);
}

export function isOperationCompleted(status?: string) {
    return status === 'completed';
}

export function isOperationCancelled(status?: string) {
    return status === 'cancelled';
}

export function formatMinutes(minutes: number, hideUnit = false) {
    const rounded = Math.ceil(Math.max(0, minutes));
    return hideUnit ? `${rounded}` : `${rounded} min`;
}

export function getOperationDurationMinutes(
    operationData: EntityStandardized | undefined,
) {
    if (!operationData) {
        return 0;
    }

    const durationValue = (
        operationData as { attributes?: { duration?: unknown } }
    )?.attributes?.duration;

    if (typeof durationValue === 'number' && Number.isFinite(durationValue)) {
        return Math.max(durationValue, 0);
    }

    if (typeof durationValue === 'string') {
        const parsed = Number.parseFloat(durationValue);
        if (Number.isFinite(parsed)) {
            return Math.max(parsed, 0);
        }
    }

    return 0;
}
