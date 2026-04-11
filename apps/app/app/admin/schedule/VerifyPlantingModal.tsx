'use client';

import { Check } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { verifyRaisedBedPlantingAction } from '../../(actions)/raisedBedFieldsActions';

interface VerifyPlantingModalProps {
    raisedBedId: number;
    positionIndex: number;
    label: string;
}

export function VerifyPlantingModal({
    raisedBedId,
    positionIndex,
    label,
}: VerifyPlantingModalProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        try {
            setIsSubmitting(true);
            await verifyRaisedBedPlantingAction(raisedBedId, positionIndex);
            setOpen(false);
        } catch (error) {
            console.error('Error verifying planting:', error);
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
                <IconButton
                    variant="plain"
                    title="Verificiraj sijanje"
                    loading={isSubmitting}
                >
                    <Check className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <Stack spacing={2}>
                <Typography level="h5">Verifikacija sijanja</Typography>
                <Typography>
                    Jeste li sigurni da želite verificirati sijanje:{' '}
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
                        Verificiraj
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export default VerifyPlantingModal;
