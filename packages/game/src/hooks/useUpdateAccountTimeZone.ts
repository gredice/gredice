import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currentAccountKeys } from './useCurrentAccount';

export function useUpdateAccountTimeZone() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (timeZone: string) => {
            const response = await clientAuthenticated().api.accounts.current.$patch({
                json: { timeZone },
            });
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currentAccountKeys });
        },
    });
}
