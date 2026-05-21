'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Check } from '@gredice/ui/icons';
import { acceptRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { AcceptRequestModal } from './AcceptRequestModal';

interface AcceptRaisedBedFieldModalProps {
    raisedBedId: number;
    positionIndex: number;
    label: string;
    disabled?: boolean;
    onConfirm?: () => unknown | Promise<unknown>;
}

export function AcceptRaisedBedFieldModal({
    raisedBedId,
    positionIndex,
    label,
    disabled = false,
    onConfirm,
}: AcceptRaisedBedFieldModalProps) {
    const handleConfirm = async () => {
        if (onConfirm) {
            await onConfirm();
            return;
        }

        await acceptRaisedBedFieldAction(raisedBedId, positionIndex);
    };

    return (
        <AcceptRequestModal
            label={label}
            onConfirm={handleConfirm}
            trigger={
                <IconButton
                    variant="plain"
                    title="Potvrdi sijanje"
                    disabled={disabled}
                >
                    <Check className="size-4 shrink-0" />
                </IconButton>
            }
            title="Potvrda sijanja"
            header="Potvrda sijanja"
        />
    );
}

export default AcceptRaisedBedFieldModal;
