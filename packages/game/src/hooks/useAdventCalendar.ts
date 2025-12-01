import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const adventCalendarKeys = ['occasions', 'advent', 'calendar-2025'];

export function useAdventCalendar() {
    return useQuery({
        queryKey: adventCalendarKeys,
        queryFn: async () => {
            const res =
                await client().api.occasions.advent['calendar-2025'].$get();
            return res.json();
        },
        staleTime: 1000 * 60 * 5,
    });
}
