import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKey, useCurrentUser } from './useCurrentUser';

export type UpdateUserVariables = {
    displayName?: string;
    avatarUrl?: string | null;
    birthday?: {
        day: number;
        month: number;
        year?: number | null;
    } | null;
    userName?: string;
};

export function useUpdateUser() {
    const queryClient = useQueryClient();
    const currentUser = useCurrentUser();
    return useMutation({
        mutationFn: async ({
            displayName,
            avatarUrl,
            birthday,
            userName,
        }: UpdateUserVariables) => {
            if (!currentUser.data) {
                throw new Error('Current user data is not available');
            }

            const response = await client().api.users[':userId'].$patch({
                param: {
                    userId: currentUser.data.id,
                },
                json: {
                    displayName,
                    avatarUrl,
                    birthday,
                    userName,
                },
            });

            if (!response.ok) {
                let message = 'Failed to update user';
                try {
                    const body = await response.json();
                    message =
                        (body as { error?: string; message?: string }).error ??
                        (body as { message?: string }).message ??
                        message;
                } catch (error) {
                    console.error(
                        'Failed to parse updateUser error response',
                        error,
                    );
                }
                throw new Error(message);
            }

            return await response.json();
        },
        onError: (error) => {
            console.error('Failed to update user:', error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKey.currentUser });
        },
    });
}
