import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, notExists, or } from 'drizzle-orm';
import { accounts, storage } from '..';
import {
    accountUsers,
    type InsertNotification,
    notificationEmailLog,
    notifications,
    type SelectNotification,
    userNotificationSettings,
    users,
} from '../schema';

/**
 * Check if the current hour in a timezone matches the target hour.
 */
function isTargetHourInTimeZone(
    timeZone: string,
    targetHour: number,
    now: Date = new Date(),
): boolean {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            hour12: false,
        });
        const currentHour = Number.parseInt(formatter.format(now), 10);
        return currentHour === targetHour;
    } catch {
        // If timezone is invalid, default to Europe/Paris
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Paris',
            hour: 'numeric',
            hour12: false,
        });
        const currentHour = Number.parseInt(formatter.format(now), 10);
        return currentHour === targetHour;
    }
}

export async function getNotification(
    id: string,
): Promise<SelectNotification | undefined> {
    const result = await storage().query.notifications.findFirst({
        where: eq(notifications.id, id),
    });
    return result;
}

export async function createNotification(notification: InsertNotification) {
    const result = await storage()
        .insert(notifications)
        .values({
            id: randomUUID(),
            ...notification,
        })
        .returning({ id: notifications.id });
    return result[0].id;
}

export function getNotificationsByUser(
    userId: string,
    read: boolean,
    page: number,
    limit: number,
): Promise<SelectNotification[]> {
    return storage().query.notifications.findMany({
        where: read
            ? eq(notifications.userId, userId)
            : and(
                  eq(notifications.userId, userId),
                  isNull(notifications.readAt),
              ),
        orderBy: desc(notifications.timestamp),
        limit,
        offset: page * limit,
    });
}

export function getNotificationsByAccount(
    accountId: string,
    read: boolean,
    page: number,
    limit: number,
): Promise<SelectNotification[]> {
    return storage().query.notifications.findMany({
        where: read
            ? eq(notifications.accountId, accountId)
            : and(
                  eq(notifications.accountId, accountId),
                  isNull(notifications.readAt),
              ),
        orderBy: desc(notifications.timestamp),
        limit,
        offset: page * limit,
    });
}

export function getNotifications(page: number, limit: number) {
    return storage().query.notifications.findMany({
        orderBy: desc(notifications.timestamp),
        limit,
        offset: page * limit,
    });
}

export function setNotificationRead(
    id: string,
    read: boolean,
    readWhere: string,
) {
    return storage()
        .update(notifications)
        .set({ readAt: read ? new Date() : null, readWhere })
        .where(eq(notifications.id, id));
}

export function setAllNotificationsRead(
    accountId: string,
    userId: string,
    notificationIds: string[],
    read: boolean,
    readWhere: string,
) {
    return storage()
        .update(notifications)
        .set({ readAt: read ? new Date() : null, readWhere })
        .where(
            and(
                inArray(notifications.id, notificationIds),
                or(
                    eq(notifications.accountId, accountId),
                    eq(notifications.userId, userId),
                ),
            ),
        );
}

export function deleteNotification(id: string) {
    return storage().delete(notifications).where(eq(notifications.id, id));
}

export async function notificationsDigest({
    markSent = true,
    targetHour,
}: {
    markSent?: boolean;
    /**
     * If provided, only process users whose accounts have timezones
     * where the current hour matches this target hour.
     * Use this to send notifications at 8 AM user local time.
     */
    targetHour?: number;
} = {}) {
    // 1. Get all users who want daily digests
    const digestUsers = await storage()
        .select({
            id: users.id,
            email: users.userName,
        })
        .from(users)
        .leftJoin(
            userNotificationSettings,
            eq(users.id, userNotificationSettings.userId),
        )
        .where(
            or(
                and(
                    eq(userNotificationSettings.emailEnabled, true),
                    eq(userNotificationSettings.dailyDigest, true),
                ),
                isNull(userNotificationSettings.userId),
            ),
        );

    // Get user accounts with timezone
    const usersAccounts = await storage()
        .select({
            accountId: accountUsers.accountId,
            userId: accountUsers.userId,
            timeZone: accounts.timeZone,
        })
        .from(accountUsers)
        .innerJoin(accounts, eq(accountUsers.accountId, accounts.id))
        .where(
            inArray(
                accountUsers.userId,
                digestUsers.map((u) => u.id),
            ),
        );

    // If targetHour is specified, filter users based on their account timezone
    const now = new Date();
    const filteredUsers =
        targetHour !== undefined
            ? digestUsers.filter((user) => {
                  const userAccountData = usersAccounts.filter(
                      (ua) => ua.userId === user.id,
                  );
                  // User qualifies if any of their accounts is in the target hour
                  return userAccountData.some((ua) =>
                      isTargetHourInTimeZone(ua.timeZone, targetHour, now),
                  );
              })
            : digestUsers;

    const bulkEmailData: {
        userId: string;
        email: string;
        newNotificationsCount: number;
        notificationImageUrls: string[];
    }[] = [];
    const emailLogEntries: { userId: string; notificationId: string }[] = [];

    for (const user of filteredUsers) {
        const accountIds = usersAccounts
            .filter((ua) => ua.userId === user.id)
            .map((ua) => ua.accountId);

        // 2. Get unread + unemailed notifications targeted to this user or their account
        const notificationsToEmail = await storage()
            .select({
                id: notifications.id,
                imageUrl: notifications.imageUrl,
            })
            .from(notifications)
            .where(
                and(
                    isNull(notifications.readAt), // only unread notifications
                    or(
                        eq(notifications.userId, user.id), // directly to user
                        and(
                            isNull(notifications.userId), // account-wide
                            inArray(notifications.accountId, accountIds), // for user's accounts
                        ),
                    ),
                    notExists(
                        storage()
                            .select()
                            .from(notificationEmailLog)
                            .where(
                                and(
                                    eq(
                                        notificationEmailLog.notificationId,
                                        notifications.id,
                                    ),
                                    eq(notificationEmailLog.userId, user.id),
                                ),
                            ),
                    ),
                ),
            )
            .orderBy(desc(notifications.createdAt));

        if (notificationsToEmail.length > 0) {
            // Add to bulk email send
            const notificationImageUrls = Array.from(
                new Set(
                    notificationsToEmail
                        .map((notification) => notification.imageUrl)
                        .filter((imageUrl): imageUrl is string =>
                            Boolean(imageUrl),
                        ),
                ),
            );

            bulkEmailData.push({
                userId: user.id,
                email: user.email,
                newNotificationsCount: notificationsToEmail.length,
                notificationImageUrls,
            });

            // Track these for logging
            emailLogEntries.push(
                ...notificationsToEmail.map((n) => ({
                    userId: user.id,
                    notificationId: n.id,
                })),
            );
        }
    }

    if (markSent && bulkEmailData.length > 0) {
        await storage().insert(notificationEmailLog).values(emailLogEntries);
    }

    return bulkEmailData;
}
