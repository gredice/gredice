import { LocalDateTime, TimeRange } from '@gredice/ui/LocalDateTime';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { KnownPages } from '../../../src/KnownPages';
import type { DeliveryRequest } from './types';

function getStatusColor(
    status: string,
): 'primary' | 'warning' | 'info' | 'success' | 'neutral' | 'error' {
    switch (status) {
        case 'pending':
            return 'error';
        case 'confirmed':
        case 'preparing':
            return 'warning';
        case 'ready':
            return 'info';
        case 'fulfilled':
            return 'success';
        case 'cancelled':
            return 'neutral';
        default:
            return 'neutral';
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'pending':
            return '❓ Na čekanju';
        case 'confirmed':
            return '📆 Potvrđen';
        case 'preparing':
            return '⌛ U pripremi';
        case 'ready':
            return '🛍️ Spreman';
        case 'fulfilled':
            return '✅ Ispunjen';
        case 'cancelled':
            return '❌ Otkazan';
        default:
            return status;
    }
}

function getModeLabel(mode: string | null | undefined) {
    switch (mode) {
        case 'delivery':
            return '🛻 Dostava';
        case 'pickup':
            return '🚶 Preuzimanje';
        default:
            return mode || '-';
    }
}

function formatAddress(request: DeliveryRequest) {
    const { address } = request;
    if (!address) {
        return undefined;
    }

    const lines = [
        [address.street1, address.street2].filter(Boolean).join(', '),
        [address.postalCode, address.city].filter(Boolean).join(' '),
    ]
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.length > 0 ? lines.join(' • ') : undefined;
}

export function DeliveryRequestsSection({
    requests,
}: {
    requests: DeliveryRequest[];
}) {
    if (requests.length === 0) {
        return null;
    }

    const now = new Date();

    return (
        <Stack spacing={1}>
            <Typography level="body1" semiBold>
                Zahtjevi za dostavu
            </Typography>
            <Stack spacing={1} className="border rounded-lg p-3">
                {requests.map((request) => {
                    const slot = request.slot;
                    const contactName = request.address?.contactName;
                    const phone = request.address?.phone;
                    const address = formatAddress(request);
                    const isDelivery = request.mode === 'delivery';
                    const isCompleted = request.state === 'fulfilled';
                    const isCancelled = request.state === 'cancelled';
                    const slotStart = slot?.startAt
                        ? new Date(slot.startAt)
                        : undefined;
                    const isOverdue =
                        !isCompleted &&
                        !isCancelled &&
                        slotStart !== undefined &&
                        slotStart.getTime() < now.getTime();

                    return (
                        <Stack
                            key={request.id}
                            spacing={0.75}
                            className="bg-muted/40 rounded-lg p-3"
                        >
                            <Row
                                spacing={0.5}
                                className="items-center flex-wrap gap-y-1"
                            >
                                <Chip
                                    color={getStatusColor(request.state)}
                                    className="w-fit"
                                >
                                    {getStatusLabel(request.state)}
                                </Chip>
                                <Chip color="primary" className="w-fit">
                                    {getModeLabel(request.mode)}
                                </Chip>
                                {slot ? (
                                    <Typography
                                        level="body2"
                                        className={
                                            isOverdue
                                                ? 'text-red-600'
                                                : undefined
                                        }
                                    >
                                        <TimeRange
                                            startAt={slot.startAt}
                                            endAt={slot.endAt}
                                        />
                                    </Typography>
                                ) : (
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        Bez termina
                                    </Typography>
                                )}
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Kreirano:{' '}
                                    <LocalDateTime>
                                        {request.createdAt}
                                    </LocalDateTime>
                                </Typography>
                            </Row>
                            <Stack spacing={0.25}>
                                {isDelivery ? (
                                    <>
                                        <Typography level="body2">
                                            {contactName || 'Nepoznat kontakt'}
                                        </Typography>
                                        {phone ? (
                                            <a
                                                href={`tel:${phone}`}
                                                className="text-primary-600"
                                            >
                                                <Typography level="body2">
                                                    {phone}
                                                </Typography>
                                            </a>
                                        ) : (
                                            <Typography
                                                level="body2"
                                                className="text-muted-foreground"
                                            >
                                                Nije naveden broj telefona
                                            </Typography>
                                        )}
                                        {address && (
                                            <Typography
                                                level="body2"
                                                className="text-muted-foreground"
                                            >
                                                {address}
                                            </Typography>
                                        )}
                                    </>
                                ) : (
                                    <Typography level="body2">
                                        {request.location?.name ||
                                            'Nepoznata lokacija'}
                                    </Typography>
                                )}
                                {request.requestNotes && (
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        Napomena: {request.requestNotes}
                                    </Typography>
                                )}
                            </Stack>
                            <Typography level="body3">
                                <a
                                    href={KnownPages.DeliveryRequests}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:underline"
                                >
                                    Pregledaj u administraciji
                                </a>
                            </Typography>
                        </Stack>
                    );
                })}
            </Stack>
        </Stack>
    );
}
