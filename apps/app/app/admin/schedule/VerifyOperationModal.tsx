'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Check } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
    onConfirm?: () => unknown | Promise<unknown>;
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
    onConfirm,
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
            if (onConfirm) {
                await onConfirm();
            } else {
                await verifyOperationAction(operationId);
            }
            setOpen(false);
        } catch (error) {
            console.error('Error verifying operation:', error);
            alert('Verifikacija radnje nije uspjela. Pokušajte ponovno.');
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
                <Stack spacing={4}>
                    <Typography level="h5">Verifikacija radnje</Typography>
                    <Typography>
                        Jeste li sigurni da želite verificirati radnju:{' '}
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
        </Fragment>
    );
}

export default VerifyOperationModal;
