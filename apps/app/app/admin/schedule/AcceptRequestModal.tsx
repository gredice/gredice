'use client';

import { Check } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';

interface AcceptRequestModalProps {
    label: string;
    onConfirm: () => unknown | Promise<unknown>;
    trigger?: React.ReactElement;
    title?: string;
    header?: string;
}

export function AcceptRequestModal({
    label,
    onConfirm,
    trigger,
    title = 'Potvrda zadatka',
    header = 'Potvrda zadatka',
}: AcceptRequestModalProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        try {
            setIsSubmitting(true);
            await onConfirm();
            setOpen(false);
        } catch (error) {
            console.error('Error confirming request:', error);
            alert('Potvrda zadatka nije uspjela. Pokušajte ponovno.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title={title}
            open={open}
            onOpenChange={setOpen}
            trigger={
                trigger ?? (
                    <IconButton
                        variant="plain"
                        title="Potvrdi"
                        loading={isSubmitting}
                    >
                        <Check className="size-4 shrink-0" />
                    </IconButton>
                )
            }
        >
            <Stack spacing={2}>
                <Typography level="h5">{header}</Typography>
                <Typography>
                    Jeste li sigurni da želite potvrditi zadatak:{' '}
                    <strong>{label}</strong>?
                </Typography>
                <Row spacing={1} justifyContent="end">
                    <Button
                        variant="outlined"
                        onClick={() => setOpen(false)}
                        disabled={isSubmitting}
                    >
                        Odustani
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleConfirm}
                        loading={isSubmitting}
                        disabled={isSubmitting}
                    >
                        Potvrdi
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export default AcceptRequestModal;
