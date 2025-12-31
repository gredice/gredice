'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';

interface CompletePlantingModalProps {
    label: string;
    onConfirm: () => Promise<void>;
}

export function CompletePlantingModal({
    label,
    onConfirm,
}: CompletePlantingModalProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        try {
            setIsSubmitting(true);
            await onConfirm();
            setOpen(false);
        } catch (error) {
            console.error('Error completing planting:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title="Potvrda sijanja"
            open={open}
            onOpenChange={setOpen}
            trigger={
                <Checkbox
                    className="size-5 mx-2"
                    checked={open}
                    onCheckedChange={(checked: boolean) => setOpen(checked)}
                />
            }
        >
            <Stack spacing={2}>
                <Typography>
                    Jeste li sigurni da želite označiti da je posijano:{' '}
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

export default CompletePlantingModal;
