import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { KnownPages } from '../../../src/KnownPages';
import {
    DeliveryContactInfo,
    DeliveryRequestModeChip,
    DeliveryRequestStatusChip,
    TimeSlotDisplay,
} from '../delivery/components';
import type { DeliveryRequest } from './types';

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
            <Stack spacing={1}>
                {requests.map((request) => {
                    const slot = request.slot;
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
                            spacing={1}
                            className="bg-muted/40 rounded-lg p-3"
                        >
                            <Row
                                spacing={1}
                                className="items-center flex-wrap gap-y-1"
                            >
                                <DeliveryRequestStatusChip
                                    status={request.state}
                                />
                                <DeliveryRequestModeChip mode={request.mode} />
                                <TimeSlotDisplay
                                    slot={slot}
                                    isOverdue={isOverdue}
                                />
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
                            <DeliveryContactInfo
                                mode={request.mode}
                                address={request.address}
                                location={request.location}
                                showNotes
                                requestNotes={request.requestNotes}
                            />
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
