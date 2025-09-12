'use client';

import { Check } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { acceptRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { AcceptRequestModal } from './AcceptRequestModal';

interface AcceptRaisedBedFieldModalProps {
    raisedBedId: number;
    positionIndex: number;
    label: string;
}

export function AcceptRaisedBedFieldModal({
    raisedBedId,
    positionIndex,
    label,
}: AcceptRaisedBedFieldModalProps) {
    const handleConfirm = async () => {
        try {
            await acceptRaisedBedFieldAction(raisedBedId, positionIndex);
        } catch (error) {
            console.error('Error accepting field request:', error);
        }
    };

    return (
        <AcceptRequestModal
            label={label}
            onConfirm={handleConfirm}
            trigger={
                <IconButton variant="plain" title="Potvrdi sijanje">
                    <Check className="size-4 shrink-0" />
                </IconButton>
            }
            title="Potvrda sijanja"
            header="Potvrda sijanja"
        />
    );
}

export default AcceptRaisedBedFieldModal;
