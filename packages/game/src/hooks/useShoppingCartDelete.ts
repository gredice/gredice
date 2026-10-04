import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useShoppingCartQueryKey } from './useShoppingCart';
import { tutorialChecklistKeys } from './useTutorialChecklist';

export function useShoppingCartDelete() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => clientAuthenticated().api['shopping-cart'].$delete(),
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: useShoppingCartQueryKey,
            });
            queryClient.invalidateQueries({ queryKey: tutorialChecklistKeys });
        },
        scope: {
            id: 'shoppingCartDelete',
        },
    });
}
