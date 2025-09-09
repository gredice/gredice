'use client';

import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Check } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Typography } from '@signalco/ui-primitives/Typography';
import { acceptOperationAction } from '../../(actions)/operationActions';

interface AcceptOperationModalProps {
    operationId: number;
    label: string;
}

export function AcceptOperationModal({
    operationId,
    label,
}: AcceptOperationModalProps) {
    const handleConfirm = async () => {
        try {
            await acceptOperationAction(operationId);
        } catch (error) {
            console.error('Error accepting operation:', error);
        }
    };

    return (
        <ModalConfirm
            title="Potvrda operacije"
            header="Potvrda operacije"
            onConfirm={handleConfirm}
            trigger={
                <IconButton variant="plain" title="Potvrdi operaciju">
                    <Check className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <Typography>
                Jeste li sigurni da želite potvrditi operaciju:{' '}
                <strong>{label}</strong>?
            </Typography>
        </ModalConfirm>
    );
}
