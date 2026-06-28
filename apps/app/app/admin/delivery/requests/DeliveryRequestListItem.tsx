import type { getDeliveryRequestsSummary } from '@gredice/storage';
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
import { DeliveryRequestSlotAction } from './DeliveryRequestSlotAction';
import { DeliveryRequestStatusAction } from './DeliveryRequestStatusAction';
import { toDeliveryRequestMode } from './DeliveryRequestTypes';

type DeliveryRequestSummary = Awaited<
    ReturnType<typeof getDeliveryRequestsSummary>
>[number];

export function DeliveryRequestListItem({
    request,
}: {
    request: DeliveryRequestSummary;
}) {
    const destinationTitle = getDeliveryRequestDestinationTitle(request);
    const actionRequest = {
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

    return (
        <li className="group px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4">
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
                            mode={request.mode}
                            size="sm"
                        />
                    </div>
                    <DeliveryDestinationDetails request={request} />
                </Stack>

                <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 lg:max-w-[40rem] lg:justify-end">
                    <DeliveryRequestStatusAction request={actionRequest} />
                    <DeliveryRequestSlotAction request={actionRequest} />
                    <Chip
                        color={request.surveySent ? 'success' : 'neutral'}
                        size="sm"
                        variant={request.surveySent ? 'solid' : 'outlined'}
                    >
                        {request.surveySent ? 'Anketa poslana' : 'Bez ankete'}
                    </Chip>
                    <Typography
                        level="body3"
                        className="whitespace-nowrap text-muted-foreground"
                    >
                        Kreiran:{' '}
                        <LocalDateTime>{request.createdAt}</LocalDateTime>
                    </Typography>
                    <DeliveryRequestActionButtons
                        label={destinationTitle}
                        request={actionRequest}
                    />
                </div>
            </div>
        </li>
    );
}
