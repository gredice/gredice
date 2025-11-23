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
                    queryClient.setQueryData(
                        queryKey,
                        (data as Array<Record<string, unknown>>).map((n) => {
                            const entry = n as Record<string, unknown>;
                            if (String(entry.id) === variables.id) {
                                return {
                                    ...entry,
                                    readAt: variables.read ? new Date() : null,
                                } as Record<string, unknown>;
                            }
                            return entry;
                        }),
                    );
                    previousQueries.set(queryKey, data as unknown);
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
