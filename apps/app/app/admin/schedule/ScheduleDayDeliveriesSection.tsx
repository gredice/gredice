import { DeliveryRequestsSection } from './DeliveryRequestsSection';
import { getScheduleDeliveryRequests } from './scheduleData';
import { getDayDeliveryRequests } from './scheduleDayFilters';

interface ScheduleDayDeliveriesSectionProps {
    isToday: boolean;
    date: Date;
}

export async function ScheduleDayDeliveriesSection({
    isToday,
    date,
}: ScheduleDayDeliveriesSectionProps) {
    const deliveryRequests = await getScheduleDeliveryRequests();
    const todaysDeliveryRequests = getDayDeliveryRequests(
        isToday,
        date,
        deliveryRequests,
    );

    return <DeliveryRequestsSection requests={todaysDeliveryRequests} />;
}
