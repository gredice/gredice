'use client';

import { Close } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
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
