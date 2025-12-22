import { ScheduleClient, type ScheduleClientProps } from './ScheduleClient';
import type { DeliveryRequest } from './types';

interface ScheduleWithDeliveryRequestsProps
    extends Omit<ScheduleClientProps, 'deliveryRequests'> {
    deliveryRequestsPromise: Promise<DeliveryRequest[]>;
}

export async function ScheduleWithDeliveryRequests({
    deliveryRequestsPromise,
    ...props
}: ScheduleWithDeliveryRequestsProps) {
    const deliveryRequests = await deliveryRequestsPromise;

    return <ScheduleClient {...props} deliveryRequests={deliveryRequests} />;
}
