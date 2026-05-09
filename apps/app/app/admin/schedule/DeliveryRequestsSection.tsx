import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { KnownPages } from '../../../src/KnownPages';
import {
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
            <Typography level="h6">Dostava</Typography>
            <List>
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
                        <ListItem
                            key={request.id}
                            href={KnownPages.DeliveryRequests}
                            label={
                                <Row spacing={1}>
                                    <DeliveryRequestStatusChip
                                        status={request.state}
                                    />
                                    <DeliveryRequestModeChip
                                        mode={request.mode}
                                    />
                                    <TimeSlotDisplay
                                        slot={slot}
                                        isOverdue={isOverdue}
                                        hideDate
                                    />
                                </Row>
                            }
                        />
                    );
                })}
            </List>
        </Stack>
    );
}
