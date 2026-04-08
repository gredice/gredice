import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const accountInvitationsKeys = ['accounts', 'current', 'invitations'];

export function useAccountInvitations() {
    return useQuery({
        queryKey: accountInvitationsKeys,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.accounts.current.invitations.$get();
            if (response.status === 401) {
                return [];
            }
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch account invitations: ${response.status} ${response.statusText}`,
                );
            }
            return response.json();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
