import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { adventCalendarKeys } from './useAdventCalendar';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys } from './useCurrentGarden';

export function useOpenAdventDay() {
    const queryClient = useQueryClient();
    const isWinterMode = useGameState((state) => state.isWinterMode);
    const gardenQueryKey = currentGardenKeys(isWinterMode);

    return useMutation({
        mutationFn: async (day: number) => {
            const res = await client().api.occasions.advent[
                'calendar-2025'
            ].open.$post({
                json: { day },
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adventCalendarKeys });
            queryClient.invalidateQueries({ queryKey: currentAccountKeys });
            queryClient.invalidateQueries({ queryKey: gardenQueryKey });
        },
    });
}
