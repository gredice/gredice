'use client';

import { Button } from '@gredice/ui/Button';
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
    const renderDefaultTrigger = (onClick?: () => void) => (
        <Button
            variant="solid"
            color="success"
            size="xs"
            title="Verificiraj radnju"
            loading={isSubmitting}
            onClick={onClick}
        >
            Potvrdi
        </Button>
    );
    const defaultTrigger = renderDefaultTrigger();

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
                defaultTrigger: renderDefaultTrigger(openModal),
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
