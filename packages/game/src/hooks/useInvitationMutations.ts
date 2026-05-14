import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountInvitationsKeys } from './useAccountInvitations';
import { currentAccountUsersKeys } from './useCurrentAccountUsers';
import { pendingInvitationsKeys } from './usePendingInvitations';

export class InvitationError extends Error {
    code: string;
    status: number;

    constructor(message: string, code: string, status: number) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export function useSendInvitation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (email: string) => {
            const response =
                await clientAuthenticated().api.accounts.current.invitations.$post(
                    {
                        json: { email },
                    },
                );
            if (!response.ok) {
                const text = await response.text();
                let errorCode = 'unknown';
                try {
                    const data = JSON.parse(text);
                    if (
                        typeof data === 'object' &&
                        data !== null &&
                        typeof data.code === 'string'
                    ) {
                        errorCode = data.code;
                    }
                } catch {
                    // ignore parse error
                }
                throw new InvitationError(
                    errorCode,
                    errorCode,
                    response.status,
                );
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
            const response =
                await clientAuthenticated().api.accounts.current.invitations[
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
                await clientAuthenticated().api.accounts.invitations.accept.$post(
                    {
                        json: { token },
                    },
                );
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
