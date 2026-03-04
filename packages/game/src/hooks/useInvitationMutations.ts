import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountInvitationsKeys } from './useAccountInvitations';
import { currentAccountUsersKeys } from './useCurrentAccountUsers';
import { pendingInvitationsKeys } from './usePendingInvitations';

export function useSendInvitation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (email: string) => {
            const response =
                await client().api.accounts.current.invitations.$post({
                    json: { email },
                });
            if (!response.ok) {
                const text = await response.text();
                let errorMessage = 'Failed to send invitation';
                try {
                    const data = JSON.parse(text);
                    if (
                        typeof data === 'object' &&
                        data !== null &&
                        typeof data.error === 'string'
                    ) {
                        errorMessage = data.error;
                    }
                } catch {
                    // ignore parse error
                }
                throw new Error(errorMessage);
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: accountInvitationsKeys,
            });
        },
    });
}

export function useCancelInvitation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (invitationId: number) => {
            const response = await client().api.accounts.current.invitations[
                ':invitationId'
            ].$delete({
                param: { invitationId: invitationId.toString() },
            });
            if (!response.ok) {
                throw new Error('Failed to cancel invitation');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: accountInvitationsKeys,
            });
        },
    });
}

export function useAcceptInvitation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (token: string) => {
            const response =
                await client().api.accounts.invitations.accept.$post({
                    json: { token },
                });
            if (!response.ok) {
                throw new Error('Failed to accept invitation');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: pendingInvitationsKeys,
            });
            queryClient.invalidateQueries({
                queryKey: currentAccountUsersKeys,
            });
        },
    });
}
