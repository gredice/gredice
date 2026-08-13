import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsQueryKey } from './useNotifications';

export type RaisedBedNotificationDismissScope =
    | 'selected'
    | 'raised_bed_images';

export function useDismissRaisedBedNotification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            gardenId,
            notificationId,
            scope,
        }: {
            gardenId: number;
            notificationId: string;
            scope: RaisedBedNotificationDismissScope;
        }) => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-bed-notifications'][':notificationId'].dismiss.$put({
                param: {
                    gardenId: gardenId.toString(),
                    notificationId,
                },
                json: { scope },
            });
            if (!response.ok) {
                throw new Error('Failed to dismiss raised-bed notification');
            }
            return await response.json();
        },
        onMutate: async ({ notificationId }) => {
            await queryClient.cancelQueries({
                queryKey: notificationsQueryKey,
            });
            const previousQueries = new Map<readonly unknown[], unknown>();
            const queries = queryClient.getQueriesData({
                queryKey: notificationsQueryKey,
            });
            for (const [queryKey, data] of queries) {
                previousQueries.set(queryKey, data);
                if (!Array.isArray(data)) continue;

                queryClient.setQueryData(
                    queryKey,
                    data.map((notification) => {
                        if (
                            notification &&
                            typeof notification === 'object' &&
                            'id' in notification &&
                            notification.id === notificationId
                        ) {
                            return {
                                ...notification,
                                readAt: new Date(),
                            };
                        }
                        return notification;
                    }),
                );
            }
            return { previousQueries };
        },
        onError: (_error, _variables, context) => {
            context?.previousQueries.forEach((data, queryKey) => {
                queryClient.setQueryData(queryKey, data);
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        },
    });
}
