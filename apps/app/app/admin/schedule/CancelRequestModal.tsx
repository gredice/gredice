'use client';

import { Close } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';

interface CancelRequestModalProps {
    label: string;
    trigger: React.ReactElement;
    onSubmit: (formData: FormData) => Promise<void>;
    hiddenFields: React.ReactNode;
    description?: string;
    confirmLabel?: string;
    additionalFields?: React.ReactNode;
}

export function CancelRequestModal({
    label,
    trigger,
    onSubmit,
    hiddenFields,
    description,
    confirmLabel = 'Otkaži zadatak',
    additionalFields,
}: CancelRequestModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        setIsLoading(true);
        try {
            await onSubmit(formData);
            setOpen(false);
        } catch (error) {
            console.error('Error canceling item:', error);
            alert(`Greška pri otkazivanju: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Modal
            trigger={trigger}
            title={`Otkaži: ${label}`}
            open={open}
            onOpenChange={setOpen}
        >
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">Otkazivanje zadatka</Typography>
                    <Typography>
                        {description ||
                            'Zadatak će biti otkazan i korisnik će biti obaviješten o otkazivanju.'}
                    </Typography>

                    {hiddenFields}

                    {additionalFields}

                    <Stack spacing={1}>
                        <Typography level="body2">
                            Razlog otkazivanja
                        </Typography>
                        <textarea
                            name="reason"
                            placeholder="Unesite razlog otkazivanja..."
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
                            {confirmLabel}
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}

export default CancelRequestModal;
