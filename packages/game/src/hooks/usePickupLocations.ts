import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const pickupLocationsQueryKey = ['delivery', 'pickupLocations'];

export function usePickupLocations() {
    return useQuery({
        queryKey: pickupLocationsQueryKey,
        queryFn: async () => {
            const response =
                await client().api.delivery['pickup-locations'].$get();
            if (response.status !== 200) {
                throw new Error('Failed to fetch pickup locations');
            }
            return await response.json();
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

export type PickupLocationData = NonNullable<
    Awaited<ReturnType<typeof usePickupLocations>['data']>
>[0];
