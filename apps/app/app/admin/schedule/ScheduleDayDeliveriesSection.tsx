import { DeliveryRequestsSection } from './DeliveryRequestsSection';
import { getScheduleDayData } from './scheduleData';

interface ScheduleDayDeliveriesSectionProps {
    isToday: boolean;
    date: Date;
}

export async function ScheduleDayDeliveriesSection({
    isToday,
    date,
}: ScheduleDayDeliveriesSectionProps) {
    const { todaysDeliveryRequests } = await getScheduleDayData(date, isToday);

    return <DeliveryRequestsSection requests={todaysDeliveryRequests} />;
}
