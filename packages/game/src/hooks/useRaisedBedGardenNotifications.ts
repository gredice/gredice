import { clientAuthenticated } from '@gredice/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useGameSceneRuntimeActive } from '../scene/sceneRuntimeActivity';
import { useGameState } from '../useGameState';

export function raisedBedGardenNotificationsQueryKey(
    gardenId: number | null | undefined,
) {
    return ['notifications', 'raised-bed-garden', gardenId ?? null] as const;
}

async function getRaisedBedGardenNotifications(
    gardenId: number,
    signal: AbortSignal,
) {
    const response = await clientAuthenticated().api.gardens[':gardenId'][
        'raised-bed-notifications'
    ].$get(
        {
            param: { gardenId: gardenId.toString() },
        },
        { init: { signal } },
    );

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
    const runtimeActive = useGameSceneRuntimeActive();
    const queryClient = useQueryClient();
    const isMock = useGameState((state) => state.isMock);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const enabled =
        runtimeActive &&
        gardenId != null &&
        !isMock &&
        localSandboxStorageKey === null;

    useEffect(() => {
        if (runtimeActive) {
            return;
        }
        void queryClient.cancelQueries({
            exact: true,
            queryKey: raisedBedGardenNotificationsQueryKey(gardenId),
        });
    }, [gardenId, queryClient, runtimeActive]);

    return useQuery({
        queryKey: raisedBedGardenNotificationsQueryKey(gardenId),
        queryFn: async ({ signal }) => {
            if (gardenId == null) {
                throw new Error(
                    'Garden ID is required to load raised bed notifications',
                );
            }
            return getRaisedBedGardenNotifications(gardenId, signal);
        },
        enabled,
        refetchInterval: enabled ? 60_000 : false,
        staleTime: 30_000,
    });
}
