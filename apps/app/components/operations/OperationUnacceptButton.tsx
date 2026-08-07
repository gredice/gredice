'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Undo } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { unacceptOperationAction } from '../../app/(actions)/operationActions';
import { canUnacceptOperationTask } from '../../app/admin/schedule/scheduleShared';

interface OperationUnacceptButtonProps {
    operationId: number;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    operationStatus: string;
    operationLabel: string;
}

export function OperationUnacceptButton({
    operationId,
    expectedEntityId,
    expectedTaskVersionEventId,
    operationStatus,
    operationLabel,
}: OperationUnacceptButtonProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleConfirm() {
        try {
            setIsSubmitting(true);
            await unacceptOperationAction(
                operationId,
                expectedEntityId,
                expectedTaskVersionEventId,
            );
            setOpen(false);
        } catch (error) {
            console.error('Error unaccepting operation:', error);
            alert(
                'Poništavanje potvrde radnje nije uspjelo. Pokušajte ponovno.',
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!canUnacceptOperationTask(operationStatus)) {
        return null;
    }

    return (
        <Modal
            title="Poništavanje potvrde radnje"
            open={open}
            onOpenChange={setOpen}
            trigger={
                <IconButton
                    variant="plain"
                    title="Poništi potvrdu radnje"
                    loading={isSubmitting}
                >
                    <Undo className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <Stack spacing={4}>
                <Typography level="h5">Poništavanje potvrde radnje</Typography>
                <Typography>
                    Jeste li sigurni da želite poništiti potvrdu radnje:{' '}
                    <strong>{operationLabel}</strong>?
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
                        Poništi potvrdu
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}
