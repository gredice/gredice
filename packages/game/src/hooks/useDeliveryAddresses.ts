import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export const deliveryAddressesQueryKey = ['delivery', 'addresses'];

export function useDeliveryAddresses() {
    return useQuery({
        queryKey: deliveryAddressesQueryKey,
        queryFn: async () => {
            const response = await client().api.delivery.addresses.$get();
            if (response.status !== 200) {
                throw new Error('Failed to fetch delivery addresses');
            }
            return await response.json();
        }
    });
}

export type DeliveryAddressData = NonNullable<Awaited<ReturnType<typeof useDeliveryAddresses>['data']>>[0];
