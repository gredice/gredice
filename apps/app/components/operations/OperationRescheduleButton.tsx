'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Calendar } from '@gredice/ui/icons';
import { RescheduleOperationModal } from '../../app/admin/schedule/RescheduleOperationModal';
import { canRescheduleOperationTask } from '../../app/admin/schedule/scheduleShared';

interface OperationRescheduleButtonProps {
    operation: {
        id: number;
        entityId: number;
        taskVersionEventId: number;
        scheduledDate?: Date;
        status: string;
    };
    operationLabel: string;
}

export function OperationRescheduleButton({
    operation,
    operationLabel,
}: OperationRescheduleButtonProps) {
    if (!canRescheduleOperationTask(operation.status)) {
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
                            ? 'Prerasporedi radnju'
                            : 'Zakaži radnju'
                    }
                >
                    <Calendar className="size-4 shrink-0" />
                </IconButton>
            }
        />
    );
}
