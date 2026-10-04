import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
        <Stack spacing={2}>
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
                                <Row spacing={2}>
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
