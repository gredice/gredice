'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FarmNotificationList } from './FarmNotificationList';
import type { FarmNotificationNavigationTarget } from './notificationLinks';
import {
    useFarmNotifications,
    useMarkFarmNotificationsRead,
    useSetFarmNotificationRead,
} from './notificationsClient';
import type {
    FarmNotification,
    FarmNotificationsFilter,
} from './notificationTypes';

function navigateToNotificationTarget(
    router: ReturnType<typeof useRouter>,
    target: FarmNotificationNavigationTarget,
) {
    if (target.kind === 'internal') {
        router.push(target.href);
        return;
    }

    window.location.assign(target.href);
}

export function FarmNotificationsPanel() {
    const router = useRouter();
    const [filter, setFilter] = useState<FarmNotificationsFilter>('unread');
    const notificationsQuery = useFarmNotifications(filter);
    const setNotificationRead = useSetFarmNotificationRead();
    const markNotificationsRead = useMarkFarmNotificationsRead();
    const pendingReadId = setNotificationRead.variables?.id;
    const readPendingIds = pendingReadId ? new Set([pendingReadId]) : undefined;

    function handleNotificationOpen(
        notification: FarmNotification,
        target: FarmNotificationNavigationTarget | null,
    ) {
        if (!notification.readAt) {
            setNotificationRead.mutate({
                id: notification.id,
                read: true,
            });
        }

        if (target) {
            navigateToNotificationTarget(router, target);
        }
    }

    function handleNotificationReadChange(
        notification: FarmNotification,
        read: boolean,
    ) {
        setNotificationRead.mutate({
            id: notification.id,
            read,
        });
    }

    return (
        <FarmNotificationList
            filter={filter}
            isError={notificationsQuery.isError}
            isLoading={notificationsQuery.isPending}
            markAllPending={markNotificationsRead.isPending}
            notifications={notificationsQuery.data ?? []}
            onFilterChange={setFilter}
            onMarkAllRead={(notificationIds) =>
                markNotificationsRead.mutate(notificationIds)
            }
            onNotificationOpen={handleNotificationOpen}
            onNotificationReadChange={handleNotificationReadChange}
            onRetry={() => notificationsQuery.refetch()}
            readPendingIds={readPendingIds}
        />
    );
}
