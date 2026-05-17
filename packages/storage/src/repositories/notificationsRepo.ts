import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, notExists, or } from 'drizzle-orm';
import { storage } from '..';
import { isTargetHourInTimeZone } from '../helpers/timezoneUtils';
import {
    accounts,
    accountUsers,
    gardens,
    type InsertNotification,
    type InsertNotificationCampaign,
    type NotificationCampaignAudience,
    type NotificationCampaignDeliveryMetadata,
    notificationCampaigns,
    notificationDeliveryAttempts,
    notificationEmailLog,
    notifications,
    notificationUserChannelPreferences,
    type SelectNotification,
    type SelectNotificationCampaign,
    type SelectNotificationUserChannelPreference,
    userNotificationSettings,
    users,
    webPushSubscriptions,
} from '../schema';

type DeliveryChannel = 'email' | 'push';
type DeliveryOutcome = 'immediate' | 'digest' | 'suppressed' | 'required';
type DeliveryAttemptStatus = 'accepted' | 'queued' | 'dropped';
type NotificationCampaignQueueStatus = 'queued' | 'scheduled';
type NotificationCampaignExplicitRecipient = Extract<
    NotificationCampaignAudience,
    { type: 'explicit' }
>['recipients'][number];

export type NotificationDeliveryDecision = {
    channel: DeliveryChannel;
    outcome: DeliveryOutcome;
    reason: string;
    required: boolean;
};

export type NotificationCampaignAudiencePreview = {
    audienceType: NotificationCampaignAudience['type'];
    targetCount: number;
    accountCount: number;
    userCount: number;
    gardenCount: number;
    explicitRecipientCount: number;
    unmatchedRecipientCount: number;
};

export type CreateNotificationCampaignInput = Omit<
    InsertNotificationCampaign,
    | 'status'
    | 'targetCount'
    | 'queuedCount'
    | 'sentCount'
    | 'failedCount'
    | 'suppressedCount'
    | 'enqueuedAt'
    | 'startedAt'
    | 'completedAt'
    | 'cancelledAt'
    | 'cancelledByUserId'
    | 'failures'
>;

type AudienceMembershipRow = {
    accountId: string;
    userId: string;
    gardenId?: number;
};

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values));
}

function uniqueNumbers(values: number[]) {
    return Array.from(new Set(values));
}

function recipientKey(recipient: {
    accountId: string;
    userId: string;
    gardenId?: number;
}) {
    return `${recipient.accountId}:${recipient.userId}:${recipient.gardenId ?? ''}`;
}

function membershipKey(row: { accountId: string; userId: string }) {
    return `${row.accountId}:${row.userId}`;
}

function normalizeAudience(
    audience: NotificationCampaignAudience,
): NotificationCampaignAudience {
    switch (audience.type) {
        case 'all':
            return audience;
        case 'accounts':
            return {
                type: audience.type,
                accountIds: uniqueStrings(audience.accountIds),
            };
        case 'users':
            return {
                type: audience.type,
                userIds: uniqueStrings(audience.userIds),
                accountIds: audience.accountIds
                    ? uniqueStrings(audience.accountIds)
                    : undefined,
            };
        case 'gardens':
            return {
                type: audience.type,
                gardenIds: uniqueNumbers(audience.gardenIds),
            };
        case 'explicit': {
            const recipients = new Map<
                string,
                NotificationCampaignExplicitRecipient
            >();
            for (const recipient of audience.recipients) {
                recipients.set(recipientKey(recipient), recipient);
            }
            return {
                type: audience.type,
                recipients: Array.from(recipients.values()),
            };
        }
    }
}

function audiencePreviewFromRows(
    audienceType: NotificationCampaignAudience['type'],
    rows: AudienceMembershipRow[],
    explicitRecipientCount = 0,
    unmatchedRecipientCount = 0,
): NotificationCampaignAudiencePreview {
    const memberships = new Map<string, AudienceMembershipRow>();
    for (const row of rows) {
        memberships.set(membershipKey(row), row);
    }
    const uniqueRows = Array.from(memberships.values());
    return {
        audienceType,
        targetCount: uniqueRows.length,
        accountCount: new Set(uniqueRows.map((row) => row.accountId)).size,
        userCount: new Set(uniqueRows.map((row) => row.userId)).size,
        gardenCount: new Set(
            rows
                .map((row) => row.gardenId)
                .filter(
                    (gardenId): gardenId is number => gardenId !== undefined,
                ),
        ).size,
        explicitRecipientCount,
        unmatchedRecipientCount,
    };
}

async function previewExplicitCampaignAudience(
    recipients: Extract<
        NotificationCampaignAudience,
        { type: 'explicit' }
    >['recipients'],
): Promise<NotificationCampaignAudiencePreview> {
    const normalizedAudience = normalizeAudience({
        type: 'explicit',
        recipients,
    });
    const normalizedRecipients =
        normalizedAudience.type === 'explicit'
            ? normalizedAudience.recipients
            : [];
    const userIds = uniqueStrings(
        normalizedRecipients.map((recipient) => recipient.userId),
    );
    const accountIds = uniqueStrings(
        normalizedRecipients.map((recipient) => recipient.accountId),
    );
    const memberships =
        userIds.length > 0 && accountIds.length > 0
            ? await storage()
                  .select({
                      accountId: accountUsers.accountId,
                      userId: accountUsers.userId,
                  })
                  .from(accountUsers)
                  .where(
                      and(
                          inArray(accountUsers.userId, userIds),
                          inArray(accountUsers.accountId, accountIds),
                      ),
                  )
            : [];
    const membershipKeys = new Set(memberships.map(membershipKey));

    const gardenIds = uniqueNumbers(
        normalizedRecipients
            .map((recipient) => recipient.gardenId)
            .filter((gardenId): gardenId is number => gardenId !== undefined),
    );
    const matchedGardens =
        gardenIds.length > 0
            ? await storage()
                  .select({
                      gardenId: gardens.id,
                      accountId: gardens.accountId,
                  })
                  .from(gardens)
                  .where(
                      and(
                          inArray(gardens.id, gardenIds),
                          eq(gardens.isDeleted, false),
                      ),
                  )
            : [];
    const gardenAccountById = new Map(
        matchedGardens.map((garden) => [garden.gardenId, garden.accountId]),
    );

    const matchedRows: AudienceMembershipRow[] = [];
    let unmatchedRecipientCount = 0;
    for (const recipient of normalizedRecipients) {
        const hasMembership = membershipKeys.has(membershipKey(recipient));
        const gardenAccountId =
            recipient.gardenId === undefined
                ? recipient.accountId
                : gardenAccountById.get(recipient.gardenId);
        if (hasMembership && gardenAccountId === recipient.accountId) {
            matchedRows.push(recipient);
        } else {
            unmatchedRecipientCount += 1;
        }
    }

    return audiencePreviewFromRows(
        'explicit',
        matchedRows,
        normalizedRecipients.length,
        unmatchedRecipientCount,
    );
}

function campaignQueueStatus(
    scheduledAt: Date | null | undefined,
    now: Date,
): NotificationCampaignQueueStatus {
    if (scheduledAt && scheduledAt.getTime() > now.getTime()) {
        return 'scheduled';
    }
    return 'queued';
}

function campaignDeliveryMetadata({
    campaign,
    preview,
    requestedByUserId,
    requestedAt,
    scheduledAt,
    status,
}: {
    campaign: SelectNotificationCampaign;
    preview: NotificationCampaignAudiencePreview;
    requestedByUserId: string;
    requestedAt: Date;
    scheduledAt: Date | null;
    status: NotificationCampaignQueueStatus;
}): NotificationCampaignDeliveryMetadata {
    return {
        ...campaign.deliveryMetadata,
        router: 'preference_aware_delivery_router',
        preferenceAware: true,
        audiencePreview: preview,
        enqueue: {
            requestedByUserId,
            requestedAt: requestedAt.toISOString(),
            scheduledAt: scheduledAt?.toISOString() ?? null,
            status,
        },
    };
}

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

export async function previewNotificationCampaignAudience(
    audienceInput: NotificationCampaignAudience,
): Promise<NotificationCampaignAudiencePreview> {
    const audience = normalizeAudience(audienceInput);
    if (audience.type === 'explicit') {
        return await previewExplicitCampaignAudience(audience.recipients);
    }

    if (audience.type === 'all') {
        const rows = await storage()
            .select({
                accountId: accountUsers.accountId,
                userId: accountUsers.userId,
            })
            .from(accountUsers);
        return audiencePreviewFromRows(audience.type, rows);
    }

    if (audience.type === 'accounts') {
        const rows = await storage()
            .select({
                accountId: accountUsers.accountId,
                userId: accountUsers.userId,
            })
            .from(accountUsers)
            .where(inArray(accountUsers.accountId, audience.accountIds));
        return audiencePreviewFromRows(audience.type, rows);
    }

    if (audience.type === 'users') {
        const rows = await storage()
            .select({
                accountId: accountUsers.accountId,
                userId: accountUsers.userId,
            })
            .from(accountUsers)
            .where(
                audience.accountIds && audience.accountIds.length > 0
                    ? and(
                          inArray(accountUsers.userId, audience.userIds),
                          inArray(accountUsers.accountId, audience.accountIds),
                      )
                    : inArray(accountUsers.userId, audience.userIds),
            );
        return audiencePreviewFromRows(audience.type, rows);
    }

    const rows = await storage()
        .select({
            accountId: accountUsers.accountId,
            userId: accountUsers.userId,
            gardenId: gardens.id,
        })
        .from(gardens)
        .innerJoin(accountUsers, eq(gardens.accountId, accountUsers.accountId))
        .where(
            and(
                inArray(gardens.id, audience.gardenIds),
                eq(gardens.isDeleted, false),
            ),
        );
    return audiencePreviewFromRows(audience.type, rows);
}

export async function createNotificationCampaign(
    input: CreateNotificationCampaignInput,
): Promise<string> {
    const result = await storage()
        .insert(notificationCampaigns)
        .values({
            id: randomUUID(),
            ...input,
            audience: normalizeAudience(input.audience),
            deliveryMetadata: {
                ...(input.deliveryMetadata ?? {}),
                router: 'preference_aware_delivery_router',
                preferenceAware: true,
            },
        })
        .returning({ id: notificationCampaigns.id });
    return result[0].id;
}

export async function getNotificationCampaign(
    id: string,
): Promise<SelectNotificationCampaign | undefined> {
    return await storage().query.notificationCampaigns.findFirst({
        where: eq(notificationCampaigns.id, id),
    });
}

export async function enqueueNotificationCampaign({
    id,
    requestedByUserId,
    scheduledAt,
}: {
    id: string;
    requestedByUserId: string;
    scheduledAt?: Date | null;
}): Promise<SelectNotificationCampaign | undefined> {
    const campaign = await getNotificationCampaign(id);
    if (!campaign) return undefined;
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        return campaign;
    }

    const now = new Date();
    const effectiveScheduledAt = scheduledAt ?? campaign.scheduledAt;
    const status = campaignQueueStatus(effectiveScheduledAt, now);
    const preview = await previewNotificationCampaignAudience(
        campaign.audience,
    );
    const result = await storage()
        .update(notificationCampaigns)
        .set({
            status,
            scheduledAt: effectiveScheduledAt,
            enqueuedAt: status === 'queued' ? now : null,
            targetCount: preview.targetCount,
            queuedCount: status === 'queued' ? preview.targetCount : 0,
            deliveryMetadata: campaignDeliveryMetadata({
                campaign,
                preview,
                requestedByUserId,
                requestedAt: now,
                scheduledAt: effectiveScheduledAt ?? null,
                status,
            }),
            updatedAt: now,
        })
        .where(eq(notificationCampaigns.id, id))
        .returning();
    return result[0];
}

export async function cancelNotificationCampaign({
    id,
    cancelledByUserId,
}: {
    id: string;
    cancelledByUserId: string;
}): Promise<SelectNotificationCampaign | undefined> {
    const campaign = await getNotificationCampaign(id);
    if (!campaign) return undefined;
    if (
        campaign.status !== 'draft' &&
        campaign.status !== 'scheduled' &&
        campaign.status !== 'queued'
    ) {
        return campaign;
    }

    const now = new Date();
    const result = await storage()
        .update(notificationCampaigns)
        .set({
            status: 'cancelled',
            cancelledAt: now,
            cancelledByUserId,
            queuedCount: 0,
            deliveryMetadata: {
                ...campaign.deliveryMetadata,
                cancel: {
                    requestedByUserId: cancelledByUserId,
                    requestedAt: now.toISOString(),
                    previousStatus: campaign.status,
                },
            },
            updatedAt: now,
        })
        .where(eq(notificationCampaigns.id, id))
        .returning();
    return result[0];
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
