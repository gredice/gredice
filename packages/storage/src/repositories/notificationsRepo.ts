import { createHash, randomUUID } from 'node:crypto';
import {
    and,
    asc,
    desc,
    eq,
    exists,
    gt,
    inArray,
    isNotNull,
    isNull,
    lte,
    ne,
    notExists,
    or,
    type SQL,
    sql,
} from 'drizzle-orm';
import { storage } from '..';
import {
    customerDeliveryNotificationRecipientRoles,
    deliveryLifecycleNotificationCategory,
    deliveryLifecycleNotificationMaximumAgeSeconds,
    deliveryLifecycleNotificationType,
    isCustomerDeliveryLifecycleNotification,
} from '../deliveryNotificationPolicy';
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
type DeliveryOutcome =
    | 'immediate'
    | 'deferred'
    | 'digest'
    | 'suppressed'
    | 'required';
type DeliveryAttemptStatus = 'accepted' | 'queued' | 'dropped';
type NotificationCampaignQueueStatus = 'queued' | 'scheduled';
type NotificationDigestFrequency = 'off' | 'hourly' | 'daily' | 'weekly';
type NotificationCampaignExplicitRecipient = Extract<
    NotificationCampaignAudience,
    { type: 'explicit' }
>['recipients'][number];
type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type NotificationDatabaseClient = StorageClient | TransactionClient;

// Croatian fallback label for legacy web-push subscriptions without client device metadata.
export const notificationRolloutDefaultDeviceLabel = 'Web preglednik';
export const maxNotificationReadBatchSize = 200;

export type NotificationDeliveryDecision = {
    accountId: string;
    channel: DeliveryChannel;
    outcome: DeliveryOutcome;
    reason: string;
    required: boolean;
    userId: string | null;
};

type NotificationDeliveryOutcomeDecision = Omit<
    NotificationDeliveryDecision,
    'accountId' | 'userId'
>;

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

export type DeferredWebPushPromotionResult = {
    deferred: number;
    dropped: number;
    queued: number;
    scanned: number;
};

export type QueuedWebPushDeliveryRevalidation = {
    reason: string;
    status: 'deferred' | 'dropped' | 'eligible' | 'unavailable';
};

export const webPushDeliveryClaimLeaseMs = 60 * 60 * 1000;
export const webPushDeliveryClaimProviderCode = 'web_push_sending';

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
    idempotencyKey?: string;
    now?: Date;
    routeDelivery?: boolean;
};

export type CreateNotificationResult = {
    notificationId: string;
    outcome: 'created' | 'reused';
};

export const deliveryLifecycleEmailProvider = 'delivery_lifecycle_email';

const defaultDeliveryLifecycleEmailMaxAttempts = 3;
const defaultDeliveryLifecycleEmailClaimLeaseMs = 5 * 60 * 1000;
const maximumDeliveryLifecycleEmailClaimLeaseMs = 60 * 60 * 1000;
const maximumDeliveryLifecycleEmailRecipientLength = 254;
const deliveryLifecycleEmailExpiredClaimCode = 'claim_expired_before_send';

export type DeliveryLifecycleEmailCandidate = {
    notificationId: string;
    userId: string;
};

export type DeliveryLifecycleEmailClaim = DeliveryLifecycleEmailCandidate & {
    accountId: string;
    attemptId: number;
    email: string;
    metadata: Record<string, unknown>;
};

export type DeliveryLifecycleEmailClaimResult =
    | {
          claim: DeliveryLifecycleEmailClaim;
          status: 'claimed';
      }
    | {
          reason:
              | 'already_claimed'
              | 'attempts_exhausted'
              | 'invalid_recipient'
              | 'not_recipient'
              | 'not_target_notification'
              | 'notification_expired'
              | 'notification_missing';
          status: 'unavailable';
      }
    | {
          reason: string;
          status: 'deferred';
      }
    | {
          reason: string;
          status: 'skipped';
      };

export type DeliveryLifecycleEmailStartResult =
    | {
          email: string;
          status: 'started';
      }
    | {
          reason: string;
          status: 'deferred' | 'skipped' | 'unavailable';
      };

async function acquireNotificationDeliveryLock(
    db: TransactionClient,
    notificationId: string,
) {
    await db.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`notification-delivery:${notificationId}`}));`,
    );
}

type NotificationRolloutPreferenceDefault = {
    category: string;
    channel: DeliveryChannel;
    defaultEnabled: boolean;
    digestEligible: boolean;
    required: boolean;
};

type NotificationQuietHoursWindow = {
    endMinute: number;
    startMinute: number;
    timezone: string;
};

type NotificationDeliveryRecipient = {
    accountId: string;
    userId: string | null;
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
            category: 'delivery_updates',
            channel: 'in_app',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
        },
        {
            category: 'delivery_updates',
            channel: 'email',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
        },
        {
            category: 'delivery_updates',
            channel: 'push',
            defaultEnabled: true,
            digestEligible: false,
            required: false,
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
            category: 'weather_alerts',
            channel: 'in_app',
            defaultEnabled: false,
            digestEligible: false,
            required: false,
        },
        {
            category: 'weather_alerts',
            channel: 'email',
            defaultEnabled: false,
            digestEligible: false,
            required: false,
        },
        {
            category: 'weather_alerts',
            channel: 'push',
            defaultEnabled: false,
            digestEligible: false,
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

function notificationPreferenceDefault(
    category: string,
    channel: DeliveryChannel,
) {
    return notificationRolloutPreferenceDefaults.find(
        (preference) =>
            preference.category === category && preference.channel === channel,
    );
}

function notificationRolloutPreferenceRows({
    dailyDigest,
    deliveryUpdatesQuietHours,
    emailEnabled,
    userId,
}: {
    dailyDigest: boolean | null;
    deliveryUpdatesQuietHours?: NotificationQuietHoursWindow;
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
        const quietHours =
            preference.category === 'delivery_updates'
                ? deliveryUpdatesQuietHours
                : undefined;

        return {
            userId,
            accountId: null,
            scope: 'global',
            category: preference.category,
            channel: preference.channel,
            enabled,
            required: preference.required,
            digestFrequency,
            quietHoursStartMinute: quietHours?.startMinute ?? null,
            quietHoursEndMinute: quietHours?.endMinute ?? null,
            timezone: quietHours?.timezone ?? null,
        };
    });
}

function inheritedGlobalQuietHours(
    preferences: Array<
        Pick<
            SelectNotificationUserChannelPreference,
            | 'quietHoursEndMinute'
            | 'quietHoursStartMinute'
            | 'required'
            | 'timezone'
        >
    >,
): NotificationQuietHoursWindow | undefined {
    for (const preference of preferences) {
        const timezone = preference.timezone?.trim();
        if (
            preference.required ||
            preference.quietHoursStartMinute === null ||
            preference.quietHoursEndMinute === null ||
            !timezone
        ) {
            continue;
        }

        return {
            startMinute: preference.quietHoursStartMinute,
            endMinute: preference.quietHoursEndMinute,
            timezone,
        };
    }

    return undefined;
}

async function countWebPushSubscriptionsWhere(where: SQL | undefined) {
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
        )
        .orderBy(asc(users.createdAt), asc(users.id));
    const userRows =
        typeof limit === 'number'
            ? await userRowsQuery.limit(Math.max(1, limit))
            : await userRowsQuery;
    const limitedUserIds =
        typeof limit === 'number'
            ? userRows.map((user) => user.userId)
            : undefined;
    const scopeSubscriptionWhere = (where: SQL | undefined) => {
        if (!limitedUserIds) {
            return where;
        }
        if (limitedUserIds.length === 0) {
            return sql`false`;
        }
        return and(where, inArray(webPushSubscriptions.userId, limitedUserIds));
    };

    let defaultPreferencesExpected = 0;
    let defaultPreferencesInserted = 0;
    let defaultPreferencesAlreadyPresent = 0;

    for (const user of userRows) {
        const existingPreferences = await storage()
            .select({
                category: notificationUserChannelPreferences.category,
                channel: notificationUserChannelPreferences.channel,
                quietHoursEndMinute:
                    notificationUserChannelPreferences.quietHoursEndMinute,
                quietHoursStartMinute:
                    notificationUserChannelPreferences.quietHoursStartMinute,
                required: notificationUserChannelPreferences.required,
                timezone: notificationUserChannelPreferences.timezone,
            })
            .from(notificationUserChannelPreferences)
            .where(
                and(
                    eq(notificationUserChannelPreferences.userId, user.userId),
                    eq(notificationUserChannelPreferences.scope, 'global'),
                ),
            )
            .orderBy(
                desc(notificationUserChannelPreferences.updatedAt),
                desc(notificationUserChannelPreferences.id),
            );
        const rows = notificationRolloutPreferenceRows({
            ...user,
            deliveryUpdatesQuietHours:
                inheritedGlobalQuietHours(existingPreferences),
        });
        defaultPreferencesExpected += rows.length;

        if (dryRun) {
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
        countWebPushSubscriptionsWhere(
            scopeSubscriptionWhere(grantableSubscriptionWhere),
        ),
        countWebPushSubscriptionsWhere(
            scopeSubscriptionWhere(deniedSubscriptionWhere),
        ),
        countWebPushSubscriptionsWhere(
            scopeSubscriptionWhere(labelableSubscriptionWhere),
        ),
        countWebPushSubscriptionsWhere(
            scopeSubscriptionWhere(orphanedSubscriptionWhere),
        ),
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
        .where(scopeSubscriptionWhere(grantableSubscriptionWhere))
        .returning({ id: webPushSubscriptions.id });
    const disabledDeniedSubscriptions = await storage()
        .update(webPushSubscriptions)
        .set({
            enabled: false,
            revokedAt: now,
            revokedReason: 'permission_denied_rollout_backfill',
            updatedAt: now,
        })
        .where(scopeSubscriptionWhere(deniedSubscriptionWhere))
        .returning({ id: webPushSubscriptions.id });
    const backfilledDeviceLabels = await storage()
        .update(webPushSubscriptions)
        .set({
            deviceLabel: notificationRolloutDefaultDeviceLabel,
            updatedAt: now,
        })
        .where(scopeSubscriptionWhere(labelableSubscriptionWhere))
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
            (device) =>
                device.permissionState === 'denied' && !device.revokedAt,
        ).length,
        revokedDeviceCount: devices.filter((device) =>
            Boolean(device.revokedAt),
        ).length,
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
    defaultPreference,
    preference,
    hasPushSubscription,
    now,
}: {
    channel: DeliveryChannel;
    defaultPreference?: NotificationRolloutPreferenceDefault;
    preference?: SelectNotificationUserChannelPreference;
    hasPushSubscription: boolean;
    now: Date;
}): NotificationDeliveryOutcomeDecision {
    const required =
        preference?.required ?? defaultPreference?.required ?? false;
    if (channel === 'push' && !hasPushSubscription) {
        return {
            channel,
            outcome: required ? 'required' : 'suppressed',
            reason: 'missing_push_subscription',
            required,
        };
    }
    if (
        (preference?.enabled ?? defaultPreference?.defaultEnabled ?? true) ===
        false
    ) {
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
            outcome: 'deferred',
            reason: 'quiet_hours',
            required: false,
        };
    }
    if (
        !required &&
        (defaultPreference?.digestEligible ?? true) &&
        (preference?.digestFrequency ?? 'off') !== 'off'
    ) {
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
    if (outcome === 'deferred' || outcome === 'digest') return 'queued';
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

async function getNotificationWithDatabase(
    db: NotificationDatabaseClient,
    id: string,
): Promise<SelectNotification | undefined> {
    const result = await db.query.notifications.findFirst({
        where: eq(notifications.id, id),
    });
    return result;
}

export async function getNotification(
    id: string,
): Promise<SelectNotification | undefined> {
    return await getNotificationWithDatabase(storage(), id);
}

function shouldQueuePushDelivery(decisions: NotificationDeliveryDecision[]) {
    return decisions.some(
        (decision) =>
            decision.channel === 'push' &&
            (decision.outcome === 'immediate' ||
                decision.outcome === 'required'),
    );
}

function queueablePushDeliveryUserIds(
    decisions: NotificationDeliveryDecision[],
) {
    if (!shouldQueuePushDelivery(decisions)) return [];
    return uniqueStrings(
        decisions.flatMap((decision) =>
            decision.channel === 'push' &&
            decision.userId &&
            (decision.outcome === 'immediate' ||
                decision.outcome === 'required')
                ? [decision.userId]
                : [],
        ),
    );
}

async function createNotificationWithDatabase(
    db: NotificationDatabaseClient,
    notification: InsertNotification,
    options: CreateNotificationOptions,
    notificationId: string,
) {
    const result = await db
        .insert(notifications)
        .values({
            id: notificationId,
            ...notification,
        })
        .onConflictDoNothing({ target: notifications.id })
        .returning({ id: notifications.id });
    const insertedId = result[0]?.id;

    if (!insertedId) {
        const existing = await getNotificationWithDatabase(db, notificationId);
        if (
            !existing ||
            existing.accountId !== notification.accountId ||
            existing.userId !== (notification.userId ?? null) ||
            existing.category !== (notification.category ?? 'general') ||
            existing.type !== (notification.type ?? 'general')
        ) {
            throw new Error(
                'Notification idempotency key was reused for a different target.',
            );
        }

        return {
            notificationId,
            outcome: 'reused' as const,
        };
    }

    if (options.routeDelivery !== false) {
        const decisions = await routeNotificationDeliveryWithDatabase(
            db,
            notificationId,
            { now: options.now },
        );
        const pushUserIds = queueablePushDeliveryUserIds(decisions);
        if (pushUserIds.length > 0) {
            await enqueuePushDeliveryAttemptsWithDatabase(db, {
                notificationId,
                userIds: pushUserIds,
            });
        }
    }

    return {
        notificationId,
        outcome: 'created' as const,
    };
}

export async function createNotificationWithOutcome(
    notification: InsertNotification,
    options: CreateNotificationOptions = {},
): Promise<CreateNotificationResult> {
    const normalizedIdempotencyKey = options.idempotencyKey?.trim();
    if (options.idempotencyKey !== undefined && !normalizedIdempotencyKey) {
        throw new Error('Notification idempotency key must not be empty.');
    }
    const notificationId = normalizedIdempotencyKey
        ? `notification:${createHash('sha256')
              .update(normalizedIdempotencyKey)
              .digest('hex')}`
        : randomUUID();

    if (!normalizedIdempotencyKey) {
        return await createNotificationWithDatabase(
            storage(),
            notification,
            options,
            notificationId,
        );
    }

    return await storage().transaction(async (tx) => {
        await acquireNotificationDeliveryLock(tx, notificationId);
        return await createNotificationWithDatabase(
            tx,
            notification,
            options,
            notificationId,
        );
    });
}

export async function createNotification(
    notification: InsertNotification,
    options: CreateNotificationOptions = {},
) {
    const result = await createNotificationWithOutcome(notification, options);
    return result.notificationId;
}

async function enqueuePushDeliveryAttemptsWithDatabase(
    db: NotificationDatabaseClient,
    {
        notificationId,
        batchSize = 100,
        userIds,
    }: {
        notificationId: string;
        batchSize?: number;
        userIds?: string[];
    },
) {
    const notification = await getNotificationWithDatabase(db, notificationId);
    if (!notification) return { queued: 0, skipped: 0 };
    const targetUserIds = userIds
        ? uniqueStrings(userIds)
        : uniqueStrings(
              (
                  await getNotificationDeliveryRecipients(db, notification)
              ).flatMap((recipient) =>
                  recipient.userId ? [recipient.userId] : [],
              ),
          );
    if (targetUserIds.length === 0) return { queued: 0, skipped: 0 };

    const subscriptions = await db.query.webPushSubscriptions.findMany({
        where: and(
            eq(webPushSubscriptions.enabled, true),
            eq(webPushSubscriptions.permissionState, 'granted'),
            isNull(webPushSubscriptions.revokedAt),
            eq(webPushSubscriptions.accountId, notification.accountId),
            inArray(webPushSubscriptions.userId, targetUserIds),
        ),
        limit: Math.max(1, batchSize),
    });

    if (!subscriptions.length) return { queued: 0, skipped: 0 };

    const existing = await db
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

    const pending = subscriptions
        .filter((subscription) => !existingIds.has(subscription.id))
        .filter(hasPushSubscriptionUserId);

    if (!pending.length) {
        return { queued: 0, skipped: subscriptions.length };
    }

    const deliveryAttempts: (typeof notificationDeliveryAttempts.$inferInsert)[] =
        pending.map((subscription) => ({
            notificationId,
            userId: subscription.userId,
            accountId: notification.accountId,
            channel: 'push',
            status: 'queued',
            provider: 'web_push_queue',
            pushSubscriptionId: subscription.id,
            providerResponseCode: 'queued_background',
        }));

    await db.insert(notificationDeliveryAttempts).values(deliveryAttempts);

    return {
        queued: pending.length,
        skipped: subscriptions.length - pending.length,
    };
}

export async function enqueuePushDeliveryAttemptsForNotification(args: {
    notificationId: string;
    batchSize?: number;
    userIds?: string[];
}) {
    return await storage().transaction(async (tx) => {
        await acquireNotificationDeliveryLock(tx, args.notificationId);
        return await enqueuePushDeliveryAttemptsWithDatabase(tx, args);
    });
}

function hasPushSubscriptionUserId(
    subscription: typeof webPushSubscriptions.$inferSelect,
): subscription is typeof webPushSubscriptions.$inferSelect & {
    userId: string;
} {
    return typeof subscription.userId === 'string';
}

async function getNotificationDeliveryRecipients(
    db: NotificationDatabaseClient,
    notification: Pick<
        SelectNotification,
        'accountId' | 'category' | 'type' | 'userId'
    >,
): Promise<NotificationDeliveryRecipient[]> {
    const customerLifecycle =
        isCustomerDeliveryLifecycleNotification(notification);
    if (notification.userId) {
        const membership = await db
            .select({ id: accountUsers.id })
            .from(accountUsers)
            .innerJoin(users, eq(users.id, accountUsers.userId))
            .where(
                and(
                    eq(accountUsers.accountId, notification.accountId),
                    eq(accountUsers.userId, notification.userId),
                    customerLifecycle
                        ? inArray(users.role, [
                              ...customerDeliveryNotificationRecipientRoles,
                          ])
                        : undefined,
                ),
            )
            .limit(1);
        if (!membership[0]) return [];
        return [
            {
                accountId: notification.accountId,
                userId: notification.userId,
            },
        ];
    }

    const rows = await db
        .select({ userId: accountUsers.userId })
        .from(accountUsers)
        .innerJoin(users, eq(users.id, accountUsers.userId))
        .where(
            and(
                eq(accountUsers.accountId, notification.accountId),
                customerLifecycle
                    ? inArray(users.role, [
                          ...customerDeliveryNotificationRecipientRoles,
                      ])
                    : undefined,
            ),
        );

    if (rows.length === 0) {
        if (customerLifecycle) return [];
        return [
            {
                accountId: notification.accountId,
                userId: null,
            },
        ];
    }

    return rows.map((row) => ({
        accountId: notification.accountId,
        userId: row.userId,
    }));
}

function notificationDeliveryRoutingKey(decision: {
    channel: string;
    userId: string | null;
}) {
    return `${decision.userId ?? 'account'}:${decision.channel}`;
}

async function routeNotificationDeliveryWithDatabase(
    db: NotificationDatabaseClient,
    notificationId: string,
    { now = new Date() }: { now?: Date } = {},
) {
    const notification = await getNotificationWithDatabase(db, notificationId);
    if (!notification) return [];
    const targetChannels: DeliveryChannel[] = ['in_app', 'email', 'push'];
    const recipients = await getNotificationDeliveryRecipients(
        db,
        notification,
    );
    const recipientUserIds = uniqueStrings(
        recipients.flatMap((recipient) =>
            recipient.userId ? [recipient.userId] : [],
        ),
    );
    const preferences =
        recipientUserIds.length > 0
            ? await db.query.notificationUserChannelPreferences.findMany({
                  where: inArray(
                      notificationUserChannelPreferences.userId,
                      recipientUserIds,
                  ),
              })
            : [];
    const pushSubscriptionRows =
        recipientUserIds.length > 0
            ? await db
                  .select({ userId: webPushSubscriptions.userId })
                  .from(webPushSubscriptions)
                  .where(
                      and(
                          eq(webPushSubscriptions.enabled, true),
                          eq(webPushSubscriptions.permissionState, 'granted'),
                          isNull(webPushSubscriptions.revokedAt),
                          eq(
                              webPushSubscriptions.accountId,
                              notification.accountId,
                          ),
                          inArray(
                              webPushSubscriptions.userId,
                              recipientUserIds,
                          ),
                      ),
                  )
            : [];
    const pushSubscriptionUserIds = new Set(
        pushSubscriptionRows.flatMap((row) => (row.userId ? [row.userId] : [])),
    );

    const decisions: NotificationDeliveryDecision[] = recipients.flatMap(
        (recipient) =>
            targetChannels.map((channel) => {
                const accountPref = recipient.userId
                    ? preferences.find(
                          (p) =>
                              p.userId === recipient.userId &&
                              p.scope === 'account' &&
                              p.accountId === notification.accountId &&
                              p.category === notification.category &&
                              p.channel === channel,
                      )
                    : undefined;
                const globalPref = recipient.userId
                    ? preferences.find(
                          (p) =>
                              p.userId === recipient.userId &&
                              p.scope === 'global' &&
                              p.category === notification.category &&
                              p.channel === channel,
                      )
                    : undefined;
                return {
                    ...decideDeliveryOutcome({
                        channel,
                        defaultPreference: notificationPreferenceDefault(
                            notification.category,
                            channel,
                        ),
                        preference: accountPref ?? globalPref,
                        hasPushSubscription:
                            recipient.userId != null &&
                            pushSubscriptionUserIds.has(recipient.userId),
                        now,
                    }),
                    accountId: recipient.accountId,
                    userId: recipient.userId,
                };
            }),
    );

    if (notification.userId || notification.accountId) {
        const existingRouterAttempts = await db
            .select({
                channel: notificationDeliveryAttempts.channel,
                userId: notificationDeliveryAttempts.userId,
            })
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
        const routedKeys = new Set(
            existingRouterAttempts.map(notificationDeliveryRoutingKey),
        );
        const unroutedDecisions = decisions.filter(
            (decision) =>
                !routedKeys.has(notificationDeliveryRoutingKey(decision)),
        );

        if (unroutedDecisions.length > 0) {
            await db.insert(notificationDeliveryAttempts).values(
                unroutedDecisions.map((decision) => ({
                    notificationId,
                    userId: decision.userId,
                    accountId: decision.accountId,
                    channel: decision.channel,
                    status: deliveryAttemptStatusForOutcome(decision.outcome),
                    provider: 'router',
                    providerResponseCode: decision.reason,
                })),
            );
        }
    }

    return decisions;
}

export async function routeNotificationDelivery(
    notificationId: string,
    options: { now?: Date } = {},
) {
    return await storage().transaction(async (tx) => {
        await acquireNotificationDeliveryLock(tx, notificationId);
        return await routeNotificationDeliveryWithDatabase(
            tx,
            notificationId,
            options,
        );
    });
}

function queuedPushDecisionForUser(
    decisions: NotificationDeliveryDecision[],
    userId: string | null,
) {
    return decisions.find(
        (decision) => decision.channel === 'push' && decision.userId === userId,
    );
}

async function updatePendingPushAttempt(
    db: NotificationDatabaseClient,
    {
        attemptId,
        now,
        provider,
        providerResponseCode,
        status,
    }: {
        attemptId: number;
        now: Date;
        provider: 'router' | 'web_push_queue';
        providerResponseCode: string;
        status: 'accepted' | 'dropped' | 'queued';
    },
) {
    const updated = await db
        .update(notificationDeliveryAttempts)
        .set({
            attemptedAt: now,
            providerResponseBody: null,
            providerResponseCode,
            status,
        })
        .where(
            and(
                eq(notificationDeliveryAttempts.id, attemptId),
                eq(notificationDeliveryAttempts.channel, 'push'),
                eq(notificationDeliveryAttempts.provider, provider),
                eq(notificationDeliveryAttempts.status, 'queued'),
            ),
        )
        .returning({ id: notificationDeliveryAttempts.id });
    return Boolean(updated[0]);
}

export async function promoteDeferredWebPushDeliveryAttempts({
    limit = 50,
    notificationId,
    now = new Date(),
}: {
    limit?: number;
    notificationId?: string;
    now?: Date;
} = {}): Promise<DeferredWebPushPromotionResult> {
    const boundedLimit = boundedPositiveInteger(limit, 50, 500);
    const candidateRows = await storage()
        .select({
            notificationId: notificationDeliveryAttempts.notificationId,
        })
        .from(notificationDeliveryAttempts)
        .where(
            and(
                eq(notificationDeliveryAttempts.channel, 'push'),
                eq(notificationDeliveryAttempts.provider, 'router'),
                eq(notificationDeliveryAttempts.status, 'queued'),
                eq(
                    notificationDeliveryAttempts.providerResponseCode,
                    'quiet_hours',
                ),
                notificationId
                    ? eq(
                          notificationDeliveryAttempts.notificationId,
                          notificationId,
                      )
                    : undefined,
            ),
        )
        .orderBy(
            asc(notificationDeliveryAttempts.attemptedAt),
            asc(notificationDeliveryAttempts.createdAt),
        )
        .limit(boundedLimit);
    const candidateNotificationIds = uniqueStrings(
        candidateRows.map((candidate) => candidate.notificationId),
    );
    const result: DeferredWebPushPromotionResult = {
        deferred: 0,
        dropped: 0,
        queued: 0,
        scanned: 0,
    };

    for (const candidateNotificationId of candidateNotificationIds) {
        const promoted = await storage().transaction(async (tx) => {
            await acquireNotificationDeliveryLock(tx, candidateNotificationId);
            const pendingAttempts = await tx
                .select({
                    attemptId: notificationDeliveryAttempts.id,
                    userId: notificationDeliveryAttempts.userId,
                })
                .from(notificationDeliveryAttempts)
                .where(
                    and(
                        eq(
                            notificationDeliveryAttempts.notificationId,
                            candidateNotificationId,
                        ),
                        eq(notificationDeliveryAttempts.channel, 'push'),
                        eq(notificationDeliveryAttempts.provider, 'router'),
                        eq(notificationDeliveryAttempts.status, 'queued'),
                        eq(
                            notificationDeliveryAttempts.providerResponseCode,
                            'quiet_hours',
                        ),
                    ),
                );
            if (pendingAttempts.length === 0) {
                return {
                    deferred: 0,
                    dropped: 0,
                    queued: 0,
                    scanned: 0,
                };
            }

            const decisions = await routeNotificationDeliveryWithDatabase(
                tx,
                candidateNotificationId,
                { now },
            );
            const eligibleUserIds = uniqueStrings(
                pendingAttempts.flatMap(({ userId }) => {
                    const decision = queuedPushDecisionForUser(
                        decisions,
                        userId,
                    );
                    return userId &&
                        (decision?.outcome === 'immediate' ||
                            decision?.outcome === 'required')
                        ? [userId]
                        : [];
                }),
            );
            const queueResult = await enqueuePushDeliveryAttemptsWithDatabase(
                tx,
                {
                    notificationId: candidateNotificationId,
                    userIds: eligibleUserIds,
                },
            );
            let deferred = 0;
            let dropped = 0;
            for (const attempt of pendingAttempts) {
                const decision = queuedPushDecisionForUser(
                    decisions,
                    attempt.userId,
                );
                if (
                    decision?.outcome === 'immediate' ||
                    decision?.outcome === 'required'
                ) {
                    await updatePendingPushAttempt(tx, {
                        attemptId: attempt.attemptId,
                        now,
                        provider: 'router',
                        providerResponseCode: 'eligible_after_quiet_hours',
                        status: 'accepted',
                    });
                    continue;
                }
                if (
                    decision?.outcome === 'deferred' &&
                    decision.reason === 'quiet_hours'
                ) {
                    const updated = await updatePendingPushAttempt(tx, {
                        attemptId: attempt.attemptId,
                        now,
                        provider: 'router',
                        providerResponseCode: decision.reason,
                        status: 'queued',
                    });
                    if (updated) deferred += 1;
                    continue;
                }
                const updated = await updatePendingPushAttempt(tx, {
                    attemptId: attempt.attemptId,
                    now,
                    provider: 'router',
                    providerResponseCode: decision?.reason ?? 'not_recipient',
                    status: 'dropped',
                });
                if (updated) dropped += 1;
            }

            return {
                deferred,
                dropped,
                queued: queueResult.queued,
                scanned: pendingAttempts.length,
            };
        });
        result.deferred += promoted.deferred;
        result.dropped += promoted.dropped;
        result.queued += promoted.queued;
        result.scanned += promoted.scanned;
    }

    return result;
}

export async function revalidateQueuedWebPushDeliveryAttempt({
    attemptId,
    now = new Date(),
}: {
    attemptId: number;
    now?: Date;
}): Promise<QueuedWebPushDeliveryRevalidation> {
    const candidate = await storage()
        .select({
            notificationId: notificationDeliveryAttempts.notificationId,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.id, attemptId))
        .limit(1);
    const notificationId = candidate[0]?.notificationId;
    if (!notificationId) {
        return { reason: 'attempt_missing', status: 'unavailable' };
    }

    return await storage().transaction(async (tx) => {
        await acquireNotificationDeliveryLock(tx, notificationId);
        const attempts = await tx
            .select({
                accountId: notificationDeliveryAttempts.accountId,
                attemptId: notificationDeliveryAttempts.id,
                attemptedAt: notificationDeliveryAttempts.attemptedAt,
                providerResponseCode:
                    notificationDeliveryAttempts.providerResponseCode,
                pushSubscriptionId:
                    notificationDeliveryAttempts.pushSubscriptionId,
                userId: notificationDeliveryAttempts.userId,
            })
            .from(notificationDeliveryAttempts)
            .where(
                and(
                    eq(notificationDeliveryAttempts.id, attemptId),
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        notificationId,
                    ),
                    eq(notificationDeliveryAttempts.channel, 'push'),
                    eq(notificationDeliveryAttempts.provider, 'web_push_queue'),
                    eq(notificationDeliveryAttempts.status, 'queued'),
                ),
            )
            .limit(1);
        const attempt = attempts[0];
        if (!attempt) {
            return { reason: 'not_queued', status: 'unavailable' };
        }
        if (
            !attempt.accountId ||
            !attempt.userId ||
            !attempt.pushSubscriptionId
        ) {
            await updatePendingPushAttempt(tx, {
                attemptId,
                now,
                provider: 'web_push_queue',
                providerResponseCode: 'not_recipient',
                status: 'dropped',
            });
            return { reason: 'not_recipient', status: 'dropped' };
        }

        const claimCutoff = new Date(
            now.getTime() - webPushDeliveryClaimLeaseMs,
        );
        if (
            attempt.providerResponseCode === webPushDeliveryClaimProviderCode &&
            attempt.attemptedAt > claimCutoff
        ) {
            return { reason: 'send_claim_active', status: 'unavailable' };
        }

        const subscription = await tx.query.webPushSubscriptions.findFirst({
            where: and(
                eq(webPushSubscriptions.id, attempt.pushSubscriptionId),
                eq(webPushSubscriptions.accountId, attempt.accountId),
                eq(webPushSubscriptions.userId, attempt.userId),
            ),
        });
        if (!subscription || !isDeliverablePushSubscription(subscription)) {
            await updatePendingPushAttempt(tx, {
                attemptId,
                now,
                provider: 'web_push_queue',
                providerResponseCode: 'missing_push_subscription',
                status: 'dropped',
            });
            return {
                reason: 'missing_push_subscription',
                status: 'dropped',
            };
        }

        const notification = await getNotificationWithDatabase(
            tx,
            notificationId,
        );
        if (!notification) {
            await updatePendingPushAttempt(tx, {
                attemptId,
                now,
                provider: 'web_push_queue',
                providerResponseCode: 'notification_missing',
                status: 'dropped',
            });
            return { reason: 'notification_missing', status: 'dropped' };
        }
        if (
            notification.ttlSeconds !== null &&
            notification.timestamp.getTime() + notification.ttlSeconds * 1000 <=
                now.getTime()
        ) {
            await updatePendingPushAttempt(tx, {
                attemptId,
                now,
                provider: 'web_push_queue',
                providerResponseCode: 'notification_expired',
                status: 'dropped',
            });
            return { reason: 'notification_expired', status: 'dropped' };
        }

        const decisions = await routeNotificationDeliveryWithDatabase(
            tx,
            notificationId,
            { now },
        );
        const decision = queuedPushDecisionForUser(decisions, attempt.userId);
        if (!decision) {
            await updatePendingPushAttempt(tx, {
                attemptId,
                now,
                provider: 'web_push_queue',
                providerResponseCode: 'not_recipient',
                status: 'dropped',
            });
            return { reason: 'not_recipient', status: 'dropped' };
        }
        if (
            decision.outcome === 'immediate' ||
            decision.outcome === 'required'
        ) {
            const claimed = await tx
                .update(notificationDeliveryAttempts)
                .set({
                    attemptedAt: now,
                    providerResponseBody: null,
                    providerResponseCode: webPushDeliveryClaimProviderCode,
                })
                .where(
                    and(
                        eq(notificationDeliveryAttempts.id, attemptId),
                        eq(notificationDeliveryAttempts.channel, 'push'),
                        eq(
                            notificationDeliveryAttempts.provider,
                            'web_push_queue',
                        ),
                        eq(notificationDeliveryAttempts.status, 'queued'),
                        or(
                            isNull(
                                notificationDeliveryAttempts.providerResponseCode,
                            ),
                            ne(
                                notificationDeliveryAttempts.providerResponseCode,
                                webPushDeliveryClaimProviderCode,
                            ),
                            lte(
                                notificationDeliveryAttempts.attemptedAt,
                                claimCutoff,
                            ),
                        ),
                    ),
                )
                .returning({ id: notificationDeliveryAttempts.id });
            return claimed[0]
                ? { reason: decision.reason, status: 'eligible' }
                : { reason: 'send_claim_active', status: 'unavailable' };
        }
        if (
            decision.outcome === 'deferred' &&
            decision.reason === 'quiet_hours'
        ) {
            await updatePendingPushAttempt(tx, {
                attemptId,
                now,
                provider: 'web_push_queue',
                providerResponseCode: decision.reason,
                status: 'queued',
            });
            return { reason: decision.reason, status: 'deferred' };
        }

        await updatePendingPushAttempt(tx, {
            attemptId,
            now,
            provider: 'web_push_queue',
            providerResponseCode: decision.reason,
            status: 'dropped',
        });
        return { reason: decision.reason, status: 'dropped' };
    });
}

function boundedPositiveInteger(
    value: number,
    fallback: number,
    maximum: number,
) {
    if (!Number.isSafeInteger(value) || value < 1) return fallback;
    return Math.min(value, maximum);
}

function deliveryLifecycleEmailClaimCutoff(now: Date, claimLeaseMs: number) {
    const boundedClaimLeaseMs = boundedPositiveInteger(
        claimLeaseMs,
        defaultDeliveryLifecycleEmailClaimLeaseMs,
        maximumDeliveryLifecycleEmailClaimLeaseMs,
    );
    return new Date(now.getTime() - boundedClaimLeaseMs);
}

function normalizeDeliveryLifecycleEmailRecipient(value: string) {
    const email = value.trim();
    if (
        email.length === 0 ||
        email.length > maximumDeliveryLifecycleEmailRecipientLength ||
        /[\s<>]/u.test(email)
    ) {
        return null;
    }
    const at = email.indexOf('@');
    if (at < 1 || at !== email.lastIndexOf('@') || at > 64) return null;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (
        local.startsWith('.') ||
        local.endsWith('.') ||
        local.includes('..') ||
        !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/u.test(local) ||
        domain.length === 0 ||
        domain.length > 253
    ) {
        return null;
    }
    const domainLabels = domain.split('.');
    if (
        domainLabels.length < 2 ||
        domainLabels.some(
            (label) =>
                label.length === 0 ||
                label.length > 63 ||
                !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u.test(label),
        )
    ) {
        return null;
    }
    return email;
}

async function getDeliveryLifecycleEmailPreference(
    db: NotificationDatabaseClient,
    notification: Pick<SelectNotification, 'accountId' | 'category'>,
    userId: string,
) {
    const preferences =
        await db.query.notificationUserChannelPreferences.findMany({
            where: and(
                eq(notificationUserChannelPreferences.userId, userId),
                eq(
                    notificationUserChannelPreferences.category,
                    notification.category,
                ),
                eq(notificationUserChannelPreferences.channel, 'email'),
                or(
                    eq(notificationUserChannelPreferences.scope, 'global'),
                    and(
                        eq(notificationUserChannelPreferences.scope, 'account'),
                        eq(
                            notificationUserChannelPreferences.accountId,
                            notification.accountId,
                        ),
                    ),
                ),
            ),
        });
    return (
        preferences.find(
            (preference) =>
                preference.scope === 'account' &&
                preference.accountId === notification.accountId,
        ) ?? preferences.find((preference) => preference.scope === 'global')
    );
}

function nextDeliveryLifecycleEmailEligibility(
    now: Date,
    preference: SelectNotificationUserChannelPreference | undefined,
) {
    const start = preference?.quietHoursStartMinute;
    const end = preference?.quietHoursEndMinute;
    const timeZone = preference?.timezone;
    if (
        start === null ||
        start === undefined ||
        end === null ||
        end === undefined ||
        !timeZone
    ) {
        return new Date(
            now.getTime() + defaultDeliveryLifecycleEmailClaimLeaseMs,
        );
    }
    let formatter: Intl.DateTimeFormat;
    try {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
    } catch {
        return new Date(
            now.getTime() + defaultDeliveryLifecycleEmailClaimLeaseMs,
        );
    }

    const minuteAt = (candidate: Date) => {
        const parts = formatter.formatToParts(candidate);
        const hour = Number(
            parts.find((part) => part.type === 'hour')?.value ?? '0',
        );
        const minute = Number(
            parts.find((part) => part.type === 'minute')?.value ?? '0',
        );
        return hour * 60 + minute;
    };
    const insideQuietHours = (candidate: Date) => {
        const minute = minuteAt(candidate);
        if (start === end) return false;
        return start < end
            ? minute >= start && minute < end
            : minute >= start || minute < end;
    };
    const staysOutsideAcrossClockFold = (candidate: Date) => {
        let previousMinute = minuteAt(candidate);
        for (let offset = 1; offset <= 180; offset += 1) {
            const probe = new Date(candidate.getTime() + offset * 60_000);
            const currentMinute = minuteAt(probe);
            const wallClockAdvance =
                (currentMinute - previousMinute + 1440) % 1440;
            if (wallClockAdvance > 720 && insideQuietHours(probe)) {
                return false;
            }
            previousMinute = currentMinute;
        }
        return true;
    };
    const eligibleAt = (candidate: Date) =>
        !insideQuietHours(candidate) && staysOutsideAcrossClockFold(candidate);
    const firstWholeMinuteAfterNow = new Date(
        Math.floor(now.getTime() / 60_000) * 60_000 + 60_000,
    );
    if (eligibleAt(firstWholeMinuteAfterNow)) {
        return firstWholeMinuteAfterNow;
    }

    // Walk real instants rather than constructing a local wall time. This
    // naturally resolves spring-forward gaps and repeated fall-back minutes.
    const coarseStepMinutes = 15;
    const maximumSearchMinutes = 26 * 60;
    for (
        let offset = coarseStepMinutes;
        offset <= maximumSearchMinutes;
        offset += coarseStepMinutes
    ) {
        const probe = new Date(
            firstWholeMinuteAfterNow.getTime() + offset * 60_000,
        );
        if (!eligibleAt(probe)) continue;
        const refinementStart = Math.max(1, offset - coarseStepMinutes + 1);
        for (
            let refinedOffset = refinementStart;
            refinedOffset <= offset;
            refinedOffset += 1
        ) {
            const candidate = new Date(
                firstWholeMinuteAfterNow.getTime() + refinedOffset * 60_000,
            );
            if (eligibleAt(candidate)) return candidate;
        }
    }

    return new Date(now.getTime() + defaultDeliveryLifecycleEmailClaimLeaseMs);
}

async function updateDeferredDeliveryLifecycleEmailAttempt(
    db: TransactionClient,
    {
        attemptId,
        attemptedAt,
        deferralRecordedAt,
        expectedProviderResponseCode = 'quiet_hours',
        notificationId,
        providerResponseCode,
        status = 'queued',
        userId,
    }: DeliveryLifecycleEmailCandidate & {
        attemptId: number;
        attemptedAt: Date;
        deferralRecordedAt?: Date;
        expectedProviderResponseCode?: 'claimed' | 'quiet_hours';
        providerResponseCode: string;
        status?: 'dropped' | 'queued';
    },
) {
    const result = await db
        .update(notificationDeliveryAttempts)
        .set({
            attemptedAt,
            failedAt: null,
            providerResponseBody: null,
            providerResponseCode,
            status,
        })
        .where(
            and(
                eq(notificationDeliveryAttempts.id, attemptId),
                eq(notificationDeliveryAttempts.notificationId, notificationId),
                eq(notificationDeliveryAttempts.userId, userId),
                eq(notificationDeliveryAttempts.channel, 'email'),
                eq(
                    notificationDeliveryAttempts.provider,
                    deliveryLifecycleEmailProvider,
                ),
                eq(notificationDeliveryAttempts.status, 'queued'),
                eq(
                    notificationDeliveryAttempts.providerResponseCode,
                    expectedProviderResponseCode,
                ),
            ),
        )
        .returning({ id: notificationDeliveryAttempts.id });
    if (
        result[0] &&
        deferralRecordedAt &&
        providerResponseCode === 'quiet_hours'
    ) {
        await db.insert(notificationDeliveryEvents).values({
            deliveryAttemptId: attemptId,
            metadata: {
                eligibleAt: attemptedAt.toISOString(),
                provider: deliveryLifecycleEmailProvider,
                reason: 'quiet_hours',
            },
            notificationId,
            occurredAt: deferralRecordedAt,
            type: 'queued',
        });
    }
    return Boolean(result[0]);
}

function deliveryLifecycleNotificationIsExpired(
    notification: Pick<SelectNotification, 'timestamp' | 'ttlSeconds'>,
    now: Date,
) {
    const ttlSeconds = Math.max(
        0,
        Math.min(
            notification.ttlSeconds ??
                deliveryLifecycleNotificationMaximumAgeSeconds,
            deliveryLifecycleNotificationMaximumAgeSeconds,
        ),
    );
    return (
        notification.timestamp.getTime() + ttlSeconds * 1000 <= now.getTime()
    );
}

export async function getDeliveryLifecycleEmailCandidates({
    claimLeaseMs = defaultDeliveryLifecycleEmailClaimLeaseMs,
    limit = 50,
    maxAttempts = defaultDeliveryLifecycleEmailMaxAttempts,
    now = new Date(),
}: {
    claimLeaseMs?: number;
    limit?: number;
    maxAttempts?: number;
    now?: Date;
} = {}): Promise<DeliveryLifecycleEmailCandidate[]> {
    const boundedLimit = boundedPositiveInteger(limit, 50, 500);
    const boundedMaxAttempts = boundedPositiveInteger(
        maxAttempts,
        defaultDeliveryLifecycleEmailMaxAttempts,
        10,
    );
    const claimCutoff = deliveryLifecycleEmailClaimCutoff(now, claimLeaseMs);
    const recipientUserId = sql<string>`coalesce(${notifications.userId}, ${accountUsers.userId})`;
    const dueQuietHoursAttemptQuery = () =>
        storage()
            .select({ id: notificationDeliveryAttempts.id })
            .from(notificationDeliveryAttempts)
            .where(
                and(
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        notifications.id,
                    ),
                    eq(notificationDeliveryAttempts.userId, recipientUserId),
                    eq(
                        notificationDeliveryAttempts.provider,
                        deliveryLifecycleEmailProvider,
                    ),
                    eq(notificationDeliveryAttempts.status, 'queued'),
                    eq(
                        notificationDeliveryAttempts.providerResponseCode,
                        'quiet_hours',
                    ),
                    lte(notificationDeliveryAttempts.attemptedAt, now),
                ),
            );
    const selectCandidateCohort = async (deferredAfterQuietHours: boolean) =>
        await storage()
            .selectDistinct({
                createdAt: notifications.createdAt,
                notificationId: notifications.id,
                userId: recipientUserId,
            })
            .from(notifications)
            .leftJoin(
                accountUsers,
                and(
                    eq(accountUsers.accountId, notifications.accountId),
                    or(
                        isNull(notifications.userId),
                        eq(accountUsers.userId, notifications.userId),
                    ),
                ),
            )
            .innerJoin(users, eq(users.id, recipientUserId))
            .where(
                and(
                    eq(
                        notifications.category,
                        deliveryLifecycleNotificationCategory,
                    ),
                    eq(notifications.type, deliveryLifecycleNotificationType),
                    isNotNull(recipientUserId),
                    or(
                        isNotNull(notifications.userId),
                        inArray(users.role, [
                            ...customerDeliveryNotificationRecipientRoles,
                        ]),
                    ),
                    sql`${notifications.timestamp} + (
                        greatest(
                            0,
                            least(
                                coalesce(
                                    ${notifications.ttlSeconds},
                                    ${deliveryLifecycleNotificationMaximumAgeSeconds}
                                ),
                                ${deliveryLifecycleNotificationMaximumAgeSeconds}
                            )
                        ) * interval '1 second'
                    ) > ${now}`,
                    deferredAfterQuietHours
                        ? exists(dueQuietHoursAttemptQuery())
                        : notExists(dueQuietHoursAttemptQuery()),
                    // Stale pre-send claims are safe to reclaim. Once marked
                    // sending, provider acceptance is uncertain and the attempt
                    // must not be retried automatically without idempotent send.
                    notExists(
                        storage()
                            .select({ id: notificationDeliveryAttempts.id })
                            .from(notificationDeliveryAttempts)
                            .where(
                                and(
                                    eq(
                                        notificationDeliveryAttempts.notificationId,
                                        notifications.id,
                                    ),
                                    eq(
                                        notificationDeliveryAttempts.userId,
                                        recipientUserId,
                                    ),
                                    eq(
                                        notificationDeliveryAttempts.provider,
                                        deliveryLifecycleEmailProvider,
                                    ),
                                    or(
                                        inArray(
                                            notificationDeliveryAttempts.status,
                                            ['accepted', 'sent', 'dropped'],
                                        ),
                                        and(
                                            eq(
                                                notificationDeliveryAttempts.status,
                                                'queued',
                                            ),
                                            or(
                                                eq(
                                                    notificationDeliveryAttempts.providerResponseCode,
                                                    'sending',
                                                ),
                                                and(
                                                    eq(
                                                        notificationDeliveryAttempts.providerResponseCode,
                                                        'quiet_hours',
                                                    ),
                                                    gt(
                                                        notificationDeliveryAttempts.attemptedAt,
                                                        now,
                                                    ),
                                                ),
                                                and(
                                                    sql`${notificationDeliveryAttempts.providerResponseCode} is distinct from 'quiet_hours'`,
                                                    gt(
                                                        notificationDeliveryAttempts.attemptedAt,
                                                        claimCutoff,
                                                    ),
                                                ),
                                            ),
                                        ),
                                    ),
                                ),
                            ),
                    ),
                    sql`(
                        select count(*)::int
                        from ${notificationDeliveryAttempts}
                        where ${notificationDeliveryAttempts.notificationId} = ${notifications.id}
                          and ${notificationDeliveryAttempts.userId} = ${recipientUserId}
                          and ${notificationDeliveryAttempts.provider} = ${deliveryLifecycleEmailProvider}
                          and ${notificationDeliveryAttempts.status} = 'failed'
                          and ${notificationDeliveryAttempts.providerResponseCode}
                              is distinct from ${deliveryLifecycleEmailExpiredClaimCode}
                    ) < ${boundedMaxAttempts}`,
                ),
            )
            .orderBy(
                asc(notifications.createdAt),
                asc(notifications.id),
                asc(recipientUserId),
            )
            .limit(boundedLimit);

    const [immediateRows, dueDeferredRows] = await Promise.all([
        selectCandidateCohort(false),
        selectCandidateCohort(true),
    ]);
    if (boundedLimit === 1) {
        const immediate = immediateRows[0];
        const deferred = dueDeferredRows[0];
        const preferImmediate =
            Math.floor(now.getTime() / (60 * 1_000)) % 2 === 0;
        const selected = preferImmediate
            ? (immediate ?? deferred)
            : (deferred ?? immediate);
        if (selected) {
            return [
                {
                    notificationId: selected.notificationId,
                    userId: selected.userId,
                },
            ];
        }
    }
    const rows: typeof immediateRows = [];
    for (
        let index = 0;
        rows.length < boundedLimit &&
        (index < immediateRows.length || index < dueDeferredRows.length);
        index += 1
    ) {
        const immediate = immediateRows[index];
        if (immediate) rows.push(immediate);
        if (rows.length >= boundedLimit) break;
        const deferred = dueDeferredRows[index];
        if (deferred) rows.push(deferred);
    }

    return rows.map(({ notificationId, userId }) => ({
        notificationId,
        userId,
    }));
}

async function insertDeliveryLifecycleEmailAttempt(
    db: TransactionClient,
    {
        accountId,
        attemptedAt,
        notificationId,
        providerResponseCode,
        queuedAt = attemptedAt,
        status,
        userId,
    }: {
        accountId: string;
        attemptedAt: Date;
        notificationId: string;
        providerResponseCode: string;
        queuedAt?: Date;
        status: 'dropped' | 'queued';
        userId: string;
    },
) {
    const result = await db
        .insert(notificationDeliveryAttempts)
        .values({
            accountId,
            attemptedAt,
            channel: 'email',
            notificationId,
            provider: deliveryLifecycleEmailProvider,
            providerResponseCode,
            status,
            userId,
        })
        .returning({ id: notificationDeliveryAttempts.id });
    const attemptId = result[0]?.id;
    if (!attemptId) {
        throw new Error('Failed to create delivery lifecycle email attempt.');
    }
    await db.insert(notificationDeliveryEvents).values({
        deliveryAttemptId: attemptId,
        metadata: {
            ...(attemptedAt.getTime() !== queuedAt.getTime()
                ? { eligibleAt: attemptedAt.toISOString() }
                : {}),
            provider: deliveryLifecycleEmailProvider,
            reason: providerResponseCode,
            ...(status === 'dropped' ? { retryable: false } : {}),
        },
        notificationId,
        occurredAt: queuedAt,
        type: status === 'queued' ? 'queued' : 'failed',
    });
    return attemptId;
}

async function terminalizeDeliveryLifecycleEmailCandidate(
    db: TransactionClient,
    {
        accountId,
        notificationId,
        now,
        queuedAttemptId,
        reason,
        userId,
    }: DeliveryLifecycleEmailCandidate & {
        accountId: string;
        now: Date;
        queuedAttemptId?: number;
        reason: string;
    },
) {
    if (queuedAttemptId) {
        const terminalized = await db
            .update(notificationDeliveryAttempts)
            .set({
                attemptedAt: now,
                failedAt: null,
                providerResponseBody: null,
                providerResponseCode: reason,
                status: 'dropped',
            })
            .where(
                and(
                    eq(notificationDeliveryAttempts.id, queuedAttemptId),
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        notificationId,
                    ),
                    eq(notificationDeliveryAttempts.userId, userId),
                    eq(notificationDeliveryAttempts.channel, 'email'),
                    eq(
                        notificationDeliveryAttempts.provider,
                        deliveryLifecycleEmailProvider,
                    ),
                    eq(notificationDeliveryAttempts.status, 'queued'),
                    sql`${notificationDeliveryAttempts.providerResponseCode} is distinct from 'sending'`,
                ),
            )
            .returning({ id: notificationDeliveryAttempts.id });
        if (terminalized[0]) {
            await db.insert(notificationDeliveryEvents).values({
                deliveryAttemptId: queuedAttemptId,
                metadata: {
                    provider: deliveryLifecycleEmailProvider,
                    reason,
                    retryable: false,
                },
                notificationId,
                occurredAt: now,
                type: 'failed',
            });
            return queuedAttemptId;
        }
    }
    return await insertDeliveryLifecycleEmailAttempt(db, {
        accountId,
        attemptedAt: now,
        notificationId,
        providerResponseCode: reason,
        status: 'dropped',
        userId,
    });
}

async function expireDeliveryLifecycleEmailClaim(
    db: TransactionClient,
    {
        attemptId,
        notificationId,
        now,
        userId,
    }: DeliveryLifecycleEmailCandidate & {
        attemptId: number;
        now: Date;
    },
) {
    const result = await db
        .update(notificationDeliveryAttempts)
        .set({
            attemptedAt: now,
            failedAt: now,
            providerResponseBody: null,
            providerResponseCode: deliveryLifecycleEmailExpiredClaimCode,
            status: 'failed',
        })
        .where(
            and(
                eq(notificationDeliveryAttempts.id, attemptId),
                eq(notificationDeliveryAttempts.notificationId, notificationId),
                eq(notificationDeliveryAttempts.userId, userId),
                eq(notificationDeliveryAttempts.channel, 'email'),
                eq(
                    notificationDeliveryAttempts.provider,
                    deliveryLifecycleEmailProvider,
                ),
                eq(notificationDeliveryAttempts.status, 'queued'),
            ),
        )
        .returning({ id: notificationDeliveryAttempts.id });
    if (!result[0]) {
        throw new Error('Failed to expire delivery lifecycle email claim.');
    }
    await db.insert(notificationDeliveryEvents).values({
        deliveryAttemptId: attemptId,
        metadata: {
            provider: deliveryLifecycleEmailProvider,
            reason: deliveryLifecycleEmailExpiredClaimCode,
            retryable: true,
        },
        notificationId,
        occurredAt: now,
        type: 'failed',
    });
}

async function recordDeliveryLifecycleEmailExhaustion(
    db: TransactionClient,
    {
        attemptId,
        notificationId,
        now,
        userId,
    }: DeliveryLifecycleEmailCandidate & {
        attemptId: number;
        now: Date;
    },
) {
    const existing = await db
        .select({ id: notificationDeliveryEvents.id })
        .from(notificationDeliveryEvents)
        .innerJoin(
            notificationDeliveryAttempts,
            eq(
                notificationDeliveryAttempts.id,
                notificationDeliveryEvents.deliveryAttemptId,
            ),
        )
        .where(
            and(
                eq(notificationDeliveryEvents.notificationId, notificationId),
                eq(notificationDeliveryEvents.type, 'failed'),
                eq(notificationDeliveryAttempts.userId, userId),
                sql`${notificationDeliveryEvents.metadata} ->> 'reason' = ${'attempts_exhausted'}`,
            ),
        )
        .limit(1);
    if (existing[0]) return false;
    await db.insert(notificationDeliveryEvents).values({
        deliveryAttemptId: attemptId,
        metadata: {
            provider: deliveryLifecycleEmailProvider,
            reason: 'attempts_exhausted',
            retryable: false,
        },
        notificationId,
        occurredAt: now,
        type: 'failed',
    });
    return true;
}

export async function claimDeliveryLifecycleEmailCandidate({
    claimLeaseMs = defaultDeliveryLifecycleEmailClaimLeaseMs,
    notificationId,
    userId,
    maxAttempts = defaultDeliveryLifecycleEmailMaxAttempts,
    now = new Date(),
}: DeliveryLifecycleEmailCandidate & {
    claimLeaseMs?: number;
    maxAttempts?: number;
    now?: Date;
}): Promise<DeliveryLifecycleEmailClaimResult> {
    const boundedMaxAttempts = boundedPositiveInteger(
        maxAttempts,
        defaultDeliveryLifecycleEmailMaxAttempts,
        10,
    );
    const claimCutoff = deliveryLifecycleEmailClaimCutoff(now, claimLeaseMs);
    return await storage().transaction(async (tx) => {
        await acquireNotificationDeliveryLock(tx, notificationId);
        const notification = await getNotificationWithDatabase(
            tx,
            notificationId,
        );
        if (!notification) {
            return {
                reason: 'notification_missing',
                status: 'unavailable',
            };
        }
        if (
            notification.category !== deliveryLifecycleNotificationCategory ||
            notification.type !== deliveryLifecycleNotificationType
        ) {
            return {
                reason: 'not_target_notification',
                status: 'unavailable',
            };
        }

        const existingAttempts = await tx
            .select({
                attemptedAt: notificationDeliveryAttempts.attemptedAt,
                id: notificationDeliveryAttempts.id,
                providerResponseCode:
                    notificationDeliveryAttempts.providerResponseCode,
                status: notificationDeliveryAttempts.status,
            })
            .from(notificationDeliveryAttempts)
            .where(
                and(
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        notificationId,
                    ),
                    eq(notificationDeliveryAttempts.userId, userId),
                    eq(
                        notificationDeliveryAttempts.provider,
                        deliveryLifecycleEmailProvider,
                    ),
                ),
            );
        if (
            existingAttempts.some((attempt) =>
                ['accepted', 'sent', 'dropped'].includes(attempt.status),
            )
        ) {
            return { reason: 'already_claimed', status: 'unavailable' };
        }
        const queuedAttempts = existingAttempts.filter(
            (attempt) => attempt.status === 'queued',
        );
        if (
            queuedAttempts.some(
                (attempt) => attempt.providerResponseCode === 'sending',
            )
        ) {
            return { reason: 'already_claimed', status: 'unavailable' };
        }
        const deferredAttempt = queuedAttempts.find(
            (attempt) => attempt.providerResponseCode === 'quiet_hours',
        );
        const claimedAttempt = queuedAttempts.find(
            (attempt) => attempt.providerResponseCode !== 'quiet_hours',
        );

        if (deliveryLifecycleNotificationIsExpired(notification, now)) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId,
                now,
                queuedAttemptId: deferredAttempt?.id ?? claimedAttempt?.id,
                reason: 'notification_expired',
                userId,
            });
            return { reason: 'notification_expired', status: 'unavailable' };
        }

        const recipients = await getNotificationDeliveryRecipients(
            tx,
            notification,
        );
        if (!recipients.some((recipient) => recipient.userId === userId)) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId,
                now,
                queuedAttemptId: deferredAttempt?.id ?? claimedAttempt?.id,
                reason: 'not_recipient',
                userId,
            });
            return { reason: 'not_recipient', status: 'unavailable' };
        }

        if (deferredAttempt && deferredAttempt.attemptedAt > now) {
            return { reason: 'quiet_hours', status: 'deferred' };
        }
        if (claimedAttempt && claimedAttempt.attemptedAt > claimCutoff) {
            return { reason: 'already_claimed', status: 'unavailable' };
        }
        for (const staleQueuedAttempt of queuedAttempts.filter(
            (attempt) => attempt.providerResponseCode !== 'quiet_hours',
        )) {
            await expireDeliveryLifecycleEmailClaim(tx, {
                attemptId: staleQueuedAttempt.id,
                notificationId,
                now,
                userId,
            });
        }
        const terminalFailures = existingAttempts.filter(
            (attempt) =>
                attempt.status === 'failed' &&
                attempt.providerResponseCode !==
                    deliveryLifecycleEmailExpiredClaimCode,
        );
        if (terminalFailures.length >= boundedMaxAttempts) {
            const lastFailure = terminalFailures.sort(
                (left, right) => right.id - left.id,
            )[0];
            if (lastFailure) {
                await recordDeliveryLifecycleEmailExhaustion(tx, {
                    attemptId: lastFailure.id,
                    notificationId,
                    now,
                    userId,
                });
            }
            return {
                reason: 'attempts_exhausted',
                status: 'unavailable',
            };
        }

        const decisions = await routeNotificationDeliveryWithDatabase(
            tx,
            notificationId,
            { now },
        );
        const emailDecision = decisions.find(
            (decision) =>
                decision.channel === 'email' && decision.userId === userId,
        );
        if (!emailDecision) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId,
                now,
                queuedAttemptId: deferredAttempt?.id,
                reason: 'not_recipient',
                userId,
            });
            return { reason: 'not_recipient', status: 'unavailable' };
        }
        if (
            emailDecision.outcome === 'deferred' &&
            emailDecision.reason === 'quiet_hours'
        ) {
            const preference = await getDeliveryLifecycleEmailPreference(
                tx,
                notification,
                userId,
            );
            const nextEligibility = nextDeliveryLifecycleEmailEligibility(
                now,
                preference,
            );
            if (deferredAttempt) {
                const updated =
                    await updateDeferredDeliveryLifecycleEmailAttempt(tx, {
                        attemptId: deferredAttempt.id,
                        attemptedAt: nextEligibility,
                        notificationId,
                        providerResponseCode: emailDecision.reason,
                        userId,
                    });
                if (!updated) {
                    return {
                        reason: 'already_claimed',
                        status: 'unavailable',
                    };
                }
            } else {
                await insertDeliveryLifecycleEmailAttempt(tx, {
                    accountId: notification.accountId,
                    attemptedAt: nextEligibility,
                    notificationId,
                    providerResponseCode: emailDecision.reason,
                    queuedAt: now,
                    status: 'queued',
                    userId,
                });
            }
            return {
                reason: emailDecision.reason,
                status: 'deferred',
            };
        }
        if (emailDecision.outcome === 'digest') {
            return {
                reason: emailDecision.reason,
                status: 'deferred',
            };
        }
        if (emailDecision.outcome === 'suppressed') {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId,
                now,
                queuedAttemptId: deferredAttempt?.id,
                reason: emailDecision.reason,
                userId,
            });
            return { reason: emailDecision.reason, status: 'skipped' };
        }

        const recipient = await tx
            .select({ email: users.userName })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        const email = recipient[0]
            ? normalizeDeliveryLifecycleEmailRecipient(recipient[0].email)
            : null;
        if (!email) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId,
                now,
                queuedAttemptId: deferredAttempt?.id,
                reason: 'invalid_recipient',
                userId,
            });
            return { reason: 'invalid_recipient', status: 'unavailable' };
        }
        const attemptId = deferredAttempt
            ? (await updateDeferredDeliveryLifecycleEmailAttempt(tx, {
                  attemptId: deferredAttempt.id,
                  attemptedAt: now,
                  notificationId,
                  providerResponseCode: 'claimed',
                  userId,
              }))
                ? deferredAttempt.id
                : null
            : await insertDeliveryLifecycleEmailAttempt(tx, {
                  accountId: notification.accountId,
                  attemptedAt: now,
                  notificationId,
                  providerResponseCode: 'claimed',
                  status: 'queued',
                  userId,
              });
        if (!attemptId) {
            return { reason: 'already_claimed', status: 'unavailable' };
        }
        return {
            claim: {
                accountId: notification.accountId,
                attemptId,
                email,
                metadata: notification.metadata,
                notificationId,
                userId,
            },
            status: 'claimed',
        };
    });
}

export async function startDeliveryLifecycleEmailAttempt(
    args: DeliveryLifecycleEmailCandidate & {
        attemptId: number;
        claimLeaseMs?: number;
        now?: Date;
    },
): Promise<DeliveryLifecycleEmailStartResult> {
    const now = args.now ?? new Date();
    const claimCutoff = deliveryLifecycleEmailClaimCutoff(
        now,
        args.claimLeaseMs ?? defaultDeliveryLifecycleEmailClaimLeaseMs,
    );
    return await storage().transaction(async (tx) => {
        await acquireNotificationDeliveryLock(tx, args.notificationId);
        const openClaim = await tx
            .select({ id: notificationDeliveryAttempts.id })
            .from(notificationDeliveryAttempts)
            .where(
                and(
                    eq(notificationDeliveryAttempts.id, args.attemptId),
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        args.notificationId,
                    ),
                    eq(notificationDeliveryAttempts.userId, args.userId),
                    eq(notificationDeliveryAttempts.channel, 'email'),
                    eq(
                        notificationDeliveryAttempts.provider,
                        deliveryLifecycleEmailProvider,
                    ),
                    eq(notificationDeliveryAttempts.status, 'queued'),
                    eq(
                        notificationDeliveryAttempts.providerResponseCode,
                        'claimed',
                    ),
                    gt(notificationDeliveryAttempts.attemptedAt, claimCutoff),
                ),
            )
            .limit(1);
        if (!openClaim[0]) {
            return { reason: 'claim_unavailable', status: 'unavailable' };
        }

        const notification = await getNotificationWithDatabase(
            tx,
            args.notificationId,
        );
        if (!notification) {
            return { reason: 'notification_missing', status: 'unavailable' };
        }
        if (
            notification.category !== deliveryLifecycleNotificationCategory ||
            notification.type !== deliveryLifecycleNotificationType
        ) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId: args.notificationId,
                now,
                queuedAttemptId: args.attemptId,
                reason: 'not_target_notification',
                userId: args.userId,
            });
            return {
                reason: 'not_target_notification',
                status: 'unavailable',
            };
        }
        if (deliveryLifecycleNotificationIsExpired(notification, now)) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId: args.notificationId,
                now,
                queuedAttemptId: args.attemptId,
                reason: 'notification_expired',
                userId: args.userId,
            });
            return {
                reason: 'notification_expired',
                status: 'unavailable',
            };
        }

        const recipients = await getNotificationDeliveryRecipients(
            tx,
            notification,
        );
        if (!recipients.some((recipient) => recipient.userId === args.userId)) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId: args.notificationId,
                now,
                queuedAttemptId: args.attemptId,
                reason: 'not_recipient',
                userId: args.userId,
            });
            return { reason: 'not_recipient', status: 'unavailable' };
        }

        const decisions = await routeNotificationDeliveryWithDatabase(
            tx,
            args.notificationId,
            { now },
        );
        const emailDecision = decisions.find(
            (decision) =>
                decision.channel === 'email' && decision.userId === args.userId,
        );
        if (!emailDecision) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId: args.notificationId,
                now,
                queuedAttemptId: args.attemptId,
                reason: 'not_recipient',
                userId: args.userId,
            });
            return { reason: 'not_recipient', status: 'unavailable' };
        }
        if (
            emailDecision.outcome === 'deferred' &&
            emailDecision.reason === 'quiet_hours'
        ) {
            const preference = await getDeliveryLifecycleEmailPreference(
                tx,
                notification,
                args.userId,
            );
            const deferred = await updateDeferredDeliveryLifecycleEmailAttempt(
                tx,
                {
                    attemptId: args.attemptId,
                    attemptedAt: nextDeliveryLifecycleEmailEligibility(
                        now,
                        preference,
                    ),
                    deferralRecordedAt: now,
                    expectedProviderResponseCode: 'claimed',
                    notificationId: args.notificationId,
                    providerResponseCode: emailDecision.reason,
                    userId: args.userId,
                },
            );
            return deferred
                ? { reason: emailDecision.reason, status: 'deferred' }
                : { reason: 'claim_unavailable', status: 'unavailable' };
        }
        if (
            emailDecision.outcome === 'deferred' ||
            emailDecision.outcome === 'digest' ||
            emailDecision.outcome === 'suppressed'
        ) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId: args.notificationId,
                now,
                queuedAttemptId: args.attemptId,
                reason: emailDecision.reason,
                userId: args.userId,
            });
            return { reason: emailDecision.reason, status: 'skipped' };
        }

        const recipient = await tx
            .select({ email: users.userName })
            .from(users)
            .where(eq(users.id, args.userId))
            .limit(1);
        const email = recipient[0]
            ? normalizeDeliveryLifecycleEmailRecipient(recipient[0].email)
            : null;
        if (!email) {
            await terminalizeDeliveryLifecycleEmailCandidate(tx, {
                accountId: notification.accountId,
                notificationId: args.notificationId,
                now,
                queuedAttemptId: args.attemptId,
                reason: 'invalid_recipient',
                userId: args.userId,
            });
            return { reason: 'invalid_recipient', status: 'unavailable' };
        }

        const result = await tx
            .update(notificationDeliveryAttempts)
            .set({
                attemptedAt: now,
                providerResponseBody: null,
                providerResponseCode: 'sending',
            })
            .where(
                and(
                    eq(notificationDeliveryAttempts.id, args.attemptId),
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        args.notificationId,
                    ),
                    eq(notificationDeliveryAttempts.userId, args.userId),
                    eq(notificationDeliveryAttempts.channel, 'email'),
                    eq(
                        notificationDeliveryAttempts.provider,
                        deliveryLifecycleEmailProvider,
                    ),
                    eq(notificationDeliveryAttempts.status, 'queued'),
                    eq(
                        notificationDeliveryAttempts.providerResponseCode,
                        'claimed',
                    ),
                    gt(notificationDeliveryAttempts.attemptedAt, claimCutoff),
                ),
            )
            .returning({ id: notificationDeliveryAttempts.id });
        return result[0]
            ? { email, status: 'started' }
            : { reason: 'claim_unavailable', status: 'unavailable' };
    });
}

type DeliveryLifecycleEmailAttemptFinalStatus = 'dropped' | 'failed' | 'sent';

async function finalizeDeliveryLifecycleEmailAttempt({
    attemptId,
    expectedProviderResponseCode,
    maxAttempts,
    notificationId,
    now,
    providerMessageId,
    providerResponseCode,
    status,
    userId,
}: DeliveryLifecycleEmailCandidate & {
    attemptId: number;
    expectedProviderResponseCode: 'claimed' | 'sending';
    maxAttempts?: number;
    now: Date;
    providerMessageId?: string | null;
    providerResponseCode: string;
    status: DeliveryLifecycleEmailAttemptFinalStatus;
}) {
    return await storage().transaction(async (tx) => {
        await acquireNotificationDeliveryLock(tx, notificationId);
        const result = await tx
            .update(notificationDeliveryAttempts)
            .set({
                acceptedAt: status === 'sent' ? now : null,
                attemptedAt: now,
                failedAt: status === 'failed' ? now : null,
                providerMessageId: providerMessageId?.trim().slice(0, 128),
                providerResponseBody: null,
                providerResponseCode: providerResponseCode.slice(0, 64),
                status,
            })
            .where(
                and(
                    eq(notificationDeliveryAttempts.id, attemptId),
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        notificationId,
                    ),
                    eq(notificationDeliveryAttempts.userId, userId),
                    eq(notificationDeliveryAttempts.channel, 'email'),
                    eq(
                        notificationDeliveryAttempts.provider,
                        deliveryLifecycleEmailProvider,
                    ),
                    eq(notificationDeliveryAttempts.status, 'queued'),
                    eq(
                        notificationDeliveryAttempts.providerResponseCode,
                        expectedProviderResponseCode,
                    ),
                ),
            )
            .returning({ id: notificationDeliveryAttempts.id });
        if (!result[0]) return false;
        let retryExhausted = false;
        if (status === 'failed' && maxAttempts) {
            const [failureTotal] = await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(notificationDeliveryAttempts)
                .where(
                    and(
                        eq(
                            notificationDeliveryAttempts.notificationId,
                            notificationId,
                        ),
                        eq(notificationDeliveryAttempts.userId, userId),
                        eq(
                            notificationDeliveryAttempts.provider,
                            deliveryLifecycleEmailProvider,
                        ),
                        eq(notificationDeliveryAttempts.status, 'failed'),
                        sql`${notificationDeliveryAttempts.providerResponseCode}
                            is distinct from ${deliveryLifecycleEmailExpiredClaimCode}`,
                    ),
                );
            retryExhausted = (failureTotal?.count ?? 0) >= maxAttempts;
        }
        await tx.insert(notificationDeliveryEvents).values({
            deliveryAttemptId: attemptId,
            metadata: {
                provider: deliveryLifecycleEmailProvider,
                retryable: status === 'failed' && !retryExhausted,
            },
            notificationId,
            occurredAt: now,
            type: status === 'sent' ? 'sent' : 'failed',
        });
        if (retryExhausted) {
            await recordDeliveryLifecycleEmailExhaustion(tx, {
                attemptId,
                notificationId,
                now,
                userId,
            });
        }
        return true;
    });
}

export async function markDeliveryLifecycleEmailAttemptSent(
    args: DeliveryLifecycleEmailCandidate & {
        attemptId: number;
        now?: Date;
        providerMessageId?: string | null;
    },
) {
    return await finalizeDeliveryLifecycleEmailAttempt({
        ...args,
        expectedProviderResponseCode: 'sending',
        now: args.now ?? new Date(),
        providerResponseCode: 'sent',
        status: 'sent',
    });
}

export async function markDeliveryLifecycleEmailAttemptFailed(
    args: DeliveryLifecycleEmailCandidate & {
        attemptId: number;
        maxAttempts?: number;
        now?: Date;
    },
) {
    const maxAttempts = boundedPositiveInteger(
        args.maxAttempts ?? defaultDeliveryLifecycleEmailMaxAttempts,
        defaultDeliveryLifecycleEmailMaxAttempts,
        10,
    );
    return await finalizeDeliveryLifecycleEmailAttempt({
        ...args,
        expectedProviderResponseCode: 'sending',
        maxAttempts,
        now: args.now ?? new Date(),
        providerResponseCode: 'sender_failed',
        status: 'failed',
    });
}

export async function dropDeliveryLifecycleEmailAttempt(
    args: DeliveryLifecycleEmailCandidate & {
        attemptId: number;
        now?: Date;
        reason: 'invalid_payload' | 'provider_rejected';
    },
) {
    return await finalizeDeliveryLifecycleEmailAttempt({
        ...args,
        expectedProviderResponseCode:
            args.reason === 'provider_rejected' ? 'sending' : 'claimed',
        now: args.now ?? new Date(),
        providerResponseCode: args.reason,
        status: 'dropped',
    });
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

function effectiveDeliveryUpdatesInAppPreference(
    preferences: SelectNotificationUserChannelPreference[],
    accountId: string,
) {
    return (
        preferences.find(
            (preference) =>
                preference.scope === 'account' &&
                preference.accountId === accountId,
        ) ?? preferences.find((preference) => preference.scope === 'global')
    );
}

function deliveryLifecycleNotificationIsVisibleInCenter({
    accountId,
    now,
    preferences,
}: {
    accountId: string;
    now: Date;
    preferences: SelectNotificationUserChannelPreference[];
}) {
    const decision = decideDeliveryOutcome({
        channel: 'in_app',
        defaultPreference: notificationPreferenceDefault(
            deliveryLifecycleNotificationCategory,
            'in_app',
        ),
        preference: effectiveDeliveryUpdatesInAppPreference(
            preferences,
            accountId,
        ),
        hasPushSubscription: false,
        now,
    });
    return decision.outcome === 'immediate' || decision.outcome === 'required';
}

export async function getNotificationsForCenter({
    accountId,
    limit,
    now = new Date(),
    page,
    read,
    userId,
}: {
    accountId: string;
    limit: number;
    now?: Date;
    page: number;
    read: boolean;
    userId: string;
}) {
    if (!Number.isSafeInteger(page) || page < 0 || page > 100) return [];
    const boundedPage = page;
    const boundedLimit =
        Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const targetStart = boundedPage * boundedLimit;
    const preferences =
        await storage().query.notificationUserChannelPreferences.findMany({
            where: and(
                eq(notificationUserChannelPreferences.userId, userId),
                eq(
                    notificationUserChannelPreferences.category,
                    deliveryLifecycleNotificationCategory,
                ),
                eq(notificationUserChannelPreferences.channel, 'in_app'),
            ),
        });
    const queuedLifecycleVisible =
        deliveryLifecycleNotificationIsVisibleInCenter({
            accountId,
            now,
            preferences,
        });
    return await storage().query.notifications.findMany({
        where: and(
            eq(notifications.accountId, accountId),
            or(eq(notifications.userId, userId), isNull(notifications.userId)),
            read ? undefined : isNull(notifications.readAt),
            or(
                sql`${notifications.category} <> ${deliveryLifecycleNotificationCategory}`,
                sql`${notifications.type} <> ${deliveryLifecycleNotificationType}`,
                and(
                    exists(
                        storage()
                            .select({ id: users.id })
                            .from(users)
                            .where(
                                and(
                                    eq(users.id, userId),
                                    inArray(users.role, [
                                        ...customerDeliveryNotificationRecipientRoles,
                                    ]),
                                ),
                            ),
                    ),
                    exists(
                        storage()
                            .select({ id: notificationDeliveryAttempts.id })
                            .from(notificationDeliveryAttempts)
                            .where(
                                and(
                                    eq(
                                        notificationDeliveryAttempts.notificationId,
                                        notifications.id,
                                    ),
                                    eq(
                                        notificationDeliveryAttempts.userId,
                                        userId,
                                    ),
                                    eq(
                                        notificationDeliveryAttempts.channel,
                                        'in_app',
                                    ),
                                    eq(
                                        notificationDeliveryAttempts.provider,
                                        'router',
                                    ),
                                    or(
                                        eq(
                                            notificationDeliveryAttempts.status,
                                            'accepted',
                                        ),
                                        queuedLifecycleVisible
                                            ? and(
                                                  eq(
                                                      notificationDeliveryAttempts.status,
                                                      'queued',
                                                  ),
                                                  eq(
                                                      notificationDeliveryAttempts.providerResponseCode,
                                                      'quiet_hours',
                                                  ),
                                              )
                                            : undefined,
                                    ),
                                ),
                            ),
                    ),
                ),
            ),
        ),
        orderBy: [
            desc(notifications.timestamp),
            desc(notifications.createdAt),
            desc(notifications.id),
        ],
        limit: boundedLimit,
        offset: targetStart,
    });
}

export function getNotifications(page: number, limit: number) {
    return storage().query.notifications.findMany({
        orderBy: desc(notifications.timestamp),
        limit,
        offset: page * limit,
    });
}

async function recordLifecycleNotificationsOpened(
    db: TransactionClient,
    notificationIds: string[],
    occurredAt: Date,
) {
    if (notificationIds.length === 0) return;
    const visibleAttemptWithoutOpenEvent = and(
        inArray(notificationDeliveryAttempts.notificationId, notificationIds),
        eq(notificationDeliveryAttempts.channel, 'in_app'),
        eq(notificationDeliveryAttempts.provider, 'router'),
        or(
            eq(notificationDeliveryAttempts.status, 'accepted'),
            and(
                eq(notificationDeliveryAttempts.status, 'queued'),
                eq(
                    notificationDeliveryAttempts.providerResponseCode,
                    'quiet_hours',
                ),
            ),
        ),
        notExists(
            db
                .select({ id: notificationDeliveryEvents.id })
                .from(notificationDeliveryEvents)
                .where(
                    and(
                        eq(
                            notificationDeliveryEvents.notificationId,
                            notificationDeliveryAttempts.notificationId,
                        ),
                        eq(notificationDeliveryEvents.type, 'opened'),
                    ),
                ),
        ),
    );
    await db.execute(sql`
        insert into ${notificationDeliveryEvents}
            ("delivery_attempt_id", "notification_id", "type", "occurred_at", "metadata")
        select distinct on (${notificationDeliveryAttempts.notificationId})
            ${notificationDeliveryAttempts.id},
            ${notificationDeliveryAttempts.notificationId},
            'opened'::notification_delivery_event_type,
            ${occurredAt}::timestamp,
            jsonb_build_object('surface', 'notification_center')
        from ${notificationDeliveryAttempts}
        where ${visibleAttemptWithoutOpenEvent}
        order by
            ${notificationDeliveryAttempts.notificationId},
            ${notificationDeliveryAttempts.id} asc
    `);
}

export async function setNotificationRead(
    id: string,
    read: boolean,
    readWhere: string,
) {
    if (!read) {
        return await storage()
            .update(notifications)
            .set({ readAt: null, readWhere })
            .where(eq(notifications.id, id));
    }
    return await storage().transaction(async (tx) => {
        await acquireNotificationDeliveryLock(tx, id);
        const occurredAt = new Date();
        const updated = await tx
            .update(notifications)
            .set({ readAt: occurredAt, readWhere })
            .where(and(eq(notifications.id, id), isNull(notifications.readAt)))
            .returning({
                category: notifications.category,
                id: notifications.id,
                type: notifications.type,
            });
        const lifecycleIds = updated.flatMap((notification) =>
            isCustomerDeliveryLifecycleNotification(notification)
                ? [notification.id]
                : [],
        );
        await recordLifecycleNotificationsOpened(tx, lifecycleIds, occurredAt);
        return updated;
    });
}

export async function setAllNotificationsRead(
    accountId: string,
    userId: string,
    notificationIds: string[],
    read: boolean,
    readWhere: string,
) {
    if (notificationIds.length > maxNotificationReadBatchSize) {
        throw new RangeError(
            `Cannot update more than ${maxNotificationReadBatchSize} notifications at once`,
        );
    }
    const uniqueIds = [...new Set(notificationIds)].sort();
    if (uniqueIds.length === 0) return [];
    const scopedNotifications = and(
        inArray(notifications.id, uniqueIds),
        eq(notifications.accountId, accountId),
        or(isNull(notifications.userId), eq(notifications.userId, userId)),
    );
    if (!read) {
        return await storage()
            .update(notifications)
            .set({ readAt: null, readWhere })
            .where(scopedNotifications);
    }
    return await storage().transaction(async (tx) => {
        const unreadScopedNotifications = await tx
            .select({ id: notifications.id })
            .from(notifications)
            .where(and(scopedNotifications, isNull(notifications.readAt)))
            .orderBy(asc(notifications.id));
        const unreadScopedIds = unreadScopedNotifications.map(({ id }) => id);
        if (unreadScopedIds.length === 0) return [];
        for (const id of unreadScopedIds) {
            await acquireNotificationDeliveryLock(tx, id);
        }
        const occurredAt = new Date();
        const updated = await tx
            .update(notifications)
            .set({ readAt: occurredAt, readWhere })
            .where(
                and(
                    inArray(notifications.id, unreadScopedIds),
                    eq(notifications.accountId, accountId),
                    or(
                        isNull(notifications.userId),
                        eq(notifications.userId, userId),
                    ),
                    isNull(notifications.readAt),
                ),
            )
            .returning({
                category: notifications.category,
                id: notifications.id,
                type: notifications.type,
            });
        const lifecycleIds = updated.flatMap((notification) =>
            isCustomerDeliveryLifecycleNotification(notification)
                ? [notification.id]
                : [],
        );
        await recordLifecycleNotificationsOpened(tx, lifecycleIds, occurredAt);
        return updated;
    });
}

export function deleteNotification(id: string) {
    return storage().delete(notifications).where(eq(notifications.id, id));
}

export function deleteNotifications(ids: string[]) {
    if (ids.length === 0) {
        return Promise.resolve([]);
    }

    return storage()
        .delete(notifications)
        .where(inArray(notifications.id, ids))
        .returning({
            id: notifications.id,
            accountId: notifications.accountId,
            userId: notifications.userId,
            gardenId: notifications.gardenId,
            raisedBedId: notifications.raisedBedId,
        });
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
