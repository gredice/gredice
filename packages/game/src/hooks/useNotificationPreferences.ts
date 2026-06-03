import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type ApiClient = ReturnType<typeof clientAuthenticated>;

export type NotificationPreferenceUpdate = NonNullable<
    Parameters<ApiClient['api']['notifications']['preferences']['$put']>[0]
>['json']['preferences'][number];

export const notificationPreferencesKey = ['notifications', 'preferences'];

export function useNotificationPreferences() {
    return useQuery({
        queryKey: notificationPreferencesKey,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.notifications.preferences.$get();
            if (!response.ok)
                throw new Error('Postavke obavijesti nisu učitane');
            return (await response.json()).preferences;
        },
    });
}

export function useSaveNotificationPreferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (preferences: NotificationPreferenceUpdate[]) => {
            const response =
                await clientAuthenticated().api.notifications.preferences.$put({
                    json: { preferences },
                });
            if (!response.ok)
                throw new Error('Postavke obavijesti nisu spremljene');
        },
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: notificationPreferencesKey,
            }),
    });
}

export function pushNotificationPreferenceUpdate({
    category,
    enabled,
}: {
    category: string;
    enabled: boolean;
}): NotificationPreferenceUpdate {
    return {
        scope: 'global',
        category,
        channel: 'push',
        enabled,
        quietHoursStartMinute: null,
        quietHoursEndMinute: null,
        digestFrequency: 'off',
    };
}
