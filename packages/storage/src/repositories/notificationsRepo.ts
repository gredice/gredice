import { and, eq, isNotNull, or, inArray, desc, isNull } from 'drizzle-orm';
import { notifications, InsertNotification, SelectNotification } from '../schema';
import { storage } from '..';
import { randomUUID } from 'node:crypto';

export async function getNotification(id: string): Promise<SelectNotification | undefined> {
    const result = await storage().query.notifications.findFirst({
        where: eq(notifications.id, id),
    });
    return result;
}

export async function createNotification(notification: InsertNotification) {
    const result = await storage().insert(notifications).values({
        id: randomUUID(),
        ...notification
    }).returning({ id: notifications.id });
    return result[0].id;
}

export function getNotificationsByUser(userId: string, read: boolean, page: number, limit: number): Promise<SelectNotification[]> {
    return storage().query.notifications.findMany({
        where: read
            ? eq(notifications.userId, userId)
            : and(
                eq(notifications.userId, userId),
                isNull(notifications.readAt)),
        orderBy: desc(notifications.createdAt),
        limit,
        offset: page * limit,
    });
}

export function getNotificationsByAccount(accountId: string, read: boolean, page: number, limit: number): Promise<SelectNotification[]> {
    return storage().query.notifications.findMany({
        where: read
            ? eq(notifications.accountId, accountId)
            : and(
                eq(notifications.accountId, accountId),
                isNull(notifications.readAt)),
        orderBy: desc(notifications.createdAt),
        limit,
        offset: page * limit,
    });
}

export function setNotificationRead(id: string, read: boolean, readWhere: string) {
    return storage().update(notifications)
        .set({ readAt: read ? new Date() : null, readWhere })
        .where(eq(notifications.id, id));
}

export function setAllNotificationsRead(accountId: string, userId: string, notificationIds: string[], read: boolean, readWhere: string) {
    return storage().update(notifications)
        .set({ readAt: read ? new Date() : null, readWhere })
        .where(
            and(
                inArray(notifications.id, notificationIds),
                or(
                    eq(notifications.accountId, accountId),
                    eq(notifications.userId, userId))));
}

export function deleteNotification(id: string) {
    return storage().delete(notifications).where(eq(notifications.id, id));
}