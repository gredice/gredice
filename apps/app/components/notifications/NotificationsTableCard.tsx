import {
    getAccounts,
    getAllRaisedBeds,
    getGardens,
    getNotifications,
    getNotificationsByAccount,
    getNotificationsByUser,
} from '@gredice/storage';
import { deleteNotifications } from './(actions)/notificationActions';
import type { NotificationTableRow } from './NotificationsTable';
import { NotificationsTableCardClient } from './NotificationsTableCardClient';

type NotificationTableCardProps = {
    accountId?: string;
    userId?: string;
    gardenId?: number;
    raisedBedId?: number;
    showCard?: boolean;
    showAccountLabels?: boolean;
    showAccountColumn?: boolean;
    limit?: number;
    page?: number;
    scroll?: boolean;
};

export async function NotificationsTableCard({
    accountId,
    userId,
    gardenId,
    raisedBedId,
    showCard = true,
    showAccountLabels = false,
    showAccountColumn = true,
    limit = 10000,
    page = 0,
    scroll = false,
}: NotificationTableCardProps) {
    // Determine what to fetch based on provided filters
    const fetchAll = !accountId && !userId;

    const [
        accountNotifications,
        userNotifications,
        allNotifications,
        gardens,
        raisedBeds,
        accounts,
    ] = await Promise.all([
        accountId
            ? getNotificationsByAccount(accountId, true, page, limit)
            : Promise.resolve([]),
        userId
            ? getNotificationsByUser(userId, true, page, limit)
            : Promise.resolve([]),
        fetchAll ? getNotifications(page, limit) : Promise.resolve([]),
        getGardens(),
        getAllRaisedBeds(),
        getAccounts(),
    ]);

    // Build account labels if needed
    const accountLabels: Record<string, string> = {};
    if (showAccountLabels) {
        for (const account of accounts) {
            const users =
                account.accountUsers
                    ?.map((accountUser) => accountUser.user?.userName)
                    .filter(Boolean) ?? [];
            accountLabels[account.id] = users.join(', ') || account.id;
        }
    }

    // Combine notifications from different sources
    const combinedNotifications = fetchAll
        ? allNotifications
        : [...accountNotifications, ...userNotifications];

    // Filter notifications by gardenId or raisedBedId if provided
    const filteredNotifications = combinedNotifications.filter(
        (notification) => {
            if (gardenId && notification.gardenId !== gardenId) return false;
            if (raisedBedId && notification.raisedBedId !== raisedBedId)
                return false;
            return true;
        },
    );

    const gardenNames = new Map(
        gardens.map((garden) => [garden.id, garden.name]),
    );
    const raisedBedPhysicalIds = new Map(
        raisedBeds.map((raisedBed) => [raisedBed.id, raisedBed.physicalId]),
    );
    const tableRows: NotificationTableRow[] = filteredNotifications.map(
        (notification) => ({
            id: notification.id,
            accountId: notification.accountId,
            accountLabel: notification.accountId
                ? accountLabels[notification.accountId] ||
                  notification.accountId
                : null,
            blockId: notification.blockId,
            category: notification.category,
            content: notification.content,
            createdAt: notification.createdAt.toISOString(),
            gardenId: notification.gardenId,
            gardenName: notification.gardenId
                ? (gardenNames.get(notification.gardenId) ?? null)
                : null,
            header: notification.header,
            imageUrl: notification.imageUrl,
            linkUrl: notification.linkUrl,
            raisedBedId: notification.raisedBedId,
            raisedBedPhysicalId: notification.raisedBedId
                ? (raisedBedPhysicalIds.get(notification.raisedBedId) ?? null)
                : null,
            readAt: notification.readAt?.toISOString() ?? null,
            timestamp: notification.timestamp.toISOString(),
            type: notification.type,
            primaryChannel: notification.primaryChannel,
            userId: notification.userId,
        }),
    );

    return (
        <NotificationsTableCardClient
            accountId={accountId}
            accounts={accounts.map((account) => ({
                id: account.id,
                label: accountLabels[account.id] || account.id,
            }))}
            deleteContext={{ accountId, userId, gardenId, raisedBedId }}
            deleteNotificationsAction={deleteNotifications}
            notifications={tableRows}
            scroll={scroll}
            showAccountColumn={showAccountColumn}
            showCard={showCard}
        />
    );
}
