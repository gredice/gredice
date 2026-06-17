import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currentAccountKeys } from './useCurrentAccount';
import { dailyRewardKeys } from './useDailyReward';
import { tutorialChecklistKeys } from './useTutorialChecklist';

export function useClaimDailyReward() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await clientAuthenticated().api.accounts.current.sunflowers.daily.$post();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currentAccountKeys });
            queryClient.invalidateQueries({ queryKey: dailyRewardKeys });
            queryClient.invalidateQueries({ queryKey: tutorialChecklistKeys });
        },
    });
}
