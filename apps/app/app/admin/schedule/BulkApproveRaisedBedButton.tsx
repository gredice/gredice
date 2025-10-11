'use client';

import { Check } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
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
                ...fields.map(field =>
                    acceptRaisedBedFieldAction(
                        field.raisedBedId,
                        field.positionIndex,
                    )
                ),
                ...operations.map(operation =>
                    acceptOperationAction(operation.id)
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
                <Button
                    variant="plain"
                    title="Potvrdi sve zadatke gredice"
                    disabled={disabled}
                    startDecorator={<Check className="size-4 shrink-0" />}
                    aria-disabled={disabled}
                >
                    {isSubmitting
                        ? 'Potvrđivanje...'
                        : `Potvrdi sve (${totalItems})`}
                </Button>
            }
        />
    );
}

export default BulkApproveRaisedBedButton;
