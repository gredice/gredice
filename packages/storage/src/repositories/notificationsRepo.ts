import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, notExists, or } from 'drizzle-orm';
import { accounts, storage } from '..';
import { isTargetHourInTimeZone } from '../helpers/timezoneUtils';
import {
    accountUsers,
    type InsertNotification,
    notificationDeliveryAttempts,
    notificationEmailLog,
    notifications,
    notificationUserChannelPreferences,
    type SelectNotification,
    type SelectNotificationUserChannelPreference,
    userNotificationSettings,
    users,
    webPushSubscriptions,
} from '../schema';

type DeliveryChannel = 'email' | 'push';
type DeliveryOutcome = 'immediate' | 'digest' | 'suppressed' | 'required';
type DeliveryAttemptStatus = 'accepted' | 'queued' | 'dropped';

export type NotificationDeliveryDecision = {
    channel: DeliveryChannel;
    outcome: DeliveryOutcome;
    reason: string;
    required: boolean;
};

function minutesInTimezone(date: Date, timeZone?: string): number | undefined {
    if (!timeZone) return undefined;
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
}

function isInsideQuietHours(
    nowMinute: number | undefined,
    preference: SelectNotificationUserChannelPreference,
): boolean {
    if (
        nowMinute === undefined ||
        preference.quietHoursStartMinute === null ||
        preference.quietHoursEndMinute === null
    ) {
        return false;
    }
    const start = preference.quietHoursStartMinute;
    const end = preference.quietHoursEndMinute;
    if (start === end) return false;
    return start < end
        ? nowMinute >= start && nowMinute < end
        : nowMinute >= start || nowMinute < end;
}

function decideDeliveryOutcome({
    channel,
    preference,
    hasPushSubscription,
    now,
}: {
    channel: DeliveryChannel;
    preference?: SelectNotificationUserChannelPreference;
    hasPushSubscription: boolean;
    now: Date;
}): NotificationDeliveryDecision {
    const required = preference?.required ?? false;
    if (channel === 'push' && !hasPushSubscription) {
        return {
            channel,
            outcome: required ? 'required' : 'suppressed',
            reason: 'missing_push_subscription',
            required,
        };
    }
    if ((preference?.enabled ?? true) === false) {
        return {
            channel,
            outcome: required ? 'required' : 'suppressed',
            reason: 'preference_disabled',
            required,
        };
    }
    const nowMinute = minutesInTimezone(now, preference?.timezone ?? undefined);
    if (!required && preference && isInsideQuietHours(nowMinute, preference)) {
        return {
            channel,
            outcome: 'digest',
            reason: 'quiet_hours',
            required: false,
        };
    }
    if (!required && (preference?.digestFrequency ?? 'off') !== 'off') {
        return {
            channel,
            outcome: 'digest',
            reason: `digest_${preference?.digestFrequency}`,
            required: false,
        };
    }
    return {
        channel,
        outcome: required ? 'required' : 'immediate',
        reason: required ? 'required_notification' : 'eligible_immediate',
        required,
    };
}

function deliveryAttemptStatusForOutcome(
    outcome: DeliveryOutcome,
): DeliveryAttemptStatus {
    if (outcome === 'suppressed') return 'dropped';
    if (outcome === 'digest') return 'queued';
    return 'accepted';
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

export async function routeNotificationDelivery(notificationId: string) {
    const notification = await getNotification(notificationId);
    if (!notification) return [];
    const now = new Date();
    const targetChannels: DeliveryChannel[] = ['email', 'push'];
    const preferences = notification.userId
        ? await storage().query.notificationUserChannelPreferences.findMany({
              where: eq(
                  notificationUserChannelPreferences.userId,
                  notification.userId,
              ),
          })
        : [];
    const pushSubscriptionCount = notification.userId
        ? await storage()
              .select({ id: webPushSubscriptions.id })
              .from(webPushSubscriptions)
              .where(
                  and(
                      eq(webPushSubscriptions.userId, notification.userId),
                      eq(webPushSubscriptions.enabled, true),
                  ),
              )
              .limit(1)
        : [];
    const hasPushSubscription = pushSubscriptionCount.length > 0;

    const decisions: NotificationDeliveryDecision[] = targetChannels.map(
        (channel) => {
            const accountPref = preferences.find(
                (p) =>
                    p.scope === 'account' &&
                    p.accountId === notification.accountId &&
                    p.category === notification.category &&
                    p.channel === channel,
            );
            const globalPref = preferences.find(
                (p) =>
                    p.scope === 'global' &&
                    p.category === notification.category &&
                    p.channel === channel,
            );
            return decideDeliveryOutcome({
                channel,
                preference: accountPref ?? globalPref,
                hasPushSubscription,
                now,
            });
        },
    );

    if (notification.userId || notification.accountId) {
        await storage()
            .insert(notificationDeliveryAttempts)
            .values(
                decisions.map((decision) => ({
                    notificationId,
                    userId: notification.userId ?? null,
                    accountId: notification.accountId,
                    channel: decision.channel,
                    status: deliveryAttemptStatusForOutcome(decision.outcome),
                    provider: 'router',
                    providerResponseCode: decision.reason,
                })),
            );
    }

    return decisions;
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
            ? and(
                  eq(notifications.accountId, accountId),
                  isNull(notifications.userId),
              )
            : and(
                  eq(notifications.accountId, accountId),
                  isNull(notifications.userId),
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
