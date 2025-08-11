import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export const deliveryRequestsQueryKey = ['delivery', 'requests'];

export function useDeliveryRequests() {
    return useQuery({
        queryKey: deliveryRequestsQueryKey,
        queryFn: async () => {
            const response = await client().api.delivery.requests.$get();
            if (response.status !== 200) {
                throw new Error('Failed to fetch delivery requests');
            }
            return await response.json();
        }
    });
}

export type DeliveryRequestData = NonNullable<Awaited<ReturnType<typeof useDeliveryRequests>['data']>>[0];
