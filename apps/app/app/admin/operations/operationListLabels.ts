import type { ColorPaletteProp } from '@gredice/ui/Chip';
import type {
    OperationsListOperation,
    OperationsListStatus,
} from './operationsListTypes';

const operationStatusLabels: Record<OperationsListStatus, string> = {
    new: 'Novo',
    planned: 'Planirano',
    pendingVerification: 'Čeka verifikaciju',
    completed: 'Završeno',
    blocked: 'Blokirano',
    failed: 'Neuspješno',
    canceled: 'Otkazano',
};

const sowingStatusLabels: Record<OperationsListStatus, string> = {
    ...operationStatusLabels,
    new: 'Čeka sijanje',
    completed: 'Posijano',
};

export function operationListStatusLabel(
    operation: Pick<OperationsListOperation, 'kind' | 'status'>,
) {
    return operation.kind === 'sowing'
        ? sowingStatusLabels[operation.status]
        : operationStatusLabels[operation.status];
}

export function operationListStatusColor(
    status: OperationsListStatus,
): ColorPaletteProp {
    if (status === 'completed') {
        return 'success';
    }

    if (status === 'planned') {
        return 'info';
    }

    if (status === 'canceled') {
        return 'neutral';
    }

    if (status === 'failed') {
        return 'error';
    }

    return 'warning';
}

/**
 * Keeps list dates compact: the year is only rendered for dates outside the
 * current year, matching how the day groups are labelled.
 */
export function operationsListDateFormat(
    value: Date | string | null | undefined,
    currentYear = new Date().getFullYear(),
): Intl.DateTimeFormatOptions {
    const date = typeof value === 'string' ? new Date(value) : value;
    const isCurrentYear =
        date instanceof Date &&
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === currentYear;

    return isCurrentYear
        ? { day: 'numeric', month: 'numeric' }
        : { day: 'numeric', month: 'numeric', year: 'numeric' };
}
