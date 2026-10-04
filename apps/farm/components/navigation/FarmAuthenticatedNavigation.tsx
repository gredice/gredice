'use client';

import { useFarmNotifications } from '../../app/notifications/notificationsClient';
import { FarmPrimaryNavigation } from './FarmPrimaryNavigation';

type FarmAuthenticatedNavigationProps = {
    pathname: string;
};

export function FarmAuthenticatedNavigation({
    pathname,
}: FarmAuthenticatedNavigationProps) {
    const notificationsQuery = useFarmNotifications('unread', 1);
    const hasUnreadNotifications = Boolean(notificationsQuery.data?.length);

    return (
        <FarmPrimaryNavigation
            hasUnreadNotifications={hasUnreadNotifications}
            pathname={pathname}
        />
    );
}
