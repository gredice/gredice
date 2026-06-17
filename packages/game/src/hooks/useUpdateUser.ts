import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKey, useCurrentUser } from './useCurrentUser';
import { tutorialChecklistKeys } from './useTutorialChecklist';

export type UpdateUserVariables = {
    displayName?: string;
    avatarUrl?: string | null;
    birthday?: {
        day: number;
        month: number;
        year?: number | null;
    } | null;
    userName?: string;
    whatsNewLastSeenAt?: Date | string | null;
    whatsNewPopupDisabled?: boolean;
};

export function useUpdateUser({ enabled = true }: { enabled?: boolean } = {}) {
    const queryClient = useQueryClient();
    const currentUser = useCurrentUser(enabled);
    return useMutation({
        mutationFn: async ({
            displayName,
            avatarUrl,
            birthday,
            userName,
            whatsNewLastSeenAt,
            whatsNewPopupDisabled,
        }: UpdateUserVariables) => {
            if (!currentUser.data) {
                throw new Error('Current user data is not available');
            }

            const response = await clientAuthenticated().api.users[
                ':userId'
            ].$patch({
                param: {
                    userId: currentUser.data.id,
                },
                json: {
                    displayName,
                    avatarUrl,
                    birthday,
                    userName,
                    whatsNewLastSeenAt:
                        whatsNewLastSeenAt instanceof Date
                            ? whatsNewLastSeenAt.toISOString()
                            : whatsNewLastSeenAt,
                    whatsNewPopupDisabled,
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
            queryClient.invalidateQueries({ queryKey: tutorialChecklistKeys });
        },
    });
}
