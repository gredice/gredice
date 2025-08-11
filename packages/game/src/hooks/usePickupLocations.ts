import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export const pickupLocationsQueryKey = ['delivery', 'pickupLocations'];

export function usePickupLocations() {
    return useQuery({
        queryKey: pickupLocationsQueryKey,
        queryFn: async () => {
            const response = await client().api.delivery['pickup-locations'].$get();
            if (response.status !== 200) {
                throw new Error('Failed to fetch pickup locations');
            }
            return await response.json();
        }
    });
}

export type PickupLocationData = NonNullable<Awaited<ReturnType<typeof usePickupLocations>['data']>>[0];
