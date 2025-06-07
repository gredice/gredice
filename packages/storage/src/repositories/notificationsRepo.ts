import { and, eq, isNotNull } from 'drizzle-orm';
import { notifications, InsertNotification, SelectNotification } from '../schema';
import { storage } from '..';
import { randomUUID } from 'node:crypto';

export async function createNotification(notification: InsertNotification) {
    const result = await storage().insert(notifications).values({
        id: randomUUID(),
        ...notification
    }).returning({ id: notifications.id });
    return result[0].id;
}

export function getNotificationsByUser(userId: string, read?: boolean): Promise<SelectNotification[]> {
    return storage().query.notifications.findMany({
        where: read === undefined
            ? eq(notifications.userId, userId)
            : and(
                eq(notifications.userId, userId),
                isNotNull(notifications.readAt)),
        orderBy: notifications.createdAt,
    });
}

export function getNotificationsByAccount(accountId: string, read?: boolean): Promise<SelectNotification[]> {
    return storage().query.notifications.findMany({
        where: read === undefined
            ? eq(notifications.accountId, accountId)
            : and(
                eq(notifications.accountId, accountId),
                isNotNull(notifications.readAt)),
        orderBy: notifications.createdAt,
    });
}

export function markNotificationRead(id: string, readWhere: string) {
    return storage().update(notifications)
        .set({ readAt: new Date(), readWhere })
        .where(eq(notifications.id, id));
}

export function markAllNotificationsRead(userId: string, readWhere: string) {
    return storage().update(notifications)
        .set({ readAt: new Date(), readWhere })
        .where(and(eq(notifications.userId, userId), isNotNull(notifications.readAt)));
}
