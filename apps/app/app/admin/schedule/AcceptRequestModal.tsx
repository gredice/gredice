'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Check } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';

interface AcceptRequestModalProps {
    label: string;
    onConfirm: () => unknown | Promise<unknown>;
    trigger?: React.ReactElement;
    title?: string;
    header?: string;
    raisedBedPhysicalId?: string;
}

export function AcceptRequestModal({
    label,
    onConfirm,
    trigger,
    title = 'Potvrda zadatka',
    header = 'Potvrda zadatka',
    raisedBedPhysicalId,
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
                        size="xs"
                        title="Potvrdi"
                        loading={isSubmitting}
                    >
                        <Check className="size-4 shrink-0" />
                    </IconButton>
                )
            }
        >
            <Stack spacing={4}>
                <Typography level="h5">{header}</Typography>
                {raisedBedPhysicalId && (
                    <RaisedBedLabel
                        physicalId={raisedBedPhysicalId}
                        size="compact"
                    />
                )}
                <Typography>
                    Jeste li sigurni da želite potvrditi zadatak:{' '}
                    <strong>{label}</strong>?
                </Typography>
                <Row spacing={2} justifyContent="end">
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
