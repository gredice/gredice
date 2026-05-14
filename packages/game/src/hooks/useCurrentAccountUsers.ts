import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const currentAccountUsersKeys = ['accounts', 'current', 'users'];

export function useCurrentAccountUsers() {
    return useQuery({
        queryKey: currentAccountUsersKeys,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.accounts.current.users.$get();
            if (response.status === 401) {
                return null;
            }
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch current account users: ${response.status} ${response.statusText}`,
                );
            }
            return response.json();
        },
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
