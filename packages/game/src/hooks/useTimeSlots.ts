import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const timeSlotsQueryKey = ['delivery', 'timeSlots'];

export function useTimeSlots(params?: {
    type?: 'delivery' | 'pickup';
    from?: string;
    to?: string;
    locationId?: number;
}) {
    return useQuery({
        queryKey: [...timeSlotsQueryKey, params],
        queryFn: async () => {
            const queryParams = params
                ? {
                      type: params.type,
                      from: params.from,
                      to: params.to,
                      locationId: params.locationId?.toString(),
                  }
                : {};

            const response = await client().api.delivery.slots.$get({
                query: queryParams,
            });
            if (response.status !== 200) {
                throw new Error('Failed to fetch time slots');
            }
            return await response.json();
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

export type TimeSlotData = NonNullable<
    Awaited<ReturnType<typeof useTimeSlots>['data']>
>[0];
