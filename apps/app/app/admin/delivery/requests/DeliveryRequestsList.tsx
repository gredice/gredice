import {
    getAllTimeSlots,
    getDeliveryRequestsWithEvents,
    TimeSlotStatuses,
} from '@gredice/storage';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { getDateFromTimeFilter } from '../../../../lib/utils/timeFilters';
import { groupDeliveryRequests } from './DeliveryRequestGroups';
import { DeliveryRequestListItem } from './DeliveryRequestListItem';
import { DeliveryRequestSlotsProvider } from './DeliveryRequestSlotsProvider';
import {
    type DeliveryRequestSlotOption,
    toDeliveryRequestMode,
} from './DeliveryRequestTypes';

export async function DeliveryRequestsList({
    searchParams,
}: {
    searchParams?: { [key: string]: string | string[] | undefined };
}) {
    const [deliveryRequests, timeSlots] = await Promise.all([
        getDeliveryRequestsWithEvents(),
        getAllTimeSlots(),
    ]);

    const statusParam =
        typeof searchParams?.status === 'string' ? searchParams.status : '';
    const statusFilter = statusParam || 'active';
    const modeFilter =
        typeof searchParams?.mode === 'string' ? searchParams.mode : '';
    const fromFilter =
        typeof searchParams?.from === 'string' ? searchParams.from : '';
    const fromDate = getDateFromTimeFilter(fromFilter);

    let filteredRequests = deliveryRequests;

    if (statusFilter === 'active') {
        filteredRequests = filteredRequests.filter(
            (request) => request.state !== 'fulfilled',
        );
    } else if (statusFilter && statusFilter !== 'all') {
        filteredRequests = filteredRequests.filter(
            (request) => request.state === statusFilter,
        );
    }

    if (modeFilter) {
        filteredRequests = filteredRequests.filter(
            (request) => request.mode === modeFilter,
        );
    }

    if (fromDate) {
        filteredRequests = filteredRequests.filter((request) => {
            const requestDate = request.slot?.startAt || request.createdAt;
            return requestDate && requestDate >= fromDate;
        });
    }

    const now = new Date();
    const sortedDeliveryRequests = filteredRequests.toSorted((a, b) => {
        const aSlot = a.slot?.startAt;
        const bSlot = b.slot?.startAt;

        if (!aSlot && !bSlot) return 0;
        if (!aSlot) return 1;
        if (!bSlot) return -1;

        const aFuture = aSlot >= now;
        const bFuture = bSlot >= now;

        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;

        if (aFuture && bFuture) {
            return aSlot.getTime() - bSlot.getTime();
        }

        return bSlot.getTime() - aSlot.getTime();
    });
    const deliveryRequestGroups = groupDeliveryRequests(sortedDeliveryRequests);
    const slotOptions: DeliveryRequestSlotOption[] = timeSlots
        .filter(
            (slot) =>
                slot.status === TimeSlotStatuses.SCHEDULED &&
                slot.startAt >= now,
        )
        .toSorted((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((slot) => ({
            id: slot.id,
            startAt: slot.startAt,
            endAt: slot.endAt,
            type: toDeliveryRequestMode(slot.type),
        }));

    return (
        <DeliveryRequestSlotsProvider slots={slotOptions}>
            <div className="min-w-0">
                {deliveryRequestGroups.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Nema zahtjeva za dostavu
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {deliveryRequestGroups.map((group) => (
                            <DeliveryRequestListItem
                                key={group.key}
                                group={group}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </DeliveryRequestSlotsProvider>
    );
}
