import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export const adventCalendarKeys = ['occasions', 'advent', 'calendar-2025'];

export function useAdventCalendar() {
    const { data: currentUser } = useCurrentUser();
    return useQuery({
        queryKey: adventCalendarKeys,
        queryFn: async () => {
            const res =
                await client().api.occasions.advent['calendar-2025'].$get();
            return res.json();
        },
        staleTime: 1000 * 60 * 5,
        enabled: Boolean(currentUser),
    });
}
