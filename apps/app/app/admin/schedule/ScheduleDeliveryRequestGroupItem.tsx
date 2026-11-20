import { Chip } from '@gredice/ui/Chip';
import { ListItem } from '@gredice/ui/ListItem';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../../src/KnownPages';
import {
    DeliveryRequestModeChip,
    DeliveryRequestStatusChip,
    TimeSlotDisplay,
} from '../delivery/components';
import { getDeliveryRequestDestinationTitle } from '../delivery/requests/DeliveryDestinationDetails';
import type { DeliveryRequestGroup } from '../delivery/requests/DeliveryRequestGroups';
import type { DeliveryRequest } from './types';

function isOpenDeliveryRequest(request: DeliveryRequest) {
    return request.state !== 'fulfilled' && request.state !== 'cancelled';
}

export function ScheduleDeliveryRequestGroupItem({
    group,
    now,
}: {
    group: DeliveryRequestGroup<DeliveryRequest>;
    now: Date;
}) {
    const primaryRequest = group.requests[0];
    if (!primaryRequest) {
        return null;
    }

    const slot = primaryRequest.slot;
    const slotStart = slot?.startAt ? new Date(slot.startAt) : undefined;
    const isOverdue =
        slotStart !== undefined &&
        slotStart.getTime() < now.getTime() &&
        group.requests.some(isOpenDeliveryRequest);

    const stateCounts = new Map<string, number>();
    for (const request of group.requests) {
        stateCounts.set(
            request.state,
            (stateCounts.get(request.state) ?? 0) + 1,
        );
    }
    const hasMixedStates = stateCounts.size > 1;

    return (
        <ListItem
            href={KnownPages.DeliveryRequests}
            label={
                <Row spacing={2} className="min-w-0 flex-wrap gap-y-1">
                    <Typography semiBold className="min-w-0 truncate">
                        {getDeliveryRequestDestinationTitle(primaryRequest)}
                    </Typography>
                    <DeliveryRequestModeChip mode={primaryRequest.mode} />
                    <TimeSlotDisplay
                        slot={slot}
                        isOverdue={isOverdue}
                        hideDate
                    />
                    {group.requests.length > 1 && (
                        <Chip color="neutral" variant="soft">
                            {group.requests.length} zahtjeva
                        </Chip>
                    )}
                    {[...stateCounts].map(([state, count]) => (
                        <Row key={state} spacing={1}>
                            <DeliveryRequestStatusChip status={state} />
                            {hasMixedStates && (
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    ×{count}
                                </Typography>
                            )}
                        </Row>
                    ))}
                </Row>
            }
        />
    );
}
