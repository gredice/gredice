import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const accountAchievementsKeys = ['accounts', 'current', 'achievements'];

export interface AccountAchievement {
    id: number;
    key: string;
    status: 'pending' | 'approved' | 'denied';
    rewardSunflowers: number;
    progressValue: number | null;
    threshold: number | null;
    metadata: Record<string, unknown> | null;
    earnedAt: string | null;
    approvedAt: string | null;
    approvedByUserId: string | null;
    rewardGrantedAt: string | null;
    deniedAt: string | null;
    deniedByUserId: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export function useAccountAchievements() {
    return useQuery({
        queryKey: accountAchievementsKeys,
        queryFn: async () => {
            const response =
                await client().api.accounts.current.achievements.$get();
            const data = await response.json();
            return (data.achievements ?? []) as AccountAchievement[];
        },
        staleTime: 1000 * 60 * 5,
    });
}
