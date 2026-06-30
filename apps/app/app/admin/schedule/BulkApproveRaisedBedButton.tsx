'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Approved } from '@gredice/ui/icons';
import { useState } from 'react';
import { acceptOperationAction } from '../../(actions)/operationActions';
import { acceptRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { AcceptRequestModal } from './AcceptRequestModal';

type FieldApprovalTarget = {
    id?: number;
    raisedBedId: number;
    positionIndex: number;
    label: string;
};

type OperationApprovalTarget = {
    id: number;
    label: string;
};

interface BulkApproveRaisedBedButtonProps {
    physicalId: string;
    targetLabel?: string;
    fields: FieldApprovalTarget[];
    operations: OperationApprovalTarget[];
    onConfirm?: () => unknown | Promise<unknown>;
}

export function BulkApproveRaisedBedButton({
    physicalId,
    targetLabel,
    fields,
    operations,
    onConfirm,
}: BulkApproveRaisedBedButtonProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalItems = fields.length + operations.length;
    const disabled = totalItems === 0 || isSubmitting;
    const targetText =
        targetLabel ??
        (physicalId === 'dan' ? 'za dan' : `za gredicu ${physicalId}`);

    const handleConfirm = async () => {
        if (totalItems === 0) {
            return;
        }

        if (onConfirm) {
            await onConfirm();
            return;
        }

        setIsSubmitting(true);
        void Promise.all([
            ...fields.map((field) =>
                acceptRaisedBedFieldAction(
                    field.raisedBedId,
                    field.positionIndex,
                ),
            ),
            ...operations.map((operation) =>
                acceptOperationAction(operation.id),
            ),
        ])
            .catch((error: unknown) => {
                console.error('Failed to approve all raised bed items:', error);
                alert('Skupna potvrda zadataka nije uspjela.');
            })
            .finally(() => setIsSubmitting(false));
    };

    return (
        <AcceptRequestModal
            title="Potvrda zadataka"
            header="Potvrda zadataka"
            label={`sve zadatke (${totalItems}) ${targetText}`}
            onConfirm={handleConfirm}
            trigger={
                <IconButton
                    variant="plain"
                    size="xs"
                    title="Potvrdi sve zadatke"
                    disabled={disabled}
                    aria-disabled={disabled}
                    loading={isSubmitting}
                >
                    <Approved className="size-4 shrink-0" />
                </IconButton>
            }
        />
    );
}

export default BulkApproveRaisedBedButton;
