import { useState } from 'react';
import { Modal } from "@signalco/ui-primitives/Modal";
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Close } from "@signalco/ui-icons";
import { useCancelOperation } from '../hooks/useCancelOperation';
import { OperationData } from '@gredice/client';

interface CancelOperationModalProps {
    operation?: OperationData;
    trigger: React.ReactElement;
}

export function CancelOperationModal({ operation, trigger }: CancelOperationModalProps) {
    const [open, setOpen] = useState(false);
    const cancelOperation = useCancelOperation();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!operation) return;

        const formData = new FormData(event.currentTarget);
        const reason = formData.get('reason') as string;

        try {
            await cancelOperation.mutateAsync({ operationId: operation.id, reason });
            setOpen(false);
        } catch (error) {
            console.error('Failed to cancel operation:', error);
            // TODO: Show notification
            alert('Greška pri otkazivanju radnje. Molimo pokušajte ponovno.');
        }
    }

    return (
        <Modal
            className="border border-tertiary border-b-4"
            trigger={trigger}
            title={`Otkaži: ${operation?.information.label}`}
            open={open}
            onOpenChange={setOpen}>
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">
                        Otkazivanje radnje
                    </Typography>
                    <Typography>
                        Radnja će biti otkazana i sredstva će ti biti vraćena ukoliko radnja nije besplatna.
                    </Typography>
                    <Stack spacing={1}>
                        <Typography level="body2">Razlog otkazivanja (opcionalno)</Typography>
                        <textarea
                            name="reason"
                            placeholder="Zašto otkazujete ovu radnju..."
                            className="w-full bg-card border border-muted rounded p-2"
                            disabled={cancelOperation.isPending}
                            rows={3}
                        />
                    </Stack>

                    <Row spacing={1}>
                        <Button
                            variant="plain"
                            onClick={() => setOpen(false)}
                            disabled={cancelOperation.isPending}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            color="danger"
                            disabled={cancelOperation.isPending}
                            loading={cancelOperation.isPending}
                            startDecorator={<Close className="size-5 shrink-0" />}
                        >
                            Otkaži radnju
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}
