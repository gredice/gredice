'use client';

import type { SelectTimeSlot } from '@gredice/storage';
import { Check, Edit, ShoppingCart, Truck } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useState, useTransition } from 'react';
import {
    changeDeliveryRequestSlotAction,
    updateDeliveryRequestStatusAction,
} from './actions';

type DeliveryRequest = {
    id: string;
    state: string;
    mode?: 'delivery' | 'pickup';
    operationId: number;
    slot?: { id: number };
};

type DeliveryRequestActionButtonsProps = {
    request: DeliveryRequest;
    slots: SelectTimeSlot[];
};

export function DeliveryRequestActionButtons({
    request,
    slots,
}: DeliveryRequestActionButtonsProps) {
    const [loading, setLoading] = useState<string | null>(null);
    const [showSlotForm, setShowSlotForm] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(
        request.slot?.id ?? undefined,
    );
    const [isPending, startTransition] = useTransition();

    const handleStatusUpdate = async (newStatus: string) => {
        setLoading(newStatus);
        try {
            const formData = new FormData();
            formData.append('requestId', request.id);
            formData.append('status', newStatus);
            await updateDeliveryRequestStatusAction(null, formData);
        } catch (error) {
            console.error('Error updating status:', error);
        } finally {
            setLoading(null);
        }
    };

    const handleConfirm = () => handleStatusUpdate('confirmed');
    const handlePreparing = () => handleStatusUpdate('preparing');
    const handleReady = () => handleStatusUpdate('ready');
    const handleFulfilled = () => handleStatusUpdate('fulfilled');
    const handleCancel = () => {
        if (confirm('Da li ste sigurni da želite otkazati ovaj zahtjev?')) {
            handleStatusUpdate('cancelled');
        }
    };

    const handleSlotSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
            await changeDeliveryRequestSlotAction(null, formData);
            setShowSlotForm(false);
        });
    };

    return (
        <Stack spacing={1}>
            {request.state === 'pending' && (
                <>
                    <Button
                        variant="outlined"
                        size="sm"
                        onClick={handleConfirm}
                        disabled={loading === 'confirmed'}
                        startDecorator={<Check className="size-4" />}
                    >
                        {loading === 'confirmed'
                            ? 'Potvrđivanje...'
                            : 'Potvrdi'}
                    </Button>
                    <Button
                        variant="plain"
                        size="sm"
                        onClick={handleCancel}
                        disabled={!!loading}
                        startDecorator={<Edit className="size-4" />}
                    >
                        Otkaži
                    </Button>
                </>
            )}

            {request.state === 'confirmed' && (
                <>
                    <Button
                        variant="outlined"
                        size="sm"
                        onClick={handlePreparing}
                        disabled={loading === 'preparing'}
                        startDecorator={<ShoppingCart className="size-4" />}
                    >
                        {loading === 'preparing' ? 'Priprema...' : 'U pripremi'}
                    </Button>
                    <Button
                        variant="plain"
                        size="sm"
                        onClick={handleCancel}
                        disabled={!!loading}
                        startDecorator={<Edit className="size-4" />}
                    >
                        Otkaži
                    </Button>
                </>
            )}

            {request.state === 'preparing' && (
                <Button
                    variant="outlined"
                    size="sm"
                    onClick={handleReady}
                    disabled={loading === 'ready'}
                    startDecorator={<Truck className="size-4" />}
                >
                    {loading === 'ready' ? 'Označavanje...' : 'Spreman'}
                </Button>
            )}

            {request.state === 'ready' && (
                <Button
                    variant="outlined"
                    size="sm"
                    onClick={handleFulfilled}
                    disabled={loading === 'fulfilled'}
                    startDecorator={<Check className="size-4" />}
                >
                    {loading === 'fulfilled' ? 'Završavanje...' : 'Ispunjen'}
                </Button>
            )}

            {showSlotForm ? (
                <form
                    onSubmit={handleSlotSubmit}
                    className="flex flex-col gap-1"
                >
                    <input type="hidden" name="requestId" value={request.id} />
                    <select
                        name="slotId"
                        value={selectedSlot}
                        onChange={(e) =>
                            setSelectedSlot(Number(e.target.value))
                        }
                        className="border rounded p-1 text-sm"
                    >
                        {slots
                            .filter((s) => s.status !== 'archived')
                            .map((slot) => (
                                <option key={slot.id} value={slot.id}>
                                    {new Date(slot.startAt).toLocaleString(
                                        'hr-HR',
                                    )}
                                </option>
                            ))}
                    </select>
                    <Row spacing={1}>
                        <Button
                            type="submit"
                            size="sm"
                            variant="outlined"
                            disabled={isPending}
                        >
                            Spremi
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="plain"
                            onClick={() => setShowSlotForm(false)}
                        >
                            Odustani
                        </Button>
                    </Row>
                </form>
            ) : (
                <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => setShowSlotForm(true)}
                    disabled={isPending}
                    startDecorator={<Edit className="size-4" />}
                >
                    Promijeni termin
                </Button>
            )}

            <Button
                variant="plain"
                size="sm"
                startDecorator={<Edit className="size-4" />}
                href={`/admin/operations/${request.operationId}`}
            >
                Vidi
            </Button>
        </Stack>
    );
}
