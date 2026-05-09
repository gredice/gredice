import { TimeRange } from '@gredice/ui/LocalDateTime';
import { MapPin, ShoppingCart, Timer, Truck } from '@signalco/ui-icons';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { cx } from '@signalco/ui-primitives/cx';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { DeliveryRequestData } from '../../hooks/useDeliveryRequests';
import { DeliveryRequestRow } from './DeliveryRequestRow';

function formatDeliveryCount(count: number) {
    if (count === 1) return '1 dostava';
    if (count >= 2 && count <= 4) return `${count} dostave`;
    return `${count} dostava`;
}

export function DeliveryRequestGroupCard({
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
        <ShoppingCart className="size-4 shrink-0" />
    ) : (
        <Truck className="size-4 shrink-0" />
    );
    const groupLabel = isPickupOnly
        ? 'Preuzimanja'
        : uniqueModes.size > 1
          ? 'Dostave i preuzimanja'
          : 'Dostave';

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={2}>
                    <Stack spacing={1}>
                        <Row spacing={1} justifyContent="space-between">
                            <Row spacing={1}>
                                {groupIcon}
                                <Typography>{groupLabel}</Typography>
                            </Row>
                            <Chip color="neutral">
                                {formatDeliveryCount(requests.length)}
                            </Chip>
                        </Row>

                        {firstRequest.slot && (
                            <Row spacing={1}>
                                <Timer className="size-4 shrink-0" />
                                <Typography level="body2">
                                    <TimeRange
                                        startAt={firstRequest.slot.startAt}
                                        endAt={firstRequest.slot.endAt}
                                    />
                                </Typography>
                            </Row>
                        )}

                        {/* Show shared address for delivery mode */}
                        {firstRequest.mode === 'delivery' &&
                            firstRequest.address && (
                                <Row spacing={1}>
                                    <MapPin className="size-4" />
                                    <Stack spacing={0.5}>
                                        <Typography level="body2">
                                            {firstRequest.address.label}
                                        </Typography>
                                        <Typography level="body3" secondary>
                                            {firstRequest.address.street1}
                                            {firstRequest.address.street2 &&
                                                `, ${firstRequest.address.street2}`}
                                            <br />
                                            {firstRequest.address.postalCode}{' '}
                                            {firstRequest.address.city}
                                        </Typography>
                                    </Stack>
                                </Row>
                            )}

                        {/* Show shared location for pickup mode */}
                        {firstRequest.mode === 'pickup' &&
                            firstRequest.location && (
                                <Row spacing={1}>
                                    <MapPin className="size-4 shrink-0" />
                                    <Typography level="body2">
                                        {firstRequest.location.name}
                                    </Typography>
                                </Row>
                            )}
                    </Stack>

                    <Stack className="border rounded">
                        {requests.map((request, index) => (
                            <div
                                key={request.id}
                                className={cx(
                                    'p-2',
                                    index === 0 ? undefined : 'border-t',
                                )}
                            >
                                <DeliveryRequestRow
                                    request={request}
                                    showSlot={false}
                                    showDestination={false}
                                />
                            </div>
                        ))}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
