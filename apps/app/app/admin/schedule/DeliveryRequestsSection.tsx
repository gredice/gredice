import { List } from '@gredice/ui/List';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { groupDeliveryRequests } from '../delivery/requests/DeliveryRequestGroups';
import { ScheduleDeliveryRequestGroupItem } from './ScheduleDeliveryRequestGroupItem';
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
    const groups = groupDeliveryRequests(requests);

    return (
        <Stack spacing={2}>
            <Typography level="h6">Dostava</Typography>
            <List>
                {groups.map((group) => (
                    <ScheduleDeliveryRequestGroupItem
                        key={group.key}
                        group={group}
                        now={now}
                    />
                ))}
            </List>
        </Stack>
    );
}
