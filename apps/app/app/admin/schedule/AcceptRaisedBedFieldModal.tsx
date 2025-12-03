'use client';

import { Check } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useState } from 'react';
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
    const [loading, setLoading] = useState(false);
    const handleConfirm = async () => {
        try {
            setLoading(true);
            await acceptRaisedBedFieldAction(raisedBedId, positionIndex);
        } catch (error) {
            console.error('Error accepting field request:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AcceptRequestModal
            label={label}
            onConfirm={handleConfirm}
            trigger={
                <IconButton
                    variant="plain"
                    title="Potvrdi sijanje"
                    loading={loading}
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
