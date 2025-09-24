import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const accountAchievementsKeys = ['accounts', 'current', 'achievements'];

export function useAccountAchievements() {
    return useQuery({
        queryKey: accountAchievementsKeys,
        queryFn: async () => {
            const response =
                await client().api.accounts.current.achievements.$get();
            const data = await response.json();
            return data.achievements ?? [];
        },
        staleTime: 1000 * 60 * 5,
    });
}
