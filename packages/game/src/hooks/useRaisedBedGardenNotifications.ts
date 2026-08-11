import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useGameState } from '../useGameState';

export function raisedBedGardenNotificationsQueryKey(
    gardenId: number | null | undefined,
) {
    return ['notifications', 'raised-bed-garden', gardenId ?? null] as const;
}

async function getRaisedBedGardenNotifications(gardenId: number) {
    const response = await clientAuthenticated().api.gardens[':gardenId'][
        'raised-bed-notifications'
    ].$get({
        param: { gardenId: gardenId.toString() },
    });

    if (!response.ok) {
        throw new Error('Failed to load raised bed garden notifications');
    }

    const { notifications } = await response.json();
    return notifications.map((notification) => ({
        ...notification,
        createdAt: new Date(notification.createdAt),
        readAt: notification.readAt ? new Date(notification.readAt) : null,
        timestamp: new Date(notification.timestamp),
    }));
}

export function useRaisedBedGardenNotifications(
    gardenId: number | null | undefined,
) {
    const isMock = useGameState((state) => state.isMock);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const enabled =
        gardenId != null && !isMock && localSandboxStorageKey === null;

    return useQuery({
        queryKey: raisedBedGardenNotificationsQueryKey(gardenId),
        queryFn: async () => {
            if (gardenId == null) {
                throw new Error(
                    'Garden ID is required to load raised bed notifications',
                );
            }
            return getRaisedBedGardenNotifications(gardenId);
        },
        enabled,
        refetchInterval: 60_000,
        staleTime: 30_000,
    });
}
