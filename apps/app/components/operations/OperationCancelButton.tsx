'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Close } from '@gredice/ui/icons';
import { CancelOperationModal } from '../../app/admin/schedule/CancelOperationModal';
import { canCancelOperationTask } from '../../app/admin/schedule/scheduleShared';

interface OperationCancelButtonProps {
    operation: {
        id: number;
        entityId: number;
        taskVersionEventId: number;
        scheduledDate?: Date;
        status: string;
    };
    operationLabel: string;
}

export function OperationCancelButton({
    operation,
    operationLabel,
}: OperationCancelButtonProps) {
    if (!canCancelOperationTask(operation.status)) {
        return null;
    }

    return (
        <CancelOperationModal
            operation={operation}
            operationLabel={operationLabel}
            trigger={
                <IconButton variant="plain" title="Otkaži operaciju">
                    <Close className="size-4 shrink-0" />
                </IconButton>
            }
        />
    );
}
