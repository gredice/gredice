import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { DeliveryRequestModeChip } from '../components';
import {
    DeliveryDestinationDetails,
    getDeliveryRequestDestinationTitle,
} from './DeliveryDestinationDetails';
import { DeliveryRequestActionButtons } from './DeliveryRequestActionButtons';
import { DeliveryRequestContents } from './DeliveryRequestContents';
import { DeliveryRequestGroupStatusAction } from './DeliveryRequestGroupStatusAction';
import type { DeliveryRequestGroup } from './DeliveryRequestGroups';
import type { DeliveryRequestDetails } from './DeliveryRequestListTypes';
import { DeliveryRequestSlotAction } from './DeliveryRequestSlotAction';
import { DeliveryRequestStatusAction } from './DeliveryRequestStatusAction';
import { toDeliveryRequestMode } from './DeliveryRequestTypes';

function getActionRequest(request: DeliveryRequestDetails) {
    return {
        id: request.id,
        state: request.state,
        mode: toDeliveryRequestMode(request.mode),
        operationId: request.operationId,
        slot: request.slot
            ? {
                  id: request.slot.id,
                  startAt: request.slot.startAt,
                  endAt: request.slot.endAt,
              }
            : undefined,
    };
}

export function DeliveryRequestListItem({
    group,
}: {
    group: DeliveryRequestGroup;
}) {
    const primaryRequest = group.requests[0];

    if (!primaryRequest) {
        return null;
    }

    const destinationTitle = getDeliveryRequestDestinationTitle(primaryRequest);
    const groupedRequestCount = group.requests.length;
    const groupActionRequests = group.requests.map(getActionRequest);

    return (
        <li className="group border-l-4 border-l-primary/60 transition-colors hover:bg-muted/30">
            <div className="bg-muted/35 px-3 py-3 sm:px-4">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <Stack spacing={1} className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Typography
                                level="body1"
                                component="h3"
                                semiBold
                                className="min-w-0 truncate"
                            >
                                {destinationTitle}
                            </Typography>
                            <DeliveryRequestModeChip
                                mode={primaryRequest.mode}
                                size="sm"
                            />
                            {groupedRequestCount > 1 ? (
                                <Chip color="neutral" size="sm" variant="soft">
                                    {groupedRequestCount} zahtjeva
                                </Chip>
                            ) : null}
                        </div>
                        <DeliveryDestinationDetails request={primaryRequest} />
                    </Stack>
                    <div className="flex shrink-0 justify-start lg:justify-end">
                        <DeliveryRequestGroupStatusAction
                            requests={groupActionRequests}
                        />
                    </div>
                </div>
            </div>
            <ul className="divide-y border-t bg-background/60">
                {group.requests.map((request) => {
                    const actionRequest = getActionRequest(request);

                    return (
                        <li key={request.id} className="px-3 py-2 sm:px-4">
                            <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                                <DeliveryRequestContents request={request} />
                                <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 xl:max-w-[40rem] xl:justify-end">
                                    <DeliveryRequestStatusAction
                                        request={actionRequest}
                                    />
                                    <DeliveryRequestSlotAction
                                        request={actionRequest}
                                    />
                                    <Chip
                                        color={
                                            request.surveySent
                                                ? 'success'
                                                : 'neutral'
                                        }
                                        size="sm"
                                        variant={
                                            request.surveySent
                                                ? 'solid'
                                                : 'outlined'
                                        }
                                    >
                                        {request.surveySent
                                            ? 'Anketa poslana'
                                            : 'Bez ankete'}
                                    </Chip>
                                    <Typography
                                        level="body3"
                                        className="whitespace-nowrap text-muted-foreground"
                                    >
                                        Kreiran:{' '}
                                        <LocalDateTime>
                                            {request.createdAt}
                                        </LocalDateTime>
                                    </Typography>
                                    <DeliveryRequestActionButtons
                                        label={destinationTitle}
                                        request={actionRequest}
                                    />
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </li>
    );
}
