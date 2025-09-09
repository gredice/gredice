'use client';

import { Close } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { cancelOperationAction } from '../../(actions)/operationActions';

interface CancelOperationModalProps {
    operation: {
        id: number;
        entityId: number;
        scheduledDate?: Date;
        status: string;
    };
    operationLabel: string;
    trigger: React.ReactElement;
}

export function CancelOperationModal({
    operation,
    operationLabel,
    trigger,
}: CancelOperationModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        setIsLoading(true);
        try {
            await cancelOperationAction(formData);
            setOpen(false);
        } catch (error) {
            console.error('Error canceling operation:', error);
            alert(
                `Greška pri otkazivanju operacije: ${(error as Error).message}`,
            );
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Modal
            trigger={trigger}
            title={`Otkaži: ${operationLabel}`}
            open={open}
            onOpenChange={setOpen}
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">Otkazivanje operacije</Typography>
                    <Typography>
                        Operacija će biti otkazana i korisnik će biti
                        obaviješten o otkazivanju.
                        {operation.status === 'planned' &&
                            ' Ako je operacija plaćena suncokretima, oni će biti refundirani.'}
                    </Typography>

                    <input
                        type="hidden"
                        name="operationId"
                        value={operation.id}
                    />

                    <Stack spacing={1}>
                        <Typography level="body2">
                            Razlog otkazivanja
                        </Typography>
                        <textarea
                            name="reason"
                            placeholder="Unesite razlog otkazivanja operacije..."
                            className="w-full bg-card border border-muted rounded p-2"
                            disabled={isLoading}
                            required
                            rows={3}
                        />
                    </Stack>

                    <Row spacing={1}>
                        <Button
                            variant="plain"
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            color="danger"
                            disabled={isLoading}
                            loading={isLoading}
                            startDecorator={
                                <Close className="size-5 shrink-0" />
                            }
                        >
                            Otkaži operaciju
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}
