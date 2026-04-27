'use client';

import { Check } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { verifyOperationAction } from '../../(actions)/operationActions';

interface VerifyOperationModalProps {
    operationId: number;
    label: string;
    trigger?: React.ReactElement;
    renderTrigger?: (props: {
        isSubmitting: boolean;
        openModal: () => void;
    }) => React.ReactElement;
}

export function VerifyOperationModal({
    operationId,
    label,
    trigger,
    renderTrigger,
}: VerifyOperationModalProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const openModal = () => setOpen(true);

    const handleConfirm = async () => {
        try {
            setIsSubmitting(true);
            await verifyOperationAction(operationId);
            setOpen(false);
        } catch (error) {
            console.error('Error verifying operation:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title="Verifikacija radnje"
            open={open}
            onOpenChange={setOpen}
            trigger={
                renderTrigger
                    ? renderTrigger({
                          isSubmitting,
                          openModal,
                      })
                    : (trigger ?? (
                          <IconButton
                              variant="plain"
                              title="Verificiraj radnju"
                              loading={isSubmitting}
                          >
                              <Check className="size-4 shrink-0" />
                          </IconButton>
                      ))
            }
        >
            <Stack spacing={2}>
                <Typography level="h5">Verifikacija radnje</Typography>
                <Typography>
                    Jeste li sigurni da želite verificirati radnju:{' '}
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

export default VerifyOperationModal;
