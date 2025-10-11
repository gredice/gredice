import { TimeRange } from '@gredice/ui/LocalDateTime';
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@signalco/ui-primitives/Tooltip';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';
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
        case 'scheduled':
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
        case 'scheduled':
            return 'Zakazano';
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

function getStatusDescription(state: string) {
    switch (state) {
        case 'pending':
            return 'Zahtjev je primljen i čeka potvrdu naše ekipe.';
        case 'scheduled':
        case 'confirmed':
            return 'Termin je potvrđen i pripremamo vašu dostavu.';
        case 'preparing':
            return 'Vaša narudžba je u pripremi.';
        case 'ready':
            return 'Narudžba je spremna za isporuku ili preuzimanje.';
        case 'fulfilled':
            return 'Dostava je uspješno završena.';
        case 'cancelled':
            return 'Dostava je otkazana.';
        default:
            return 'Status dostave trenutno nije poznat.';
    }
}

function getStatusIcon(state: string) {
    switch (state) {
        case 'pending':
            return <Timer className="size-4" />;
        case 'scheduled':
        case 'confirmed':
            return <Approved className="size-4" />;
        case 'preparing':
            return <Info className="size-4" />;
        case 'ready':
        case 'fulfilled':
            return <Approved className="size-4" />;
        case 'cancelled':
            return <Close className="size-4" />;
        default:
            return <Timer className="size-4" />;
    }
}

function getCutoffTime(slot: DeliveryRequestData['slot']): Date | null {
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

                            {request.mode === 'delivery' && request.address && (
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

                            {request.mode === 'pickup' && request.location && (
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

function StatusChip({ state }: { state: string }) {
    return (
        <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
                <Chip
                    color={getStatusColor(state)}
                    startDecorator={getStatusIcon(state)}
                >
                    {getStatusLabel(state)}
                </Chip>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                <Typography level="body3">
                    {getStatusDescription(state)}
                </Typography>
            </TooltipContent>
        </Tooltip>
    );
}

function DeliveryRequestRow({
    request,
    showSlot = true,
}: {
    request: DeliveryRequestData;
    showSlot?: boolean;
}) {
    const canCancel = canCancelRequest(request);

    return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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

                {request.slot && showSlot && (
                    <Row spacing={1}>
                        <Timer className="size-4 text-muted-foreground" />
                        <Typography level="body2">
                            <TimeRange
                                startAt={request.slot.startAt}
                                endAt={request.slot.endAt}
                            />
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
                                (opt) => opt.value === request.cancelReason,
                            )?.label || request.cancelReason}
                        </Typography>
                    </Stack>
                )}
            </Stack>
            <Row spacing={1} className="shrink-0">
                <StatusChip state={request.state} />
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
        </div>
    );
}

function DeliveryRequestCard({ request }: { request: DeliveryRequestData }) {
    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={3}>
                    <DeliveryRequestRow request={request} />
                </Stack>
            </CardContent>
        </Card>
    );
}

function formatDeliveryCount(count: number) {
    if (count === 1) return '1 dostava';
    if (count >= 2 && count <= 4) return `${count} dostave`;
    return `${count} dostava`;
}

function DeliveryRequestGroupCard({
    requests,
}: {
    requests: DeliveryRequestData[];
}) {
    const firstRequest = requests[0];
    const uniqueModes = new Set(
        requests.map((request) => request.mode ?? 'delivery'),
    );
    const isPickupOnly = uniqueModes.size === 1 && uniqueModes.has('pickup');
    const groupIcon = isPickupOnly ? (
        <ShoppingCart className="size-5 shrink-0" />
    ) : (
        <Truck className="size-5 shrink-0" />
    );
    const groupLabel = isPickupOnly
        ? 'Preuzimanja'
        : uniqueModes.size > 1
          ? 'Dostave i preuzimanja'
          : 'Dostave';

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={3}>
                    <Stack spacing={0.5}>
                        <Row spacing={1} alignItems="center">
                            {groupIcon}
                            <Typography>{groupLabel}</Typography>
                            <Chip
                                size="sm"
                                color="info"
                                className="font-semibold"
                            >
                                {formatDeliveryCount(requests.length)}
                            </Chip>
                        </Row>
                        <Typography level="body3" secondary>
                            Ukupno zahtjeva: {requests.length}
                        </Typography>
                    </Stack>

                    {firstRequest.slot && (
                        <Row spacing={1}>
                            <Timer className="size-4 text-muted-foreground" />
                            <Typography level="body2">
                                <TimeRange
                                    startAt={firstRequest.slot.startAt}
                                    endAt={firstRequest.slot.endAt}
                                />
                            </Typography>
                        </Row>
                    )}

                    <Stack spacing={2}>
                        {requests.map((request, index) => (
                            <div
                                key={request.id}
                                className={
                                    index === 0
                                        ? undefined
                                        : 'pt-2 border-t border-border/60'
                                }
                            >
                                <DeliveryRequestRow
                                    request={request}
                                    showSlot={false}
                                />
                            </div>
                        ))}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

type DeliveryRequestGroup = {
    key: string;
    requests: DeliveryRequestData[];
    slotStart?: string | null;
};

function groupRequestsBySlot(
    requests: DeliveryRequestData[],
): DeliveryRequestGroup[] {
    const groups: DeliveryRequestGroup[] = [];
    const map = new Map<string, DeliveryRequestGroup>();

    requests.forEach((request, index) => {
        const slotKey = request.slot?.id ?? request.slot?.startAt;

        if (!slotKey) {
            groups.push({ key: `${request.id}-${index}`, requests: [request] });
            return;
        }

        const key = String(slotKey);
        const existing = map.get(key);

        if (existing) {
            existing.requests.push(request);
        } else {
            const group: DeliveryRequestGroup = {
                key,
                requests: [request],
                slotStart: request.slot?.startAt ?? null,
            };
            map.set(key, group);
            groups.push(group);
        }
    });

    return groups.sort((a, b) => {
        if (a.slotStart && b.slotStart) {
            return (
                new Date(a.slotStart).getTime() -
                new Date(b.slotStart).getTime()
            );
        }

        if (a.slotStart) return -1;
        if (b.slotStart) return 1;
        return 0;
    });
}

export function DeliveryRequestsSection() {
    const { data: requests, isLoading } = useDeliveryRequests();
    const groupedRequests = useMemo(
        () => (requests ? groupRequestsBySlot(requests) : []),
        [requests],
    );

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
            ) : groupedRequests.length > 0 ? (
                <Stack spacing={1}>
                    {groupedRequests.map((group) =>
                        group.requests.length === 1 ? (
                            <DeliveryRequestCard
                                key={group.requests[0].id}
                                request={group.requests[0]}
                            />
                        ) : (
                            <DeliveryRequestGroupCard
                                key={group.key}
                                requests={group.requests}
                            />
                        ),
                    )}
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
