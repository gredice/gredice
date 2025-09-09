'use client';

import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Check } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
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
                <Button
                    variant="plain"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Potvrdi operaciju"
                >
                    <Check className="size-4 shrink-0" />
                </Button>
            }
        >
            <Typography>
                Jeste li sigurni da želite potvrditi operaciju:{' '}
                <strong>{label}</strong>?
            </Typography>
        </ModalConfirm>
    );
}
