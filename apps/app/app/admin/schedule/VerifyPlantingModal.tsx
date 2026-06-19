'use client';

import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { verifyRaisedBedPlantingAction } from '../../(actions)/raisedBedFieldsActions';

interface VerifyPlantingModalProps {
    raisedBedId: number;
    positionIndex: number;
    label: string;
    onConfirm?: () => unknown | Promise<unknown>;
}

export function VerifyPlantingModal({
    raisedBedId,
    positionIndex,
    label,
    onConfirm,
}: VerifyPlantingModalProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        try {
            setIsSubmitting(true);
            if (onConfirm) {
                await onConfirm();
            } else {
                await verifyRaisedBedPlantingAction(raisedBedId, positionIndex);
            }
            setOpen(false);
        } catch (error) {
            console.error('Error verifying planting:', error);
            alert('Verifikacija sijanja nije uspjela. Pokušajte ponovno.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title="Verifikacija sijanja"
            open={open}
            onOpenChange={setOpen}
            trigger={
                <Button
                    variant="solid"
                    color="success"
                    size="sm"
                    title="Verificiraj sijanje"
                    loading={isSubmitting}
                >
                    Potvrdi
                </Button>
            }
        >
            <Stack spacing={4}>
                <Typography level="h5">Verifikacija sijanja</Typography>
                <Typography>
                    Jeste li sigurni da želite verificirati sijanje:{' '}
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
                        Verificiraj
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export default VerifyPlantingModal;
