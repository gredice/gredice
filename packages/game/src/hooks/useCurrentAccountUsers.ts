import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const currentAccountUsersKeys = ['accounts', 'current', 'users'];

export function useCurrentAccountUsers() {
    return useQuery({
        queryKey: currentAccountUsersKeys,
        queryFn: async () => {
            const response = await client().api.accounts.current.users.$get();
            return response.json();
        },
        staleTime: 1000 * 60 * 5, // 5 min
    });
}
