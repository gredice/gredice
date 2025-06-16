import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotifications } from './useNotifications';
import { useCurrentUser } from './useCurrentUser';

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    const { data: currentUser } = useCurrentUser();
    const { data: notifications } = useNotifications(currentUser?.id);
    return useMutation({
        mutationFn: async (options: { readWhere?: string }) => {
            if (!notifications || notifications.length === 0) return;

            const ids = notifications.map(n => n.id);
            const res = await client().api.notifications.$put({
                json: {
                    read: 'true',
                    readWhere: options.readWhere,
                    notificationIds: ids
                }
            });

            if (!res.ok) {
                throw new Error('Failed to mark all notifications as read');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });
}
