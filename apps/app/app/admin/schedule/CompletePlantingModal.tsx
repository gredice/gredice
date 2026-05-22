'use client';

import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setErrorMessage(null);
        }
    };

    const handleConfirm = async () => {
        try {
            setErrorMessage(null);
            setIsSubmitting(true);
            handleOpenChange(false);
            await onConfirm();
            handleOpenChange(false);
        } catch (error) {
            console.error('Error completing planting:', error);
            setErrorMessage('Spremanje nije uspjelo. Pokušajte ponovno.');
            setOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title="Potvrda sijanja"
            open={open}
            onOpenChange={handleOpenChange}
            trigger={
                <Checkbox
                    className="size-5 mx-2"
                    checked={open}
                    onCheckedChange={(checked: boolean) =>
                        handleOpenChange(checked)
                    }
                />
            }
        >
            <Stack spacing={4}>
                <Typography>
                    Jeste li sigurni da želite označiti da je posijano:{' '}
                    <strong>{label}</strong>?
                </Typography>
                <Row spacing={2} justifyContent="end">
                    <Button
                        variant="outlined"
                        onClick={() => handleOpenChange(false)}
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
                {errorMessage && (
                    <Typography level="body2" className="text-red-600">
                        {errorMessage}
                    </Typography>
                )}
            </Stack>
        </Modal>
    );
}

export default CompletePlantingModal;
