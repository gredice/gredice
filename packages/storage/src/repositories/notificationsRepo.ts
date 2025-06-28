import { and, eq, or, inArray, desc, isNull, notExists } from 'drizzle-orm';
import { notifications, InsertNotification, SelectNotification, notificationEmailLog, users, userNotificationSettings, accountUsers } from '../schema';
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

export async function notificationsDigest({ markSent = true }: { markSent?: boolean } = {}) {
    // 1. Get all users who want daily digests
    const digestUsers = await storage()
        .select({
            id: users.id,
            email: users.userName
        })
        .from(users)
        .leftJoin(
            userNotificationSettings,
            eq(users.id, userNotificationSettings.userId))
        .where(
            or(
                and(
                    eq(userNotificationSettings.emailEnabled, true),
                    eq(userNotificationSettings.dailyDigest, true)
                ),
                isNull(userNotificationSettings.userId)));

    // Get user accounts
    const usersAccounts = await storage()
        .select({
            accountId: accountUsers.accountId,
            userId: accountUsers.userId
        })
        .from(accountUsers)
        .where(inArray(accountUsers.userId, digestUsers.map(u => u.id)));

    const bulkEmailData: { userId: string, email: string, newNotificationsCount: number }[] = [];
    const emailLogEntries: { userId: string, notificationId: string }[] = [];

    for (const user of digestUsers) {
        const accountIds = usersAccounts
            .filter(ua => ua.userId === user.id)
            .map(ua => ua.accountId);

        // 2. Get unread + unemailed notifications targeted to this user or their account
        const notificationsToEmail = await storage()
            .select({
                id: notifications.id
            })
            .from(notifications)
            .where(and(
                isNull(notifications.readAt), // only unread notifications
                or(
                    eq(notifications.userId, user.id), // directly to user
                    and(
                        isNull(notifications.userId),     // account-wide
                        inArray(notifications.accountId, accountIds) // for user's accounts
                    )
                ),
                notExists(
                    storage().select().from(notificationEmailLog).where(and(
                        eq(notificationEmailLog.notificationId, notifications.id),
                        eq(notificationEmailLog.userId, user.id)
                    ))
                )
            ));

        if (notificationsToEmail.length > 0) {
            // Add to bulk email send
            bulkEmailData.push({
                userId: user.id,
                email: user.email,
                newNotificationsCount: notificationsToEmail.length
            });

            // Track these for logging
            emailLogEntries.push(
                ...notificationsToEmail.map(n => ({
                    userId: user.id,
                    notificationId: n.id
                }))
            );
        }
    }

    if (markSent && bulkEmailData.length > 0) {
        await storage().insert(notificationEmailLog).values(emailLogEntries);
    }

    return bulkEmailData;
}