import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Close, Info, ShoppingCart, Truck } from '@gredice/ui/icons';
import { TimeRange } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { useCancelDeliveryRequest } from '../../hooks/useDeliveryRequestMutations';
import type { DeliveryRequestData } from '../../hooks/useDeliveryRequests';
import { GameModal } from '../game-modal';

export const CANCEL_REASON_OPTIONS = [
    { value: 'USER_CHANGE_MIND', label: 'Predomislio/la sam se' },
    { value: 'WRONG_ADDRESS', label: 'Pogrešna adresa' },
    { value: 'WRONG_TIME', label: 'Pogrešno vrijeme' },
    { value: 'NO_LONGER_NEEDED', label: 'Više ne trebam' },
    { value: 'OTHER', label: 'Ostalo' },
];

function getCutoffTime(slot: DeliveryRequestData['slot']): Date | null {
    if (!slot) return null;
    const slotStart = new Date(slot.startAt);
    // Default cutoff is 12 hours before slot start
    const cutoff = new Date(slotStart.getTime() - 12 * 60 * 60 * 1000);
    return cutoff;
}

export function DeliveryCancelRequestModal({
    request,
    trigger,
}: {
    request: DeliveryRequestData;
    trigger: React.ReactElement;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [note, setNote] = useState('');
    const cancelRequest = useCancelDeliveryRequest();

    const cutoffTime = request.slot ? getCutoffTime(request.slot) : null;
    const timeUntilCutoff = cutoffTime ? cutoffTime.getTime() - Date.now() : 0;
    const hoursUntilCutoff = Math.max(
        0,
        Math.floor(timeUntilCutoff / (1000 * 60 * 60)),
    );
    const minutesUntilCutoff = Math.max(
        0,
        Math.floor((timeUntilCutoff % (1000 * 60 * 60)) / (1000 * 60)),
    );

    const handleCancel = async () => {
        if (!cancelReason) return;

        try {
            await cancelRequest.mutateAsync({
                requestId: request.id,
                cancelReason,
                note: note.trim() || undefined,
            });
            setIsOpen(false);
            setCancelReason('');
            setNote('');
        } catch (error) {
            console.error('Failed to cancel delivery request:', error);
        }
    };

    return (
        <GameModal
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Otkaži dostavu"
            trigger={trigger}
        >
            <Stack spacing={8}>
                <Alert
                    color="warning"
                    startDecorator={<Info className="size-4" />}
                >
                    Otkazivanje dostave je nepovratno. Termin će biti oslobođen
                    za druge korisnike.
                </Alert>

                {/* Request Summary */}
                <Card>
                    <CardContent>
                        <Stack spacing={4}>
                            <Typography level="h6">Detalji dostave</Typography>
                            <Row spacing={4}>
                                {request.mode === 'delivery' ? (
                                    <>
                                        <Truck className="size-4" />
                                        <Typography level="body2">
                                            Dostava na adresu
                                        </Typography>
                                    </>
                                ) : (
                                    <>
                                        <ShoppingCart className="size-4" />
                                        <Typography level="body2">
                                            Preuzimanje
                                        </Typography>
                                    </>
                                )}
                            </Row>

                            {request.mode === 'delivery' && request.address && (
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Adresa:
                                    </Typography>
                                    <Typography level="body2">
                                        {request.address.street1}
                                        {request.address.street2 &&
                                            `, ${request.address.street2}`}
                                        <br />
                                        {request.address.postalCode}{' '}
                                        {request.address.city}
                                    </Typography>
                                </Stack>
                            )}

                            {request.mode === 'pickup' && request.location && (
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Lokacija:
                                    </Typography>
                                    <Typography level="body2">
                                        {request.location.name}
                                    </Typography>
                                </Stack>
                            )}

                            {request.slot && (
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Termin:
                                    </Typography>
                                    <Typography level="body2">
                                        <TimeRange
                                            startAt={request.slot.startAt}
                                            endAt={request.slot.endAt}
                                        />
                                    </Typography>
                                </Stack>
                            )}
                        </Stack>
                    </CardContent>
                </Card>

                {/* Cutoff Warning */}
                {timeUntilCutoff > 0 && (
                    <Alert color="info">
                        Ostalo je {hoursUntilCutoff}h {minutesUntilCutoff}min do
                        krajnjeg roka za otkazivanje.
                    </Alert>
                )}

                {/* Cancel Form */}
                <Stack spacing={6}>
                    <SelectItems
                        value={cancelReason}
                        onValueChange={setCancelReason}
                        items={CANCEL_REASON_OPTIONS}
                        placeholder="Odaberite razlog otkazivanja"
                        label="Razlog otkazivanja"
                    />

                    <Input
                        label="Dodatne napomene (opciono)"
                        className="bg-card"
                        value={note}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNote(e.target.value)
                        }
                        placeholder="Dodatne informacije o razlogu otkazivanja..."
                    />
                </Stack>

                <Row spacing={4} justifyContent="end">
                    <Button
                        variant="outlined"
                        onClick={() => setIsOpen(false)}
                        disabled={cancelRequest.isPending}
                    >
                        Zatvori
                    </Button>
                    <Button
                        variant="solid"
                        color="danger"
                        onClick={handleCancel}
                        disabled={!cancelReason || cancelRequest.isPending}
                        loading={cancelRequest.isPending}
                        startDecorator={<Close className="size-4" />}
                    >
                        Otkaži dostavu
                    </Button>
                </Row>
            </Stack>
        </GameModal>
    );
}
