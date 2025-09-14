import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const dailyRewardKeys = ['accounts', 'current', 'sunflowers', 'daily'];

export function useDailyReward() {
    return useQuery({
        queryKey: dailyRewardKeys,
        queryFn: async () => {
            const res =
                await client().api.accounts.current.sunflowers.daily.$get();
            return res.json();
        },
        staleTime: 1000 * 60 * 5,
    });
}
