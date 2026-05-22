'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Calendar } from '@gredice/ui/icons';
import { RescheduleOperationModal } from '../../app/admin/schedule/RescheduleOperationModal';

interface OperationRescheduleButtonProps {
    operation: {
        id: number;
        entityId: number;
        scheduledDate?: Date;
        status: string;
    };
    operationLabel: string;
}

export function OperationRescheduleButton({
    operation,
    operationLabel,
}: OperationRescheduleButtonProps) {
    // Only show reschedule button for new and planned operations
    if (
        operation.status === 'completed' ||
        operation.status === 'pendingVerification' ||
        operation.status === 'failed' ||
        operation.status === 'canceled'
    ) {
        return null;
    }

    return (
        <RescheduleOperationModal
            operation={operation}
            operationLabel={operationLabel}
            trigger={
                <IconButton
                    variant="plain"
                    title={
                        operation.scheduledDate
                            ? 'Prerasporedi operaciju'
                            : 'Zakaži operaciju'
                    }
                >
                    <Calendar className="size-4 shrink-0" />
                </IconButton>
            }
        />
    );
}
