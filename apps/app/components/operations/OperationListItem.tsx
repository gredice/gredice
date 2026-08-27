'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Check } from '@gredice/ui/icons';
import type {
    OperationsListOperation,
    OperationsListOperationRow,
} from '../../app/admin/operations/operationsListTypes';
import { VerifyOperationModal } from '../../app/admin/schedule/VerifyOperationModal';
import { OperationCancelButton } from './OperationCancelButton';
import { OperationListItemContent } from './OperationListItemContent';
import { OperationRescheduleButton } from './OperationRescheduleButton';

function dateForAction(value: string | null) {
    return value ? new Date(value) : undefined;
}

function operationActionPayload(operation: OperationsListOperationRow) {
    return {
        id: operation.id,
        entityId: operation.entityId,
        taskVersionEventId: operation.taskVersionEventId,
        scheduledDate: dateForAction(operation.scheduledDate),
        status: operation.status,
    };
}

export function OperationListItem({
    operation,
}: {
    operation: OperationsListOperation;
}) {
    const actionPayload =
        operation.kind === 'operation'
            ? operationActionPayload(operation)
            : null;

    return (
        <OperationListItemContent
            operation={operation}
            actions={
                operation.kind === 'operation' && actionPayload ? (
                    <>
                        {operation.status === 'pendingVerification' ? (
                            <VerifyOperationModal
                                operationId={operation.id}
                                expectedTaskVersionEventId={
                                    operation.taskVersionEventId
                                }
                                label={operation.label}
                                trigger={
                                    <IconButton
                                        variant="plain"
                                        title="Verificiraj operaciju"
                                    >
                                        <Check className="size-4 shrink-0" />
                                    </IconButton>
                                }
                            />
                        ) : null}
                        <OperationRescheduleButton
                            operation={actionPayload}
                            operationLabel={operation.label}
                        />
                        <OperationCancelButton
                            operation={actionPayload}
                            operationLabel={operation.label}
                        />
                    </>
                ) : null
            }
        />
    );
}
