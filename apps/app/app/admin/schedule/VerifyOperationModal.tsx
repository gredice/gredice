'use client';

import { Check } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Fragment, useState } from 'react';
import { verifyOperationAction } from '../../(actions)/operationActions';

interface VerifyOperationModalTriggerProps {
    isSubmitting: boolean;
    openModal: () => void;
    defaultTrigger: React.ReactElement;
}

interface VerifyOperationModalBaseProps {
    operationId: number;
    label: string;
}

type VerifyOperationModalProps = VerifyOperationModalBaseProps &
    (
        | {
              trigger?: React.ReactElement;
              renderTrigger?: never;
          }
        | {
              trigger?: never;
              renderTrigger: (
                  props: VerifyOperationModalTriggerProps,
              ) => React.ReactElement;
          }
    );

export function VerifyOperationModal({
    operationId,
    label,
    trigger,
    renderTrigger,
}: VerifyOperationModalProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const openModal = () => setOpen(true);
    const defaultTrigger = (
        <IconButton
            variant="plain"
            title="Verificiraj radnju"
            loading={isSubmitting}
            onClick={openModal}
        >
            <Check className="size-4 shrink-0" />
        </IconButton>
    );

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
        <Fragment>
            {renderTrigger?.({
                isSubmitting,
                openModal,
                defaultTrigger,
            })}
            <Modal
                title="Verifikacija radnje"
                open={open}
                onOpenChange={setOpen}
                trigger={
                    renderTrigger ? undefined : (trigger ?? defaultTrigger)
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
        </Fragment>
    );
}

export default VerifyOperationModal;
