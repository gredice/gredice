'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Check } from '@gredice/ui/icons';
import { acceptOperationAction } from '../../(actions)/operationActions';
import { AcceptRequestModal } from './AcceptRequestModal';
import { canAcceptOperationTask } from './scheduleShared';

interface AcceptOperationModalProps {
    operationId: number;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    operationStatus?: string | null;
    label: string;
    raisedBedPhysicalId?: string;
    disabled?: boolean;
    onConfirm?: () => unknown | Promise<unknown>;
}

export function AcceptOperationModal({
    operationId,
    expectedEntityId,
    expectedTaskVersionEventId,
    operationStatus,
    label,
    raisedBedPhysicalId,
    disabled = false,
    onConfirm,
}: AcceptOperationModalProps) {
    if (!canAcceptOperationTask(operationStatus)) {
        return null;
    }

    const handleConfirm = async () => {
        if (onConfirm) {
            await onConfirm();
            return;
        }

        await acceptOperationAction(
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
        );
    };

    return (
        <AcceptRequestModal
            label={label}
            onConfirm={handleConfirm}
            trigger={
                <IconButton
                    variant="plain"
                    size="xs"
                    title="Potvrdi operaciju"
                    disabled={disabled}
                >
                    <Check className="size-4 shrink-0" />
                </IconButton>
            }
            title="Potvrda radnje"
            header="Potvrda radnje"
            raisedBedPhysicalId={raisedBedPhysicalId}
        />
    );
}

export default AcceptOperationModal;
