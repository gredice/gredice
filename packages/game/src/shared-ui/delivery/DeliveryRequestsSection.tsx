import { useState } from 'react';
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Row } from "@signalco/ui-primitives/Row";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Modal } from "@signalco/ui-primitives/Modal";
import { ModalConfirm } from "@signalco/ui/ModalConfirm";
import { Input } from "@signalco/ui-primitives/Input";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import {
    Truck,
    ShoppingCart,
    Timer,
    MapPin,
    Close,
    Approved,
    Info
} from "@signalco/ui-icons";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { useDeliveryRequests, DeliveryRequestData } from "../../hooks/useDeliveryRequests";
import { useCancelDeliveryRequest } from "../../hooks/useDeliveryRequestMutations";

const CANCEL_REASON_OPTIONS = [
    { value: 'USER_CHANGE_MIND', label: 'Predomislio/la sam se' },
    { value: 'WRONG_ADDRESS', label: 'Pogrešna adresa' },
    { value: 'WRONG_TIME', label: 'Pogrešno vrijeme' },
    { value: 'NO_LONGER_NEEDED', label: 'Više ne trebam' },
    { value: 'OTHER', label: 'Ostalo' }
];

function getStatusColor(state: string) {
    switch (state) {
        case 'pending':
            return 'warning';
        case 'scheduled':
            return 'info';
        case 'fulfilled':
            return 'success';
        case 'cancelled':
            return 'danger';
        default:
            return 'neutral';
    }
}

function getStatusLabel(state: string) {
    switch (state) {
        case 'pending':
            return 'Na čekanju';
        case 'scheduled':
            return 'Zakazano';
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
    if (request.state !== 'pending' && request.state !== 'scheduled') {
        return false;
    }

    if (!request.slot) return false;

    const cutoffTime = getCutoffTime(request.slot);
    if (!cutoffTime) return false;

    return new Date() < cutoffTime;
}

function CancelRequestModal({
    request,
    trigger
}: {
    request: DeliveryRequestData;
    trigger: React.ReactElement;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [reasonCode, setReasonCode] = useState('');
    const [note, setNote] = useState('');
    const cancelRequest = useCancelDeliveryRequest();

    const cutoffTime = request.slot ? getCutoffTime(request.slot) : null;
    const timeUntilCutoff = cutoffTime ? cutoffTime.getTime() - Date.now() : 0;
    const hoursUntilCutoff = Math.max(0, Math.floor(timeUntilCutoff / (1000 * 60 * 60)));
    const minutesUntilCutoff = Math.max(0, Math.floor((timeUntilCutoff % (1000 * 60 * 60)) / (1000 * 60)));

    const handleCancel = async () => {
        if (!reasonCode) return;

        try {
            await cancelRequest.mutateAsync({
                requestId: request.id,
                reasonCode,
                note: note.trim() || undefined
            });
            setIsOpen(false);
            setReasonCode('');
            setNote('');
        } catch (error) {
            console.error('Failed to cancel delivery request:', error);
        }
    };

    const formatSlotTime = (slot: any) => {
        const start = new Date(slot.startAt);
        const end = new Date(slot.endAt);
        return `${start.toLocaleDateString('hr-HR')} ${start.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit'
        })} - ${end.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit'
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
                <Alert color="warning" startDecorator={<Info className="size-4" />}>
                    Otkazivanje dostave je nepovratno. Termin će biti oslobođen za druge korisnike.
                </Alert>

                {/* Request Summary */}
                <Card>
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography level="h6">Detalji dostave</Typography>
                            <Row spacing={2} alignItems="center">
                                {request.mode === 'delivery' ? (
                                    <>
                                        <Truck className="size-4" />
                                        <Typography level="body2">Dostava na adresu</Typography>
                                    </>
                                ) : (
                                    <>
                                        <ShoppingCart className="size-4" />
                                        <Typography level="body2">Preuzimanje</Typography>
                                    </>
                                )}
                            </Row>

                            {request.address && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>Adresa:</Typography>
                                    <Typography level="body2">
                                        {request.address.street1}
                                        {request.address.street2 && `, ${request.address.street2}`}
                                        <br />
                                        {request.address.postalCode} {request.address.city}
                                    </Typography>
                                </Stack>
                            )}

                            {request.location && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>Lokacija:</Typography>
                                    <Typography level="body2">{request.location.name}</Typography>
                                </Stack>
                            )}

                            {request.slot && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>Termin:</Typography>
                                    <Typography level="body2">{formatSlotTime(request.slot)}</Typography>
                                </Stack>
                            )}
                        </Stack>
                    </CardContent>
                </Card>

                {/* Cutoff Warning */}
                {timeUntilCutoff > 0 && (
                    <Alert color="info">
                        Ostalo je {hoursUntilCutoff}h {minutesUntilCutoff}min do krajnjeg roka za otkazivanje.
                    </Alert>
                )}

                {/* Cancel Form */}
                <Stack spacing={3}>
                    <SelectItems
                        value={reasonCode}
                        onValueChange={setReasonCode}
                        items={CANCEL_REASON_OPTIONS}
                        placeholder="Odaberite razlog otkazivanja"
                        label="Razlog otkazivanja"
                    />

                    <Input
                        label="Dodatne napomene (opciono)"
                        value={note}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
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
                        disabled={!reasonCode || cancelRequest.isPending}
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
        return `${start.toLocaleDateString('hr-HR')} ${start.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit'
        })} - ${end.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    };

    return (
        <Card>
            <CardContent>
                <Stack spacing={3}>
                    <Row justifyContent="space-between" alignItems="start">
                        <Stack spacing={2}>
                            <Row spacing={2} alignItems="center">
                                {request.mode === 'delivery' ? (
                                    <>
                                        <Truck className="size-5" />
                                        <Typography level="h6">Dostava</Typography>
                                    </>
                                ) : (
                                    <>
                                        <ShoppingCart className="size-5" />
                                        <Typography level="h6">Preuzimanje</Typography>
                                    </>
                                )}
                                <Chip
                                    color={getStatusColor(request.state) as any}
                                    startDecorator={getStatusIcon(request.state)}
                                >
                                    {getStatusLabel(request.state)}
                                </Chip>
                            </Row>

                            {request.address && (
                                <Row spacing={1} alignItems="start">
                                    <MapPin className="size-4 mt-0.5 text-muted-foreground" />
                                    <Stack spacing={0.5}>
                                        <Typography level="body2">{request.address.label}</Typography>
                                        <Typography level="body3" secondary>
                                            {request.address.street1}
                                            {request.address.street2 && `, ${request.address.street2}`}
                                            <br />
                                            {request.address.postalCode} {request.address.city}
                                        </Typography>
                                    </Stack>
                                </Row>
                            )}

                            {request.location && (
                                <Row spacing={1} alignItems="center">
                                    <MapPin className="size-4 text-muted-foreground" />
                                    <Typography level="body2">{request.location.name}</Typography>
                                </Row>
                            )}

                            {request.slot && (
                                <Row spacing={1} alignItems="center">
                                    <Timer className="size-4 text-muted-foreground" />
                                    <Typography level="body2">{formatSlotTime(request.slot)}</Typography>
                                </Row>
                            )}

                            {request.requestNotes && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>Napomene:</Typography>
                                    <Typography level="body2">{request.requestNotes}</Typography>
                                </Stack>
                            )}

                            {request.cancelReason && (
                                <Stack spacing={0.5}>
                                    <Typography level="body3" secondary>Razlog otkazivanja:</Typography>
                                    <Typography level="body2">
                                        {CANCEL_REASON_OPTIONS.find(opt => opt.value === request.cancelReason)?.label || request.cancelReason}
                                    </Typography>
                                </Stack>
                            )}
                        </Stack>

                        {canCancel && (
                            <CancelRequestModal
                                request={request}
                                trigger={
                                    <Button
                                        variant="outlined"
                                        color="danger"
                                        size="sm"
                                        startDecorator={<Close className="size-4" />}
                                    >
                                        Otkaži
                                    </Button>
                                }
                            />
                        )}
                    </Row>
                </Stack>
            </CardContent>
        </Card>
    );
}

export function DeliveryRequestsSection() {
    const { data: requests, isLoading } = useDeliveryRequests();

    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">Moje dostave</Typography>

            {isLoading ? (
                <Typography>Učitavanje dostava...</Typography>
            ) : requests && requests.length > 0 ? (
                <Stack spacing={3}>
                    {requests.map((request) => (
                        <DeliveryRequestCard key={request.id} request={request} />
                    ))}
                </Stack>
            ) : (
                <Card>
                    <CardContent>
                        <Stack spacing={2} alignItems="center" className="py-8">
                            <Truck className="size-12 text-muted-foreground" />
                            <Typography level="h6">Nema dostava</Typography>
                            <Typography level="body3" secondary>
                                Trenutno nemate zakazanih dostava
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Stack>
    );
}
