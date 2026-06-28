import type { getDeliveryRequestsWithEvents } from '@gredice/storage';

export type DeliveryRequestDetails = Awaited<
    ReturnType<typeof getDeliveryRequestsWithEvents>
>[number];
