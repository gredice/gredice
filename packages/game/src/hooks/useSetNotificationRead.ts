import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsQueryKey } from './useNotifications';

export function useSetNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, read, readWhere }: { id: string; read: boolean; readWhere: string | undefined }) => {
            const res = await client().api.notifications[':id'].$patch({
                param: { id: id.toString() },
                json: {
                    read: read.toString(),
                    readWhere,
                }
            });
            if (!res.ok)
                throw new Error('Failed to mark notification as read');
            return {
                id, read, readWhere
            }
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
            const previousNotifications = queryClient.getQueryData<any[]>(notificationsQueryKey);
            if (previousNotifications) {
                queryClient.setQueryData(notificationsQueryKey, previousNotifications.map(n =>
                    n.id === variables.id ? { ...n, read: variables.read } : n
                ));
            }
            return { previousNotifications };
        },
        onError: (err, variables, context) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(notificationsQueryKey, context.previousNotifications);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        },
    });
}
