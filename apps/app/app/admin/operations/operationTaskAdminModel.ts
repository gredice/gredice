import type { OperationTaskAdminValues } from '@gredice/storage/operationTaskAdministration';

export const operationTaskDateFields = [
    { name: 'scheduledDate', label: 'Zakazano za' },
    { name: 'timestamp', label: 'Datum radnje' },
    { name: 'createdAt', label: 'Datum stvaranja' },
    { name: 'scheduledAt', label: 'Datum zakazivanja' },
    { name: 'assignedAt', label: 'Datum dodjele' },
    { name: 'completedAt', label: 'Datum završetka' },
    { name: 'verifiedAt', label: 'Datum verifikacije' },
    { name: 'blockedAt', label: 'Datum blokade' },
    { name: 'canceledAt', label: 'Datum otkazivanja' },
] as const;

export function operationTaskDateInputValue(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000,
    );
    return localDate.toISOString().slice(0, 19);
}

export function operationTaskWithStatus(
    values: OperationTaskAdminValues,
    status: OperationTaskAdminValues['status'],
    now = new Date(),
) {
    const next = { ...values, status };
    const occurredAt = now.toISOString();
    if (status === 'new' || status === 'planned') {
        next.completedAt = null;
        next.verifiedAt = null;
        next.blockedAt = null;
        next.canceledAt = null;
    } else if (status === 'pendingVerification' || status === 'completed') {
        next.completedAt ??= occurredAt;
        next.verifiedAt =
            status === 'completed' ? (next.verifiedAt ?? occurredAt) : null;
        next.blockedAt = null;
        next.canceledAt = null;
    } else if (status === 'blocked') {
        next.blockedAt ??= occurredAt;
        next.verifiedAt = null;
    } else if (status === 'canceled') {
        next.canceledAt ??= occurredAt;
        next.verifiedAt = null;
    } else {
        next.verifiedAt = null;
    }
    return next;
}
