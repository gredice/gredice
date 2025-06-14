import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKey, useCurrentUser } from "./useCurrentUser";
import { client } from "@gredice/client";

export function useUpdateUser() {
    const queryClient = useQueryClient();
    const currentUser = useCurrentUser();
    return useMutation({
        mutationFn: async ({ displayName, avatarUrl }: { displayName?: string, avatarUrl?: string | null }) => {
            if (!currentUser.data) {
                throw new Error('Current user data is not available');
            }

            const response = await client().api.users[":userId"].$patch({
                param: {
                    userId: currentUser.data.id
                },
                json: {
                    displayName,
                    avatarUrl
                }
            });

            if (response.status === 404) {
                throw new Error('User not found');
            }
        },
        onError: (error) => {
            console.error('Failed to update user:', error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKey.currentUser });
        }
    })
}