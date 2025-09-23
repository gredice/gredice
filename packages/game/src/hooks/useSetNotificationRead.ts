import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsQueryKey } from './useNotifications';

export function useSetNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            id,
            read,
            readWhere,
        }: {
            id: string;
            read: boolean;
            readWhere: string | undefined;
        }) => {
            const res = await client().api.notifications[':id'].$patch({
                param: { id: id.toString() },
                json: {
                    read: read.toString(),
                    readWhere,
                },
            });
            if (!res.ok) throw new Error('Failed to mark notification as read');
            return {
                id,
                read,
                readWhere,
            };
        },
        onMutate: async (variables) => {
            const previousQueries = new Map<readonly unknown[], unknown>();
            const queries = queryClient.getQueriesData({});
            queries.forEach(([queryKey, data]) => {
                if (
                    Array.isArray(queryKey) &&
                    queryKey[0] === notificationsQueryKey[0]
                ) {
                    queryClient.cancelQueries({ queryKey });
                    if (Array.isArray(data)) {
                        const updated = data.map((notification) => {
                            if (
                                notification &&
                                typeof notification === 'object' &&
                                'id' in notification &&
                                typeof notification.id === 'string' &&
                                notification.id === variables.id
                            ) {
                                return {
                                    ...(notification as Record<
                                        string,
                                        unknown
                                    >),
                                    readAt: variables.read ? new Date() : null,
                                };
                            }
                            return notification;
                        });
                        queryClient.setQueryData(queryKey, updated);
                    }
                    previousQueries.set(queryKey, data);
                }
            });

            return { previousQueries };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach((notifications, queryKey) => {
                    queryClient.setQueryData(queryKey, notifications);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        },
    });
}
