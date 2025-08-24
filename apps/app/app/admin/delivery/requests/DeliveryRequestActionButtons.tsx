'use client';

import { Check, Edit, ShoppingCart, Truck } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useState } from 'react';
import { updateDeliveryRequestStatusAction } from './actions';

type DeliveryRequest = {
    id: string;
    state: string;
    mode?: 'delivery' | 'pickup';
    operationId: number;
};

type DeliveryRequestActionButtonsProps = {
    request: DeliveryRequest;
};

export function DeliveryRequestActionButtons({
    request,
}: DeliveryRequestActionButtonsProps) {
    const [loading, setLoading] = useState<string | null>(null);

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
