import { and, eq } from 'drizzle-orm';
import { notifications, InsertNotification, UpdateNotification, SelectNotification } from '../schema';
import { storage } from '..';

export function createNotification(notification: InsertNotification) {
    return storage.insert(notifications).values(notification);
}

export function getNotificationsByUser(userId: string, read?: boolean): Promise<SelectNotification[]> {
    return storage.query.notifications.findMany({
        where: read === undefined
            ? eq(notifications.userId, userId)
            : and(eq(notifications.userId, userId), eq(notifications.read, read)),
        orderBy: notifications.createdAt,
    });
}

export function getNotificationsByAccount(accountId: string, read?: boolean): Promise<SelectNotification[]> {
    return storage.query.notifications.findMany({
        where: read === undefined
            ? eq(notifications.accountId, accountId)
            : and(eq(notifications.accountId, accountId), eq(notifications.read, read)),
        orderBy: notifications.createdAt,
    });
}

export function markNotificationRead(id: number, readWhere: string) {
    return storage.update(notifications)
        .set({ read: true, readWhere })
        .where(eq(notifications.id, id));
}

export function markAllNotificationsRead(userId: string, readWhere: string) {
    return storage.update(notifications)
        .set({ read: true, readWhere })
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}
