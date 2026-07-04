'use client';

import { clientAuthenticated } from '@gredice/client';
import { useCurrentUser } from '@gredice/ui/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    FarmNotification,
    FarmNotificationsFilter,
} from './notificationTypes';

export const farmNotificationsQueryKey = ['farm', 'notifications'];

async function fetchNotificationsResponse({
    filter,
    limit,
    userId,
}: {
    filter: FarmNotificationsFilter;
    limit: number;
    userId: string;
}) {
    const response = await clientAuthenticated().api.notifications.$get({
        query: {
            userId,
            read: filter === 'all' ? 'true' : undefined,
            page: '0',
            limit: limit.toString(),
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch farm notifications');
    }

    return response.json();
}

type ApiNotification = Awaited<
    ReturnType<typeof fetchNotificationsResponse>
>[number];

function parseFarmNotification(
    notification: ApiNotification,
): FarmNotification {
    return {
        ...notification,
        actionUrl: notification.actionUrl ?? null,
        createdAt: new Date(notification.createdAt),
        iconUrl: notification.iconUrl ?? null,
        imageUrl: notification.imageUrl ?? null,
        linkUrl: notification.linkUrl ?? null,
        raisedBedId: notification.raisedBedId ?? null,
        readAt: notification.readAt ? new Date(notification.readAt) : null,
        timestamp: new Date(notification.timestamp),
    };
}

export function useFarmNotifications(
    filter: FarmNotificationsFilter,
    limit = 1000,
) {
    const { data: currentUser } = useCurrentUser();
    const userId = currentUser?.userId;

    return useQuery({
        enabled: Boolean(userId),
        queryFn: async () => {
            if (!userId) {
                return [];
            }

            const notifications = await fetchNotificationsResponse({
                filter,
                limit,
                userId,
            });

            return notifications.map(parseFarmNotification);
        },
        queryKey: [...farmNotificationsQueryKey, { filter, limit, userId }],
        staleTime: 1000 * 60,
    });
}

export function useSetFarmNotificationRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
            const response = await clientAuthenticated().api.notifications[
                ':id'
            ].$patch({
                json: {
                    read: read.toString(),
                    readWhere: 'farm',
                },
                param: { id },
            });

            if (!response.ok) {
                throw new Error(
                    'Failed to update farm notification read state',
                );
            }

            return { id, read };
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: farmNotificationsQueryKey,
            });
        },
    });
}

export function useMarkFarmNotificationsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationIds: string[]) => {
            if (notificationIds.length === 0) {
                return;
            }

            const response = await clientAuthenticated().api.notifications.$put(
                {
                    json: {
                        notificationIds,
                        read: 'true',
                        readWhere: 'farm',
                    },
                },
            );

            if (!response.ok) {
                throw new Error('Failed to mark farm notifications as read');
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: farmNotificationsQueryKey,
            });
        },
    });
}
