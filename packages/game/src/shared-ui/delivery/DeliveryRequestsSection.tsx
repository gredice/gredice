import { Alert } from '@signalco/ui/Alert';
import {
    Approved,
    Close,
    Info,
    MapPin,
    Navigate,
    ShoppingCart,
    Timer,
    Truck,
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { useCancelDeliveryRequest } from '../../hooks/useDeliveryRequestMutations';
import {
    type DeliveryRequestData,
    useDeliveryRequests,
} from '../../hooks/useDeliveryRequests';
import { KnownPages } from '../../knownPages';

const CANCEL_REASON_OPTIONS = [
    { value: 'USER_CHANGE_MIND', label: 'Predomislio/la sam se' },
    { value: 'WRONG_ADDRESS', label: 'Pogrešna adresa' },
    { value: 'WRONG_TIME', label: 'Pogrešno vrijeme' },
    { value: 'NO_LONGER_NEEDED', label: 'Više ne trebam' },
    { value: 'OTHER', label: 'Ostalo' },
];

function getStatusColor(state: string) {
    switch (state) {
        case 'pending':
            return 'warning';
        case 'confirmed':
            return 'info';
        case 'preparing':
            return 'info';
        case 'ready':
            return 'info';
        case 'fulfilled':
            return 'success';
        case 'cancelled':
            return 'error';
        default:
            return 'neutral';
    }
}

function getStatusLabel(state: string) {
    switch (state) {
        case 'pending':
            return 'Na čekanju';
        case 'confirmed':
            return 'Zakazano';
        case 'preparing':
            return 'Priprema';
        case 'ready':
            return 'Spremno';
        case 'fulfilled':
            return 'Izvršeno';
        case 'cancelled':
            return 'Otkazano';
        default:
            return state;
    }
}

function getStatusIcon(state: string) {
    switch (state) {
        case 'pending':
            return <Timer className="size-4" />;
        case 'scheduled':
            return <Approved className="size-4" />;
        case 'fulfilled':
            return <Approved className="size-4" />;
        case 'cancelled':
            return <Close className="size-4" />;
        default:
            return <Timer className="size-4" />;
    }
}

function getCutoffTime(slot: any): Date | null {
    if (!slot) return null;
    const slotStart = new Date(slot.startAt);
    // Default cutoff is 12 hours before slot start
    const cutoff = new Date(slotStart.getTime() - 12 * 60 * 60 * 1000);
    return cutoff;
}

function canCancelRequest(request: DeliveryRequestData): boolean {
    if (request.state !== 'pending' && request.state !== 'confirmed') {
        return false;
    }

    // if (!request.slot) return false;

    // const cutoffTime = getCutoffTime(request.slot);
    // if (!cutoffTime) return false;

    // return new Date() < cutoffTime;
    return true;
}

function CancelRequestModal({
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

    const formatSlotTime = (slot: any) => {
        const start = new Date(slot.startAt);
        const end = new Date(slot.endAt);
        return `${start.toLocaleDateString('hr-HR')} ${start.toLocaleTimeString(
            'hr-HR',
            {
                hour: '2-digit',
                minute: '2-digit',
            },
        )} - ${end.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    };

    return (
        <Modal
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Otkaži dostavu"
            trigger={trigger}
        >
            <Stack spacing={4}>
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
                        <Stack spacing={2}>
                            <Typography level="h6">Detalji dostave</Typography>
                            <Row spacing={2}>
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

                            {request.address && (
                                <Stack spacing={0.5}>
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

                            {request.location && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>
                                        Lokacija:
                                    </Typography>
                                    <Typography level="body2">
                                        {request.location.name}
                                    </Typography>
                                </Stack>
                            )}

                            {request.slot && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>
                                        Termin:
                                    </Typography>
                                    <Typography level="body2">
                                        {formatSlotTime(request.slot)}
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
                <Stack spacing={3}>
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

                <Row spacing={2} justifyContent="end">
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
        </Modal>
    );
}

function DeliveryRequestCard({ request }: { request: DeliveryRequestData }) {
    const canCancel = canCancelRequest(request);

    const formatSlotTime = (slot: any) => {
        const start = new Date(slot.startAt);
        const end = new Date(slot.endAt);
        return `${start.toLocaleDateString('hr-HR')} ${start.toLocaleTimeString(
            'hr-HR',
            {
                hour: '2-digit',
                minute: '2-digit',
            },
        )} - ${end.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    };

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={3}>
                    <div className="flex flex-col md:flex-row gap-1 md:items-center">
                        <Stack spacing={1} className="w-full">
                            {request.mode === 'delivery' ? (
                                <Row spacing={1}>
                                    <Truck className="size-5 shrink-0" />
                                    <Typography>Dostava</Typography>
                                </Row>
                            ) : (
                                <Row spacing={1}>
                                    <ShoppingCart className="size-5 shrink-0" />
                                    <Typography>Preuzimanje</Typography>
                                </Row>
                            )}

                            {request.address && (
                                <Row spacing={1} alignItems="start">
                                    <MapPin className="size-4 mt-0.5 text-muted-foreground" />
                                    <Stack spacing={0.5}>
                                        <Typography level="body2">
                                            {request.address.label}
                                        </Typography>
                                        <Typography level="body3" secondary>
                                            {request.address.street1}
                                            {request.address.street2 &&
                                                `, ${request.address.street2}`}
                                            <br />
                                            {request.address.postalCode}{' '}
                                            {request.address.city}
                                        </Typography>
                                    </Stack>
                                </Row>
                            )}

                            {request.location && (
                                <Row spacing={1}>
                                    <MapPin className="size-4 text-muted-foreground" />
                                    <Typography level="body2">
                                        {request.location.name}
                                    </Typography>
                                </Row>
                            )}

                            {request.slot && (
                                <Row spacing={1}>
                                    <Timer className="size-4 text-muted-foreground" />
                                    <Typography level="body2">
                                        {formatSlotTime(request.slot)}
                                    </Typography>
                                </Row>
                            )}

                            {request.requestNotes && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>
                                        Napomene:
                                    </Typography>
                                    <Typography level="body2">
                                        {request.requestNotes}
                                    </Typography>
                                </Stack>
                            )}

                            {request.cancelReason && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>
                                        Razlog otkazivanja:
                                    </Typography>
                                    <Typography level="body2">
                                        {CANCEL_REASON_OPTIONS.find(
                                            (opt) =>
                                                opt.value ===
                                                request.cancelReason,
                                        )?.label || request.cancelReason}
                                    </Typography>
                                </Stack>
                            )}
                        </Stack>
                        <Row spacing={1}>
                            <Chip
                                color={getStatusColor(request.state) as any}
                                startDecorator={getStatusIcon(request.state)}
                            >
                                {getStatusLabel(request.state)}
                            </Chip>
                            {canCancel && (
                                <CancelRequestModal
                                    request={request}
                                    trigger={
                                        <Button
                                            variant="outlined"
                                            color="danger"
                                            size="sm"
                                            startDecorator={
                                                <Close className="size-4" />
                                            }
                                        >
                                            Otkaži
                                        </Button>
                                    }
                                />
                            )}
                        </Row>
                    </div>
                </Stack>
            </CardContent>
        </Card>
    );
}

export function DeliveryRequestsSection() {
    const { data: requests, isLoading } = useDeliveryRequests();

    return (
        <Stack spacing={2}>
            <Row spacing={1} justifyContent="space-between">
                <Typography level="h5">Moje dostave</Typography>
                <Button
                    variant="link"
                    href={KnownPages.GrediceDeliverySlots}
                    endDecorator={<Navigate className="size-5 shrink-0" />}
                >
                    📅 Termini dostave
                </Button>
            </Row>
            {isLoading ? (
                <Typography>Učitavanje dostava...</Typography>
            ) : requests && requests.length > 0 ? (
                <Stack spacing={1}>
                    {requests.map((request) => (
                        <DeliveryRequestCard
                            key={request.id}
                            request={request}
                        />
                    ))}
                </Stack>
            ) : (
                <Card>
                    <CardContent>
                        <Stack spacing={2} alignItems="center" className="py-8">
                            <Truck className="size-12 text-muted-foreground" />
                            <Typography level="h6">Nema dostava</Typography>
                            <Typography level="body3" secondary>
                                Trenutno nema zakazanih dostava
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Stack>
    );
}
