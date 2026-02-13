import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const notificationsQueryKey = ['notifications'];

export function useNotifications(
    userId: string | undefined,
    read?: boolean,
    page?: number,
    limit?: number,
) {
    return useQuery({
        queryKey:
            read || page || limit
                ? [...notificationsQueryKey, { read, page, limit, userId }]
                : notificationsQueryKey,
        queryFn: async () => {
            if (!userId) return [];
            const response = await client().api.notifications.$get({
                query: {
                    userId,
                    read: read ? 'true' : undefined,
                    page: page?.toString(),
                    limit: limit?.toString(),
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }
            return (await response.json()).map((notification) => ({
                ...notification,
                timestamp: new Date(notification.timestamp),
                createdAt: new Date(notification.createdAt),
                readAt: notification.readAt
                    ? new Date(notification.readAt)
                    : null,
            }));
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: Boolean(userId),
    });
}
