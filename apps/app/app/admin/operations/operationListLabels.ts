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
