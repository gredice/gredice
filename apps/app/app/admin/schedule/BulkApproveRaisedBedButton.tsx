'use client';

import { Approved } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useState } from 'react';
import { acceptOperationAction } from '../../(actions)/operationActions';
import { acceptRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { AcceptRequestModal } from './AcceptRequestModal';

type FieldApprovalTarget = {
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
    fields: FieldApprovalTarget[];
    operations: OperationApprovalTarget[];
}

export function BulkApproveRaisedBedButton({
    physicalId,
    fields,
    operations,
}: BulkApproveRaisedBedButtonProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalItems = fields.length + operations.length;
    const disabled = totalItems === 0 || isSubmitting;

    const handleConfirm = async () => {
        if (totalItems === 0) {
            return;
        }

        setIsSubmitting(true);
        try {
            await Promise.all([
                ...fields.map((field) =>
                    acceptRaisedBedFieldAction(
                        field.raisedBedId,
                        field.positionIndex,
                    ),
                ),
                ...operations.map((operation) =>
                    acceptOperationAction(operation.id),
                ),
            ]);
        } catch (error) {
            console.error('Failed to approve all raised bed items:', error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AcceptRequestModal
            title="Potvrda zadataka"
            header="Potvrda zadataka"
            label={`sve zadatke (${totalItems}) za gredicu ${physicalId}`}
            onConfirm={handleConfirm}
            trigger={
                <IconButton
                    variant="plain"
                    title="Potvrdi sve zadatke gredice"
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
