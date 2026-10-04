import { useState } from 'react';
import {
    FarmNotificationList,
    setFarmNotificationReadState,
    setFarmNotificationsReadState,
} from '../app/notifications/FarmNotificationList';
import type { FarmNotification } from '../app/notifications/notificationTypes';

const baseDate = new Date('2026-07-04T08:30:00.000Z');

const initialNotifications: FarmNotification[] = [
    {
        id: 'notification-unread',
        actionUrl: null,
        content: 'Dodijeljena ti je radnja **Zalijevanje**.',
        createdAt: baseDate,
        header: 'Nova radnja',
        iconUrl: null,
        imageUrl: null,
        linkUrl: null,
        raisedBedId: null,
        readAt: null,
        timestamp: baseDate,
    },
    {
        id: 'notification-read',
        actionUrl: null,
        content: 'Podsjetnik je već pregledan.',
        createdAt: baseDate,
        header: 'Stara obavijest',
        iconUrl: null,
        imageUrl: null,
        linkUrl: null,
        raisedBedId: null,
        readAt: new Date('2026-07-04T09:00:00.000Z'),
        timestamp: baseDate,
    },
    {
        id: 'notification-raised-bed',
        actionUrl: null,
        content: 'Gredica treba pregled.',
        createdAt: baseDate,
        header: 'Gredica za pregled',
        iconUrl: null,
        imageUrl: null,
        linkUrl: 'https://vrt.gredice.com?gredica=Test',
        raisedBedId: 42,
        readAt: null,
        timestamp: baseDate,
    },
    {
        id: 'notification-unsupported',
        actionUrl: null,
        content: 'Stara vrtna poveznica nema Farm odredište.',
        createdAt: baseDate,
        header: 'Vrtna poveznica',
        iconUrl: null,
        imageUrl: null,
        linkUrl: 'https://vrt.gredice.com?gredica=BezIda',
        raisedBedId: null,
        readAt: null,
        timestamp: baseDate,
    },
];

export function FarmNotificationListHarness() {
    const [filter, setFilter] = useState<'unread' | 'all'>('unread');
    const [notifications, setNotifications] = useState(initialNotifications);
    const [openedTarget, setOpenedTarget] = useState('not-opened');

    return (
        <>
            <FarmNotificationList
                filter={filter}
                notifications={notifications}
                onFilterChange={setFilter}
                onMarkAllRead={(ids) =>
                    setNotifications((current) =>
                        setFarmNotificationsReadState(current, ids, baseDate),
                    )
                }
                onNotificationOpen={(notification, target) => {
                    if (!notification.readAt) {
                        setNotifications((current) =>
                            setFarmNotificationReadState(
                                current,
                                notification.id,
                                true,
                                baseDate,
                            ),
                        );
                    }
                    setOpenedTarget(target?.href ?? 'none');
                }}
                onNotificationReadChange={(notification, read) =>
                    setNotifications((current) =>
                        setFarmNotificationReadState(
                            current,
                            notification.id,
                            read,
                            baseDate,
                        ),
                    )
                }
            />
            <output data-testid="opened-target">{openedTarget}</output>
        </>
    );
}
