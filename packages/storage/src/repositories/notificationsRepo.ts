import { randomUUID } from 'node:crypto';
import {
    and,
    desc,
    eq,
    inArray,
    isNull,
    notExists,
    or,
    sql,
} from 'drizzle-orm';
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
    notificationDeliveryEvents,
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

type DeliveryChannel = 'email' | 'in_app' | 'push';
type DeliveryOutcome = 'immediate' | 'digest' | 'suppressed' | 'required';
type DeliveryAttemptStatus = 'accepted' | 'queued' | 'dropped';
type NotificationCampaignQueueStatus = 'queued' | 'scheduled';
type NotificationDigestFrequency = 'off' | 'hourly' | 'daily' | 'weekly';
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

export type NotificationDeliveryEventType =
    (typeof notificationDeliveryEvents.$inferSelect)['type'];

export type NotificationDeliveryRollup = {
    sent: number;
    accepted: number;
    failed: number;
    retried: number;
    invalidated: number;
    opened: number;
    dismissed: number;
    clicked: number;
    unsubscribed: number;
};

export type NotificationRetentionCleanupResult = {
    subscriptionsDisabled: number;
    deliveryEventsDeleted: number;
    deliveryAttemptsDeleted: number;
    campaignsDeleted: number;
};

export type NotificationRolloutBackfillResult = {
    dryRun: boolean;
    usersScanned: number;
    defaultPreferencesExpected: number;
    defaultPreferencesInserted: number;
    defaultPreferencesAlreadyPresent: number;
    subscriptionsMarkedGranted: number;
    deniedSubscriptionsDisabled: number;
    deviceLabelsBackfilled: number;
    orphanedSubscriptions: number;
};

export type NotificationRolloutDiagnostics = {
    userId: string;
    accountId: string | null;
    preferenceCount: number;
    missingDefaultPreferenceCount: number;
    deviceCount: number;
    deliverableDeviceCount: number;
    deniedDeviceCount: number;
    revokedDeviceCount: number;
    staleDeviceCount: number;
    lastSeenAt: Date | null;
};

export type CreateNotificationOptions = {
    routeDelivery?: boolean;
};

type NotificationRolloutPreferenceDefault = {
    category: string;
    channel: DeliveryChannel;
    defaultEnabled: boolean;
    digestEligible: boolean;
    required: boolean;
};

const notificationRolloutPreferenceDefaults: NotificationRolloutPreferenceDefault[] =
    [
        {
            category: 'account_security',
            channel: 'in_app',
            defaultEnabled: true,
            digestEligible: false,
            required: true,
        },
        {
            category: 'account_security',
            channel: 'email',
            defaultEnabled: true,
            digestEligible: false,
            required: true,
        },
        {
            category: 'account_security',
            channel: 'push',
            defaultEnabled: true,
            digestEligible: false,
            required: true,
        },
        {
            category: 'billing_order_delivery',
            channel: 'in_app',
            defaultEnabled: true,
            digestEligible: false,
            required: true,
        },
        {
            category: 'billing_order_delivery',
            channel: 'email',
            defaultEnabled: true,
            digestEligible: false,
            required: true,
        },
        {
            category: 'billing_order_delivery',
            channel: 'push',
            defaultEnabled: true,
            digestEligible: false,
            required: true,
        },
        {
            category: 'garden',
            channel: 'in_app',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
        },
        {
            category: 'garden',
            channel: 'email',
            defaultEnabled: true,
            digestEligible: true,
            required: false,
        },
        {
            category: 'garden',
            channel: 'push',
            defaultEnabled: true,
            digestEligible: true,
            required: false,
        },
        {
            category: 'reminders',
            channel: 'in_app',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
        },
        {
            category: 'reminders',
            channel: 'email',
            defaultEnabled: true,
            digestEligible: true,
            required: false,
        },
        {
            category: 'reminders',
            channel: 'push',
            defaultEnabled: false,
            digestEligible: true,
            required: false,
        },
        {
            category: 'admin_campaigns',
            channel: 'in_app',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
        },
        {
            category: 'admin_campaigns',
            channel: 'email',
            defaultEnabled: true,
            digestEligible: true,
            required: false,
        },
        {
            category: 'admin_campaigns',
            channel: 'push',
            defaultEnabled: false,
            digestEligible: true,
            required: false,
        },
        {
            category: 'promotional',
            channel: 'in_app',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
        },
        {
            category: 'promotional',
            channel: 'email',
            defaultEnabled: false,
            digestEligible: true,
            required: false,
        },
        {
            category: 'promotional',
            channel: 'push',
            defaultEnabled: false,
            digestEligible: true,
            required: false,
        },
        {
            category: 'digests',
            channel: 'in_app',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
        },
        {
            category: 'digests',
            channel: 'email',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
        },
        {
            category: 'digests',
            channel: 'push',
            defaultEnabled: false,
            digestEligible: false,
            required: false,
        },
    ];

type PushSubscriptionDeliveryFields = Pick<
    typeof webPushSubscriptions.$inferSelect,
    'enabled' | 'permissionState' | 'revokedAt'
>;

export function isDeliverablePushSubscription(
    subscription: PushSubscriptionDeliveryFields,
) {
    return (
        subscription.enabled &&
        subscription.permissionState === 'granted' &&
        !subscription.revokedAt
    );
}

export function deliverablePushSubscriptionWhere(scope?: {
    accountId?: string | null;
    userId?: string | null;
}) {
    return and(
        eq(webPushSubscriptions.enabled, true),
        eq(webPushSubscriptions.permissionState, 'granted'),
        isNull(webPushSubscriptions.revokedAt),
        scope?.accountId
            ? eq(webPushSubscriptions.accountId, scope.accountId)
            : undefined,
        scope?.userId
            ? eq(webPushSubscriptions.userId, scope.userId)
            : undefined,
    );
}

function notificationPreferenceKey(preference: {
    category: string;
    channel: DeliveryChannel;
}) {
    return `${preference.category}:${preference.channel}`;
}

function notificationRolloutPreferenceRows({
    dailyDigest,
    emailEnabled,
    userId,
}: {
    dailyDigest: boolean | null;
    emailEnabled: boolean | null;
    userId: string;
}): (typeof notificationUserChannelPreferences.$inferInsert)[] {
    return notificationRolloutPreferenceDefaults.map((preference) => {
        const enabled =
            preference.required ||
            (preference.channel === 'email' && emailEnabled === false
                ? false
                : preference.defaultEnabled);
        const digestFrequency: NotificationDigestFrequency =
            preference.channel === 'email' &&
            preference.digestEligible &&
            enabled &&
            dailyDigest === true
                ? 'daily'
                : 'off';

        return {
            userId,
            accountId: null,
            scope: 'global',
            category: preference.category,
            channel: preference.channel,
            enabled,
            required: preference.required,
            digestFrequency,
            quietHoursStartMinute: null,
            quietHoursEndMinute: null,
        };
    });
}

async function countWebPushSubscriptionsWhere(
    where: ReturnType<typeof and> | ReturnType<typeof or>,
) {
    const result = await storage()
        .select({ count: sql<number>`count(*)::int` })
        .from(webPushSubscriptions)
        .where(where);
    return Number(result[0]?.count ?? 0);
}

export async function backfillNotificationRolloutDefaults({
    dryRun = false,
    limit,
    now = new Date(),
}: {
    dryRun?: boolean;
    limit?: number;
    now?: Date;
} = {}): Promise<NotificationRolloutBackfillResult> {
    const userRowsQuery = storage()
        .select({
            userId: users.id,
            emailEnabled: userNotificationSettings.emailEnabled,
            dailyDigest: userNotificationSettings.dailyDigest,
        })
        .from(users)
        .leftJoin(
            userNotificationSettings,
            eq(users.id, userNotificationSettings.userId),
        );
    const userRows =
        typeof limit === 'number'
            ? await userRowsQuery.limit(Math.max(1, limit))
            : await userRowsQuery;

    let defaultPreferencesExpected = 0;
    let defaultPreferencesInserted = 0;
    let defaultPreferencesAlreadyPresent = 0;

    for (const user of userRows) {
        const rows = notificationRolloutPreferenceRows(user);
        defaultPreferencesExpected += rows.length;

        if (dryRun) {
            const existingPreferences = await storage()
                .select({
                    category: notificationUserChannelPreferences.category,
                    channel: notificationUserChannelPreferences.channel,
                })
                .from(notificationUserChannelPreferences)
                .where(
                    and(
                        eq(notificationUserChannelPreferences.userId, user.userId),
                        eq(notificationUserChannelPreferences.scope, 'global'),
                        inArray(
                            notificationUserChannelPreferences.category,
                            notificationRolloutPreferenceDefaults.map(
                                (preference) => preference.category,
                            ),
                        ),
                    ),
                );
            const existingKeys = new Set(
                existingPreferences.map((preference) =>
                    notificationPreferenceKey({
                        category: preference.category,
                        channel: preference.channel as DeliveryChannel,
                    }),
                ),
            );
            const missingCount = rows.filter(
                (row) =>
                    !existingKeys.has(
                        notificationPreferenceKey({
                            category: row.category,
                            channel: row.channel as DeliveryChannel,
                        }),
                    ),
            ).length;
            defaultPreferencesInserted += missingCount;
            defaultPreferencesAlreadyPresent += rows.length - missingCount;
            continue;
        }

        const insertedPreferences = await storage()
            .insert(notificationUserChannelPreferences)
            .values(rows)
            .onConflictDoNothing()
            .returning({ id: notificationUserChannelPreferences.id });
        defaultPreferencesInserted += insertedPreferences.length;
        defaultPreferencesAlreadyPresent +=
            rows.length - insertedPreferences.length;
    }

    const grantableSubscriptionWhere = and(
        eq(webPushSubscriptions.enabled, true),
        eq(webPushSubscriptions.permissionState, 'default'),
        isNull(webPushSubscriptions.revokedAt),
        sql`${webPushSubscriptions.userId} is not null`,
        sql`${webPushSubscriptions.accountId} is not null`,
        sql`${webPushSubscriptions.endpoint} <> ''`,
        sql`${webPushSubscriptions.p256dh} <> ''`,
        sql`${webPushSubscriptions.auth} <> ''`,
    );
    const deniedSubscriptionWhere = and(
        eq(webPushSubscriptions.enabled, true),
        eq(webPushSubscriptions.permissionState, 'denied'),
        isNull(webPushSubscriptions.revokedAt),
    );
    const labelableSubscriptionWhere = and(
        isNull(webPushSubscriptions.deviceLabel),
        isNull(webPushSubscriptions.revokedAt),
        sql`${webPushSubscriptions.userId} is not null`,
        sql`${webPushSubscriptions.accountId} is not null`,
    );
    const orphanedSubscriptionWhere = or(
        isNull(webPushSubscriptions.userId),
        isNull(webPushSubscriptions.accountId),
    );

    const [
        grantableSubscriptions,
        deniedSubscriptions,
        labelableSubscriptions,
        orphanedSubscriptions,
    ] = await Promise.all([
        countWebPushSubscriptionsWhere(grantableSubscriptionWhere),
        countWebPushSubscriptionsWhere(deniedSubscriptionWhere),
        countWebPushSubscriptionsWhere(labelableSubscriptionWhere),
        countWebPushSubscriptionsWhere(orphanedSubscriptionWhere),
    ]);

    if (dryRun) {
        return {
            dryRun,
            usersScanned: userRows.length,
            defaultPreferencesExpected,
            defaultPreferencesInserted,
            defaultPreferencesAlreadyPresent,
            subscriptionsMarkedGranted: grantableSubscriptions,
            deniedSubscriptionsDisabled: deniedSubscriptions,
            deviceLabelsBackfilled: labelableSubscriptions,
            orphanedSubscriptions,
        };
    }

    const markedGranted = await storage()
        .update(webPushSubscriptions)
        .set({
            permissionState: 'granted',
            updatedAt: now,
        })
        .where(grantableSubscriptionWhere)
        .returning({ id: webPushSubscriptions.id });
    const disabledDeniedSubscriptions = await storage()
        .update(webPushSubscriptions)
        .set({
            enabled: false,
            revokedAt: now,
            revokedReason: 'permission_denied_rollout_backfill',
            updatedAt: now,
        })
        .where(deniedSubscriptionWhere)
        .returning({ id: webPushSubscriptions.id });
    const backfilledDeviceLabels = await storage()
        .update(webPushSubscriptions)
        .set({
            deviceLabel: 'Web preglednik',
            updatedAt: now,
        })
        .where(labelableSubscriptionWhere)
        .returning({ id: webPushSubscriptions.id });

    return {
        dryRun,
        usersScanned: userRows.length,
        defaultPreferencesExpected,
        defaultPreferencesInserted,
        defaultPreferencesAlreadyPresent,
        subscriptionsMarkedGranted: markedGranted.length,
        deniedSubscriptionsDisabled: disabledDeniedSubscriptions.length,
        deviceLabelsBackfilled: backfilledDeviceLabels.length,
        orphanedSubscriptions,
    };
}

export async function getNotificationRolloutDiagnostics({
    accountId,
    staleAfterDays = 90,
    userId,
}: {
    accountId?: string | null;
    staleAfterDays?: number;
    userId: string;
}): Promise<NotificationRolloutDiagnostics> {
    const [legacySettings, preferences, devices] = await Promise.all([
        storage().query.userNotificationSettings.findFirst({
            where: eq(userNotificationSettings.userId, userId),
        }),
        storage().query.notificationUserChannelPreferences.findMany({
            where: eq(notificationUserChannelPreferences.userId, userId),
        }),
        storage().query.webPushSubscriptions.findMany({
            where: and(
                eq(webPushSubscriptions.userId, userId),
                accountId
                    ? eq(webPushSubscriptions.accountId, accountId)
                    : undefined,
            ),
        }),
    ]);
    const expectedPreferences = notificationRolloutPreferenceRows({
        userId,
        emailEnabled: legacySettings?.emailEnabled ?? null,
        dailyDigest: legacySettings?.dailyDigest ?? null,
    });
    const existingPreferenceKeys = new Set(
        preferences
            .filter((preference) => preference.scope === 'global')
            .map((preference) =>
                notificationPreferenceKey({
                    category: preference.category,
                    channel: preference.channel as DeliveryChannel,
                }),
            ),
    );
    const staleCutoff = new Date(
        Date.now() - staleAfterDays * 24 * 60 * 60 * 1000,
    );
    const lastSeenAt = devices.reduce<Date | null>((latest, device) => {
        if (!latest || device.lastSeenAt > latest) return device.lastSeenAt;
        return latest;
    }, null);

    return {
        userId,
        accountId: accountId ?? null,
        preferenceCount: preferences.length,
        missingDefaultPreferenceCount: expectedPreferences.filter(
            (preference) =>
                !existingPreferenceKeys.has(
                    notificationPreferenceKey({
                        category: preference.category,
                        channel: preference.channel as DeliveryChannel,
                    }),
                ),
        ).length,
        deviceCount: devices.length,
        deliverableDeviceCount: devices.filter(isDeliverablePushSubscription)
            .length,
        deniedDeviceCount: devices.filter(
            (device) => device.permissionState === 'denied' && !device.revokedAt,
        ).length,
        revokedDeviceCount: devices.filter((device) => Boolean(device.revokedAt))
            .length,
        staleDeviceCount: devices.filter(
            (device) => !device.revokedAt && device.lastSeenAt < staleCutoff,
        ).length,
        lastSeenAt,
    };
}

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

function shouldQueuePushDelivery(decisions: NotificationDeliveryDecision[]) {
    return decisions.some(
        (decision) =>
            decision.channel === 'push' &&
            (decision.outcome === 'immediate' ||
                decision.outcome === 'required'),
    );
}

export async function createNotification(
    notification: InsertNotification,
    options: CreateNotificationOptions = {},
) {
    const result = await storage()
        .insert(notifications)
        .values({
            id: randomUUID(),
            ...notification,
        })
        .returning({ id: notifications.id });
    const notificationId = result[0].id;

    if (options.routeDelivery !== false) {
        const decisions = await routeNotificationDelivery(notificationId);
        if (shouldQueuePushDelivery(decisions)) {
            await enqueuePushDeliveryAttemptsForNotification({
                notificationId,
            });
        }
    }

    return notificationId;
}

export async function enqueuePushDeliveryAttemptsForNotification({
    notificationId,
    batchSize = 100,
}: {
    notificationId: string;
    batchSize?: number;
}) {
    const notification = await getNotification(notificationId);
    if (!notification?.userId) return { queued: 0, skipped: 0 };

    const subscriptions = await storage().query.webPushSubscriptions.findMany({
        where: deliverablePushSubscriptionWhere({
            accountId: notification.accountId,
            userId: notification.userId,
        }),
        limit: Math.max(1, batchSize),
    });

    if (!subscriptions.length) return { queued: 0, skipped: 0 };

    const existing = await storage()
        .select({
            pushSubscriptionId: notificationDeliveryAttempts.pushSubscriptionId,
        })
        .from(notificationDeliveryAttempts)
        .where(
            and(
                eq(notificationDeliveryAttempts.notificationId, notificationId),
                inArray(
                    notificationDeliveryAttempts.pushSubscriptionId,
                    subscriptions.map((subscription) => subscription.id),
                ),
            ),
        );
    const existingIds = new Set(
        existing
            .map((row) => row.pushSubscriptionId)
            .filter((id): id is string => Boolean(id)),
    );

    const pending = subscriptions.filter(
        (subscription) => !existingIds.has(subscription.id),
    );

    if (!pending.length) {
        return { queued: 0, skipped: subscriptions.length };
    }

    const deliveryAttempts: (typeof notificationDeliveryAttempts.$inferInsert)[] =
        pending.map((subscription) => ({
            notificationId,
            userId: notification.userId,
            accountId: notification.accountId,
            channel: 'push',
            status: 'queued',
            provider: 'web_push_queue',
            pushSubscriptionId: subscription.id,
            providerResponseCode: 'queued_background',
        }));

    await storage()
        .insert(notificationDeliveryAttempts)
        .values(deliveryAttempts);

    return {
        queued: pending.length,
        skipped: subscriptions.length - pending.length,
    };
}
export async function routeNotificationDelivery(notificationId: string) {
    const notification = await getNotification(notificationId);
    if (!notification) return [];
    const now = new Date();
    const targetChannels: DeliveryChannel[] = ['in_app', 'email', 'push'];
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
                  deliverablePushSubscriptionWhere({
                      accountId: notification.accountId,
                      userId: notification.userId,
                  }),
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
        const existingRouterAttempts = await storage()
            .select({ channel: notificationDeliveryAttempts.channel })
            .from(notificationDeliveryAttempts)
            .where(
                and(
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        notificationId,
                    ),
                    eq(notificationDeliveryAttempts.provider, 'router'),
                ),
            );
        const routedChannels = new Set(
            existingRouterAttempts.map((attempt) => attempt.channel),
        );
        const unroutedDecisions = decisions.filter(
            (decision) => !routedChannels.has(decision.channel),
        );

        if (unroutedDecisions.length > 0) {
            await storage()
                .insert(notificationDeliveryAttempts)
                .values(
                    unroutedDecisions.map((decision) => ({
                        notificationId,
                        userId: notification.userId ?? null,
                        accountId: notification.accountId,
                        channel: decision.channel,
                        status: deliveryAttemptStatusForOutcome(
                            decision.outcome,
                        ),
                        provider: 'router',
                        providerResponseCode: decision.reason,
                    })),
                );
        }
    }

    return decisions;
}

export async function recordNotificationDeliveryEvent({
    notificationId,
    deliveryAttemptId,
    type,
    metadata,
    occurredAt,
}: {
    notificationId: string;
    deliveryAttemptId: number;
    type: NotificationDeliveryEventType;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
}) {
    const attempt = await storage()
        .select({
            notificationId: notificationDeliveryAttempts.notificationId,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.id, deliveryAttemptId))
        .limit(1);

    if (!attempt[0]) {
        throw new Error('Delivery attempt not found.');
    }

    if (attempt[0].notificationId !== notificationId) {
        throw new Error(
            'Delivery attempt does not belong to the provided notification.',
        );
    }

    const result = await storage()
        .insert(notificationDeliveryEvents)
        .values({
            notificationId,
            deliveryAttemptId,
            type,
            metadata: metadata ?? {},
            occurredAt: occurredAt ?? new Date(),
        })
        .returning();
    return result[0];
}

export async function getNotificationDeliverySummary(
    notificationId: string,
): Promise<NotificationDeliveryRollup> {
    const attempts = await storage()
        .select({
            id: notificationDeliveryAttempts.id,
            status: notificationDeliveryAttempts.status,
            pushSubscriptionId: notificationDeliveryAttempts.pushSubscriptionId,
        })
        .from(notificationDeliveryAttempts)
        .where(
            and(
                eq(notificationDeliveryAttempts.notificationId, notificationId),
                eq(notificationDeliveryAttempts.channel, 'push'),
            ),
        );

    const events = await storage()
        .select({
            type: notificationDeliveryEvents.type,
            deliveryAttemptId: notificationDeliveryEvents.deliveryAttemptId,
        })
        .from(notificationDeliveryEvents)
        .where(eq(notificationDeliveryEvents.notificationId, notificationId));

    const attemptsBySubscription = new Map<string, number>();
    for (const attempt of attempts) {
        if (!attempt.pushSubscriptionId) continue;
        attemptsBySubscription.set(
            attempt.pushSubscriptionId,
            (attemptsBySubscription.get(attempt.pushSubscriptionId) ?? 0) + 1,
        );
    }

    const retried = Array.from(attemptsBySubscription.values()).filter(
        (count) => count > 1,
    ).length;

    const rollup: NotificationDeliveryRollup = {
        sent: attempts.filter((attempt) => attempt.status === 'sent').length,
        accepted: attempts.filter((attempt) => attempt.status === 'accepted')
            .length,
        failed: attempts.filter((attempt) => attempt.status === 'failed')
            .length,
        retried,
        invalidated: 0,
        opened: 0,
        dismissed: 0,
        clicked: 0,
        unsubscribed: 0,
    };

    for (const event of events) {
        if (event.type === 'opened') rollup.opened += 1;
        if (event.type === 'dismissed') rollup.dismissed += 1;
        if (event.type === 'clicked') rollup.clicked += 1;
        if (event.type === 'failed') rollup.invalidated += 1;
        if (event.type === 'unsubscribed') rollup.unsubscribed += 1;
    }

    return rollup;
}

export async function cleanupNotificationRetention({
    disableFailCountAtOrAbove = 10,
    disableInactiveSubscriptionDays = 90,
    deleteDeliveryEventsOlderThanDays = 180,
    deleteDeliveryAttemptsOlderThanDays = 180,
    deleteTerminalCampaignsOlderThanDays = 365,
}: {
    disableFailCountAtOrAbove?: number;
    disableInactiveSubscriptionDays?: number;
    deleteDeliveryEventsOlderThanDays?: number;
    deleteDeliveryAttemptsOlderThanDays?: number;
    deleteTerminalCampaignsOlderThanDays?: number;
} = {}): Promise<NotificationRetentionCleanupResult> {
    const now = Date.now();
    const staleSubscriptionCutoff = new Date(
        now - disableInactiveSubscriptionDays * 24 * 60 * 60 * 1000,
    );
    const deliveryEventCutoff = new Date(
        now - deleteDeliveryEventsOlderThanDays * 24 * 60 * 60 * 1000,
    );
    const deliveryAttemptCutoff = new Date(
        now - deleteDeliveryAttemptsOlderThanDays * 24 * 60 * 60 * 1000,
    );
    const campaignCutoff = new Date(
        now - deleteTerminalCampaignsOlderThanDays * 24 * 60 * 60 * 1000,
    );

    const disabledSubscriptions = await storage()
        .update(webPushSubscriptions)
        .set({
            enabled: false,
            revokedAt: new Date(),
            revokedReason: 'retention_cleanup',
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(webPushSubscriptions.enabled, true),
                isNull(webPushSubscriptions.revokedAt),
                or(
                    eq(webPushSubscriptions.permissionState, 'denied'),
                    and(
                        eq(webPushSubscriptions.permissionState, 'default'),
                        eq(webPushSubscriptions.failCount, 0),
                    ),
                    sql`${webPushSubscriptions.failCount} >= ${disableFailCountAtOrAbove}`,
                    sql`${webPushSubscriptions.lastSeenAt} < ${staleSubscriptionCutoff}`,
                ),
            ),
        )
        .returning({ id: webPushSubscriptions.id });

    const deletedEvents = await storage()
        .delete(notificationDeliveryEvents)
        .where(
            sql`${notificationDeliveryEvents.occurredAt} < ${deliveryEventCutoff}`,
        )
        .returning({ id: notificationDeliveryEvents.id });

    const deletedAttempts = await storage()
        .delete(notificationDeliveryAttempts)
        .where(
            and(
                sql`${notificationDeliveryAttempts.createdAt} < ${deliveryAttemptCutoff}`,
                sql`not exists (
                    select 1
                    from ${notificationDeliveryEvents}
                    where ${notificationDeliveryEvents.deliveryAttemptId} = ${notificationDeliveryAttempts.id}
                      and ${notificationDeliveryEvents.occurredAt} >= ${deliveryEventCutoff}
                )`,
            ),
        )
        .returning({ id: notificationDeliveryAttempts.id });

    const deletedCampaigns = await storage()
        .delete(notificationCampaigns)
        .where(
            and(
                inArray(notificationCampaigns.status, [
                    'sent',
                    'cancelled',
                    'failed',
                ]),
                sql`${notificationCampaigns.updatedAt} < ${campaignCutoff}`,
            ),
        )
        .returning({ id: notificationCampaigns.id });

    return {
        subscriptionsDisabled: disabledSubscriptions.length,
        deliveryEventsDeleted: deletedEvents.length,
        deliveryAttemptsDeleted: deletedAttempts.length,
        campaignsDeleted: deletedCampaigns.length,
    };
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
