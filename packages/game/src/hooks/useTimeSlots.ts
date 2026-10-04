import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import {
    serializeTimeSlotsQueryParams,
    type TimeSlotsQueryParams,
} from './timeSlotsQueryParams';

export const timeSlotsQueryKey = ['delivery', 'timeSlots'];

export function useTimeSlots(params?: TimeSlotsQueryParams) {
    return useQuery({
        queryKey: [...timeSlotsQueryKey, params],
        queryFn: async () => {
            const response = await clientPublic().api.delivery.slots.$get({
                query: serializeTimeSlotsQueryParams(params),
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
