import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const pendingInvitationsKeys = ['accounts', 'invitations', 'pending'];

export function usePendingInvitations() {
    return useQuery({
        queryKey: pendingInvitationsKeys,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.accounts.invitations.pending.$get();
            if (response.status === 401) {
                return [];
            }
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch pending invitations: ${response.status} ${response.statusText}`,
                );
            }
            return response.json();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
