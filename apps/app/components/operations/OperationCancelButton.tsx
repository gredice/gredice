'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Close } from '@gredice/ui/icons';
import { CancelOperationModal } from '../../app/admin/schedule/CancelOperationModal';

interface OperationCancelButtonProps {
    operation: {
        id: number;
        entityId: number;
        scheduledDate?: Date;
        status: string;
    };
    operationLabel: string;
}

export function OperationCancelButton({
    operation,
    operationLabel,
}: OperationCancelButtonProps) {
    // Only show cancel button for new and planned operations
    if (
        operation.status === 'completed' ||
        operation.status === 'pendingVerification' ||
        operation.status === 'failed' ||
        operation.status === 'canceled'
    ) {
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
