import { randomUUID } from 'node:crypto';
import {
    cancelNotificationCampaign,
    createNotificationCampaign,
    enqueueNotificationCampaign,
    getNotification,
    getNotificationCampaign,
    getNotificationsForCenter,
    isDeliverablePushSubscription,
    notificationUserChannelPreferences,
    previewNotificationCampaignAudience,
    recordNotificationDeliveryEvent,
    setAllNotificationsRead,
    setNotificationRead,
    sql,
    storage,
    webPushSubscriptions,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import {
    sanitizeGrediceLinkUrl,
    validateHostedImageUrl,
} from '../../../lib/http/safeUrls';
import { notificationPreferenceUpdateSchema } from '../../../lib/notifications/notificationPreferences';
import {
    notificationPreferencesWritable,
    notificationRolloutFlags,
} from '../../../lib/notifications/notificationRollout';
import { notificationCenterRoles } from '../../../lib/notifications/notificationRouteRoles';
import {
    normalizePushDevicePatch,
    pushDeviceResponse,
    pushDeviceUpsertSchema,
} from '../../../lib/notifications/pushDevices';
import {
    pushNotificationEventMetadata,
    pushNotificationEventSchema,
} from '../../../lib/notifications/pushEvents';
import { createAndSendTestWebPushNotification } from '../../../lib/notifications/webPushSender';

const testNotificationRateLimit = new Map<string, number>();
const TEST_NOTIFICATION_WINDOW_MS = 5 * 60 * 1000;
const allowedRequiredCampaignCategories = new Set([
    'account_security',
    'billing_order_delivery',
]);
const allowedRequiredAdminCampaignEvents = new Set([
    'legal_policy_update',
    'privacy_incident_notice',
    'maintenance_window',
]);

const campaignAudienceSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('all') }),
    z.object({
        type: z.literal('accounts'),
        accountIds: z.array(z.string().min(1)).min(1).max(500),
    }),
    z.object({
        type: z.literal('users'),
        userIds: z.array(z.string().min(1)).min(1).max(1000),
        accountIds: z.array(z.string().min(1)).min(1).max(500).optional(),
    }),
    z.object({
        type: z.literal('gardens'),
        gardenIds: z.array(z.number().int().positive()).min(1).max(500),
    }),
    z.object({
        type: z.literal('explicit'),
        recipients: z
            .array(
                z.object({
                    accountId: z.string().min(1),
                    userId: z.string().min(1),
                    gardenId: z.number().int().positive().optional(),
                }),
            )
            .min(1)
            .max(1000),
    }),
]);

const campaignChannelPolicySchema = z
    .object({
        inApp: z.boolean().default(true),
        email: z.boolean().default(false),
        push: z.boolean().default(false),
        digest: z.boolean().default(false),
        required: z.boolean().default(false),
        respectPreferences: z.boolean().default(true),
    })
    .refine(
        (policy) =>
            policy.inApp || policy.email || policy.push || policy.digest,
        'At least one delivery channel must be enabled',
    );

const nullableUrlSchema = z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .nullable()
    .optional();

const campaignDraftSchema = z.object({
    name: z.string().trim().min(1).max(160).optional(),
    audience: campaignAudienceSchema,
    channelPolicy: campaignChannelPolicySchema,
    header: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(2000),
    iconUrl: nullableUrlSchema,
    imageUrl: nullableUrlSchema,
    linkUrl: nullableUrlSchema,
    actionUrl: nullableUrlSchema,
    actionLabel: z.string().trim().min(1).max(80).nullable().optional(),
    category: z.string().trim().min(1).max(80),
    eventType: z.string().trim().min(1).max(120),
    primaryChannel: z
        .enum(['in_app', 'email', 'push', 'sms'])
        .optional()
        .default('in_app'),
    priority: z
        .enum(['low', 'normal', 'high', 'critical'])
        .optional()
        .default('normal'),
    collapseKey: z.string().trim().min(1).max(160).nullable().optional(),
    threadKey: z.string().trim().min(1).max(160).nullable().optional(),
    ttlSeconds: z.number().int().min(60).max(2_419_200).nullable().optional(),
    urgency: z
        .enum(['very-low', 'low', 'normal', 'high'])
        .nullable()
        .optional(),
    scheduledAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const sensitivePayloadFieldPattern =
    /(pass(word)?|token|secret|auth|cookie|session|email|phone|address|iban|card|ssn|oib)/i;

function isSafePayloadMetadataValue(
    value: unknown,
    depth = 0,
): value is
    | string
    | number
    | boolean
    | null
    | Record<string, unknown>
    | unknown[] {
    if (depth > 2) return false;
    if (value === null) return true;
    if (typeof value === 'string') return value.length <= 200;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) {
        return value.length <= 20
            ? value.every((item) => isSafePayloadMetadataValue(item, depth + 1))
            : false;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        return entries.length <= 20
            ? entries.every(([key, nestedValue]) => {
                  if (
                      key.length > 80 ||
                      sensitivePayloadFieldPattern.test(key)
                  ) {
                      return false;
                  }
                  return isSafePayloadMetadataValue(nestedValue, depth + 1);
              })
            : false;
    }
    return false;
}

function canBypassCampaignPreferences(category: string, eventType: string) {
    return (
        allowedRequiredCampaignCategories.has(category) ||
        (category === 'admin_campaigns' &&
            allowedRequiredAdminCampaignEvents.has(eventType))
    );
}

function validateCampaignPreferencePolicy(
    category: string,
    eventType: string,
    channelPolicy: z.infer<typeof campaignChannelPolicySchema>,
) {
    if (
        (channelPolicy.required || !channelPolicy.respectPreferences) &&
        !canBypassCampaignPreferences(category, eventType)
    ) {
        return 'Campaigns can bypass preferences only for required taxonomy categories';
    }

    return null;
}

function validateCampaignImageUrl(imageUrl: string | null | undefined) {
    if (!imageUrl) return null;
    return validateHostedImageUrl(imageUrl);
}

function sanitizeCampaignLinkUrl(linkUrl: string | null | undefined) {
    if (!linkUrl) return null;
    return sanitizeGrediceLinkUrl(linkUrl) ?? null;
}

function validateAndNormalizeCampaignDraft(
    draft: z.infer<typeof campaignDraftSchema>,
) {
    if (
        sensitivePayloadFieldPattern.test(draft.header) ||
        sensitivePayloadFieldPattern.test(draft.content)
    ) {
        return {
            error: 'Header/content cannot contain sensitive fields in push-safe payloads',
        };
    }

    if (
        Object.entries(draft.metadata).some(
            ([key, value]) =>
                sensitivePayloadFieldPattern.test(key) ||
                !isSafePayloadMetadataValue(value),
        )
    ) {
        return {
            error: 'Metadata includes disallowed or unsafe push payload fields',
        };
    }

    const imageError =
        validateCampaignImageUrl(draft.imageUrl) ??
        validateCampaignImageUrl(draft.iconUrl);
    if (imageError) {
        return { error: imageError };
    }

    const safeLinkUrl = sanitizeCampaignLinkUrl(draft.linkUrl);
    if (draft.linkUrl && !safeLinkUrl) {
        return {
            error: 'Link URL must be a safe Gredice URL or relative path',
        };
    }

    const safeActionUrl = sanitizeCampaignLinkUrl(draft.actionUrl);
    if (draft.actionUrl && !safeActionUrl) {
        return {
            error: 'Action URL must be a safe Gredice URL or relative path',
        };
    }

    const preferencePolicyError = validateCampaignPreferencePolicy(
        draft.category,
        draft.eventType,
        draft.channelPolicy,
    );
    if (preferencePolicyError) {
        return { error: preferencePolicyError };
    }

    return {
        draft: {
            ...draft,
            name: draft.name ?? draft.header,
            safeImageUrl: draft.imageUrl ?? null,
            safeLinkUrl,
            safeActionUrl,
        },
    };
}

function bulkCampaignsDisabledResponse(context: {
    json: (body: { error: string }, status: 403) => Response;
}) {
    if (notificationRolloutFlags.bulkCampaignsEnabled) return null;
    return context.json(
        {
            error: 'Bulk notification campaigns are not enabled in this environment',
        },
        403,
    );
}

function premiumControlsDisabledResponse(
    context: {
        json: (body: { error: string }, status: 403) => Response;
    },
    preferences: ReadonlyArray<{ category: string; channel: string }>,
) {
    if (notificationPreferencesWritable({ preferences })) return null;
    return context.json(
        {
            error: 'Premium notification controls are not enabled in this environment',
        },
        403,
    );
}

const app = new Hono<{ Variables: AuthVariables }>()
    .post(
        '/campaigns/preview',
        describeRoute({
            description:
                'Preview the matched audience size for a bulk notification campaign without enqueueing delivery.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('json', z.object({ audience: campaignAudienceSchema })),
        async (context) => {
            const disabledResponse = bulkCampaignsDisabledResponse(context);
            if (disabledResponse) return disabledResponse;

            const { audience } = context.req.valid('json');
            const preview = await previewNotificationCampaignAudience(audience);
            return context.json({ preview }, 200);
        },
    )
    .post(
        '/campaigns',
        describeRoute({
            description:
                'Create a draft bulk notification campaign with validated rich payload and auditable targeting.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('json', campaignDraftSchema),
        async (context) => {
            const disabledResponse = bulkCampaignsDisabledResponse(context);
            if (disabledResponse) return disabledResponse;

            const payload = context.req.valid('json');
            const normalized = validateAndNormalizeCampaignDraft(payload);
            if ('error' in normalized) {
                return context.json({ error: normalized.error }, 400);
            }

            const { accountId, userId } = context.get('authContext');
            const campaignId = await createNotificationCampaign({
                name: normalized.draft.name,
                audience: normalized.draft.audience,
                channelPolicy: normalized.draft.channelPolicy,
                header: normalized.draft.header,
                content: normalized.draft.content,
                iconUrl: normalized.draft.iconUrl ?? null,
                imageUrl: normalized.draft.imageUrl ?? null,
                linkUrl: normalized.draft.linkUrl ?? null,
                actionUrl: normalized.draft.actionUrl ?? null,
                actionLabel: normalized.draft.actionLabel ?? null,
                safeImageUrl: normalized.draft.safeImageUrl,
                safeLinkUrl: normalized.draft.safeLinkUrl,
                safeActionUrl: normalized.draft.safeActionUrl,
                category: normalized.draft.category,
                eventType: normalized.draft.eventType,
                primaryChannel: normalized.draft.primaryChannel,
                priority: normalized.draft.priority,
                collapseKey: normalized.draft.collapseKey ?? null,
                threadKey: normalized.draft.threadKey ?? null,
                ttlSeconds: normalized.draft.ttlSeconds ?? null,
                urgency: normalized.draft.urgency ?? null,
                scheduledAt: normalized.draft.scheduledAt ?? null,
                metadata: normalized.draft.metadata,
                deliveryMetadata: {
                    source: 'api',
                    draftCreatedByUserId: userId,
                },
                createdByUserId: userId,
                createdFromAccountId: accountId,
            });
            const campaign = await getNotificationCampaign(campaignId);
            return context.json({ campaign }, 201);
        },
    )
    .get(
        '/campaigns/:id',
        describeRoute({
            description:
                'Inspect bulk notification campaign status, counts, failures, and delivery metadata.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('param', z.object({ id: z.string().min(1) })),
        async (context) => {
            const disabledResponse = bulkCampaignsDisabledResponse(context);
            if (disabledResponse) return disabledResponse;

            const { id } = context.req.valid('param');
            const campaign = await getNotificationCampaign(id);
            if (!campaign) {
                return context.json({ error: 'Campaign not found' }, 404);
            }

            return context.json({ campaign }, 200);
        },
    )
    .post(
        '/campaigns/:id/preview',
        describeRoute({
            description:
                'Preview the current matched audience size for a draft or scheduled bulk notification campaign.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('param', z.object({ id: z.string().min(1) })),
        async (context) => {
            const disabledResponse = bulkCampaignsDisabledResponse(context);
            if (disabledResponse) return disabledResponse;

            const { id } = context.req.valid('param');
            const campaign = await getNotificationCampaign(id);
            if (!campaign) {
                return context.json({ error: 'Campaign not found' }, 404);
            }

            const preview = await previewNotificationCampaignAudience(
                campaign.audience,
            );
            return context.json({ preview }, 200);
        },
    )
    .post(
        '/campaigns/:id/enqueue',
        describeRoute({
            description:
                'Enqueue a draft bulk notification campaign by recording queue intent and audience counts without synchronous recipient fan-out.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('param', z.object({ id: z.string().min(1) })),
        zValidator(
            'json',
            z
                .object({
                    scheduledAt: z.coerce.date().nullable().optional(),
                })
                .optional()
                .default({}),
        ),
        async (context) => {
            const disabledResponse = bulkCampaignsDisabledResponse(context);
            if (disabledResponse) return disabledResponse;

            const { id } = context.req.valid('param');
            const { scheduledAt } = context.req.valid('json');
            const campaign = await getNotificationCampaign(id);
            if (!campaign) {
                return context.json({ error: 'Campaign not found' }, 404);
            }

            if (
                campaign.status !== 'draft' &&
                campaign.status !== 'scheduled'
            ) {
                return context.json(
                    {
                        error: `Campaign cannot be enqueued from ${campaign.status}`,
                    },
                    409,
                );
            }

            const imageError =
                validateCampaignImageUrl(campaign.imageUrl) ??
                validateCampaignImageUrl(campaign.iconUrl);
            if (imageError) {
                return context.json({ error: imageError }, 400);
            }

            if (
                campaign.linkUrl &&
                sanitizeCampaignLinkUrl(campaign.linkUrl) === null
            ) {
                return context.json(
                    {
                        error: 'Link URL must be a safe Gredice URL or relative path',
                    },
                    400,
                );
            }

            if (
                campaign.actionUrl &&
                sanitizeCampaignLinkUrl(campaign.actionUrl) === null
            ) {
                return context.json(
                    {
                        error: 'Action URL must be a safe Gredice URL or relative path',
                    },
                    400,
                );
            }

            const preferencePolicyError = validateCampaignPreferencePolicy(
                campaign.category,
                campaign.eventType,
                campaign.channelPolicy,
            );
            if (preferencePolicyError) {
                return context.json({ error: preferencePolicyError }, 400);
            }

            const { userId } = context.get('authContext');
            const enqueued = await enqueueNotificationCampaign({
                id,
                requestedByUserId: userId,
                scheduledAt,
            });
            return context.json(
                { campaign: enqueued, fanout: 'deferred' },
                200,
            );
        },
    )
    .post(
        '/campaigns/:id/cancel',
        describeRoute({
            description:
                'Cancel a draft, scheduled, or queued bulk notification campaign before delivery fan-out starts.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('param', z.object({ id: z.string().min(1) })),
        async (context) => {
            const disabledResponse = bulkCampaignsDisabledResponse(context);
            if (disabledResponse) return disabledResponse;

            const { id } = context.req.valid('param');
            const campaign = await getNotificationCampaign(id);
            if (!campaign) {
                return context.json({ error: 'Campaign not found' }, 404);
            }

            if (
                campaign.status !== 'draft' &&
                campaign.status !== 'scheduled' &&
                campaign.status !== 'queued'
            ) {
                return context.json(
                    {
                        error: `Campaign cannot be cancelled from ${campaign.status}`,
                    },
                    409,
                );
            }

            const { userId } = context.get('authContext');
            const cancelled = await cancelNotificationCampaign({
                id,
                cancelledByUserId: userId,
            });
            return context.json({ campaign: cancelled }, 200);
        },
    )
    .get(
        '/',
        describeRoute({
            description:
                'Get notifications for a user. This will return a list of notifications for the specified user and current account.',
        }),
        authValidator([...notificationCenterRoles]),
        zValidator(
            'query',
            z.object({
                userId: z.string(),
                read: z
                    .string()
                    .optional()
                    .transform((val) =>
                        val === 'true'
                            ? true
                            : val === 'false'
                              ? false
                              : undefined,
                    ),
                page: z
                    .string()
                    .optional()
                    .transform((val) => (val ? parseInt(val, 10) : 0)),
                limit: z
                    .string()
                    .optional()
                    .transform((val) => (val ? parseInt(val, 10) : 10)),
            }),
        ),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const {
                userId: reqUser,
                read,
                page,
                limit,
            } = context.req.valid('query');
            if (reqUser && reqUser !== userId) {
                return context.json(
                    { error: 'Unauthorized access to notifications' },
                    403,
                );
            }

            const notifications = await getNotificationsForCenter({
                accountId,
                userId,
                read: read ?? false,
                page,
                limit,
            });
            return context.json(notifications, 200);
        },
    )
    .put(
        '/',
        describeRoute({ description: 'Update notifications read status' }),
        authValidator([...notificationCenterRoles]),
        zValidator(
            'json',
            z.object({
                notificationIds: z
                    .array(z.string())
                    .describe(
                        'List of notification IDs to update. If not provided, all notifications will be updated.',
                    ),
                read: z
                    .string()
                    .transform((val) =>
                        val === 'true'
                            ? true
                            : val === 'false'
                              ? false
                              : undefined,
                    ),
                readWhere: z
                    .string()
                    .optional()
                    .describe(
                        'Where the notification was read (e.g., "dashboard", "email"). Required if read is set to true.',
                    ),
            }),
        ),
        async (context) => {
            const { read, readWhere, notificationIds } =
                context.req.valid('json');
            if (!read || !readWhere)
                return context.json(
                    { error: 'Missing read or readWhere' },
                    400,
                );

            const { accountId, userId } = context.get('authContext');
            await setAllNotificationsRead(
                accountId,
                userId,
                notificationIds,
                read,
                readWhere,
            );

            return context.json({ success: true });
        },
    )
    .patch(
        '/:id',
        describeRoute({ description: 'Change notification' }),
        authValidator([...notificationCenterRoles]),
        zValidator('param', z.object({ id: z.string() })),
        zValidator(
            'json',
            z.object({
                read: z
                    .string()
                    .optional()
                    .transform((val) =>
                        val === 'true'
                            ? true
                            : val === 'false'
                              ? false
                              : undefined,
                    ),
                readWhere: z
                    .string()
                    .optional()
                    .describe(
                        'Where the notification was read (e.g., "dashboard", "email")',
                    ),
            }),
        ),
        async (context) => {
            const { id } = context.req.valid('param');
            const { read, readWhere } = context.req.valid('json');
            if (!id || !readWhere)
                return context.json({ error: 'Missing id or readWhere' }, 400);

            const notification = await getNotification(id);
            if (!notification) {
                return context.json({ error: 'Notification not found' }, 404);
            }

            const { accountId, userId } = context.get('authContext');
            if (
                notification.accountId !== accountId ||
                (notification.userId !== null && notification.userId !== userId)
            ) {
                // Keep absent and out-of-scope IDs indistinguishable so this
                // endpoint cannot be used as a cross-account existence oracle.
                return context.json({ error: 'Notification not found' }, 404);
            }

            if (typeof read === 'boolean') {
                if (read && !readWhere) {
                    return context.json(
                        {
                            error: 'readWhere is required when marking notification as read',
                        },
                        400,
                    );
                }
                await setNotificationRead(id, read, readWhere);
            }

            return context.json({ success: true });
        },
    )
    .get(
        '/preferences',
        describeRoute({ description: 'Get notification preferences for user' }),
        authValidator([...notificationCenterRoles]),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const preferences =
                await storage().query.notificationUserChannelPreferences.findMany(
                    {
                        where: (preference, { and, eq, isNull, or }) =>
                            and(
                                eq(preference.userId, userId),
                                or(
                                    isNull(preference.accountId),
                                    eq(preference.accountId, accountId),
                                ),
                            ),
                    },
                );

            return context.json({ preferences }, 200);
        },
    )
    .put(
        '/preferences',
        describeRoute({ description: 'Upsert notification preferences' }),
        authValidator([...notificationCenterRoles]),
        zValidator(
            'json',
            z.object({
                preferences: z.array(notificationPreferenceUpdateSchema),
            }),
        ),
        async (context) => {
            const { preferences } = context.req.valid('json');
            const disabledResponse = premiumControlsDisabledResponse(
                context,
                preferences,
            );
            if (disabledResponse) return disabledResponse;

            const { userId, accountId } = context.get('authContext');
            for (const preference of preferences) {
                const effectiveAccountId =
                    preference.scope === 'account' ? accountId : null;
                await storage()
                    .insert(notificationUserChannelPreferences)
                    .values({
                        userId,
                        accountId: effectiveAccountId,
                        scope: preference.scope,
                        category: preference.category,
                        channel: preference.channel,
                        enabled: preference.enabled,
                        quietHoursStartMinute:
                            preference.quietHoursStartMinute ?? null,
                        quietHoursEndMinute:
                            preference.quietHoursEndMinute ?? null,
                        timezone: preference.timezone,
                        digestFrequency: preference.digestFrequency ?? 'off',
                    })
                    .onConflictDoUpdate({
                        target:
                            preference.scope === 'account'
                                ? [
                                      notificationUserChannelPreferences.userId,
                                      notificationUserChannelPreferences.accountId,
                                      notificationUserChannelPreferences.category,
                                      notificationUserChannelPreferences.channel,
                                  ]
                                : [
                                      notificationUserChannelPreferences.userId,
                                      notificationUserChannelPreferences.category,
                                      notificationUserChannelPreferences.channel,
                                  ],
                        targetWhere:
                            preference.scope === 'account'
                                ? sql`"scope" = 'account'`
                                : sql`"scope" = 'global'`,
                        set: {
                            enabled: preference.enabled,
                            quietHoursStartMinute:
                                preference.quietHoursStartMinute ?? null,
                            quietHoursEndMinute:
                                preference.quietHoursEndMinute ?? null,
                            timezone: preference.timezone,
                            ...(preference.digestFrequency === undefined
                                ? {}
                                : {
                                      digestFrequency:
                                          preference.digestFrequency,
                                  }),
                            updatedAt: new Date(),
                        },
                    });
            }

            return context.json({ success: true }, 200);
        },
    )
    .post(
        '/devices',
        describeRoute({
            description:
                'Upsert the current authenticated user push device subscription.',
            security: authSecurity,
        }),
        authValidator([...notificationCenterRoles]),
        zValidator('json', pushDeviceUpsertSchema),
        async (context) => {
            const payload = context.req.valid('json');
            const { accountId, userId } = context.get('authContext');
            const now = new Date();
            const requestUserAgent = context.req.header('user-agent')?.trim();
            const userAgent =
                payload.userAgent ??
                (requestUserAgent ? requestUserAgent.slice(0, 1024) : null);

            const result = await storage()
                .insert(webPushSubscriptions)
                .values({
                    id: randomUUID(),
                    accountId,
                    userId,
                    endpoint: payload.endpoint,
                    p256dh: payload.keys.p256dh,
                    auth: payload.keys.auth,
                    enabled: payload.permissionState === 'granted',
                    deviceId: payload.deviceId ?? null,
                    deviceLabel: payload.deviceLabel ?? null,
                    browserName: payload.browserName ?? null,
                    browserVersion: payload.browserVersion ?? null,
                    platform: payload.platform ?? null,
                    userAgent,
                    locale: payload.locale ?? null,
                    timezone: payload.timezone ?? null,
                    permissionState: payload.permissionState,
                    failCount: 0,
                    lastSeenAt: now,
                    lastFailureAt: null,
                    lastFailureCode: null,
                    lastFailureReason: null,
                    revokedAt: null,
                    revokedReason: null,
                    updatedAt: now,
                })
                .onConflictDoUpdate({
                    target: webPushSubscriptions.endpoint,
                    set: {
                        accountId,
                        userId,
                        p256dh: payload.keys.p256dh,
                        auth: payload.keys.auth,
                        enabled: payload.permissionState === 'granted',
                        deviceId: payload.deviceId ?? null,
                        deviceLabel: payload.deviceLabel ?? null,
                        browserName: payload.browserName ?? null,
                        browserVersion: payload.browserVersion ?? null,
                        platform: payload.platform ?? null,
                        userAgent,
                        locale: payload.locale ?? null,
                        timezone: payload.timezone ?? null,
                        permissionState: payload.permissionState,
                        failCount: 0,
                        lastSeenAt: now,
                        lastFailureAt: null,
                        lastFailureCode: null,
                        lastFailureReason: null,
                        revokedAt: null,
                        revokedReason: null,
                        updatedAt: now,
                    },
                })
                .returning();

            const device = result[0];
            if (!device) {
                return context.json(
                    { error: 'Push device was not saved' },
                    500,
                );
            }

            return context.json({ device: pushDeviceResponse(device) }, 200);
        },
    )
    .get(
        '/devices',
        describeRoute({
            description:
                'List push devices for the current authenticated user/account.',
            security: authSecurity,
        }),
        authValidator([...notificationCenterRoles]),
        async (context) => {
            const { userId, accountId } = context.get('authContext');
            const devices = await storage().query.webPushSubscriptions.findMany(
                {
                    where: (subscription, { and, eq }) =>
                        and(
                            eq(subscription.userId, userId),
                            eq(subscription.accountId, accountId),
                        ),
                    orderBy: (subscription, { desc }) => [
                        desc(subscription.updatedAt),
                    ],
                },
            );

            return context.json(
                {
                    devices: devices.map((device) =>
                        pushDeviceResponse(device),
                    ),
                },
                200,
            );
        },
    )
    .patch(
        '/devices/:id',
        describeRoute({ description: 'Update push device metadata' }),
        authValidator([...notificationCenterRoles]),
        zValidator('param', z.object({ id: z.string() })),
        zValidator(
            'json',
            z.object({
                deviceLabel: z.string().min(1).optional(),
                enabled: z.boolean().optional(),
                permissionState: z
                    .enum(['default', 'granted', 'denied'])
                    .optional(),
            }),
        ),
        async (context) => {
            const { id } = context.req.valid('param');
            const { accountId, userId } = context.get('authContext');
            const existing =
                await storage().query.webPushSubscriptions.findFirst({
                    where: (subscription, { eq }) => eq(subscription.id, id),
                });
            if (
                !existing ||
                existing.userId !== userId ||
                existing.accountId !== accountId
            ) {
                return context.json({ error: 'Device not found' }, 404);
            }
            const data = normalizePushDevicePatch(
                existing,
                context.req.valid('json'),
            );
            if (!data) {
                return context.json(
                    {
                        error: 'A valid browser subscription is required to enable this device',
                    },
                    409,
                );
            }
            await storage()
                .insert(webPushSubscriptions)
                .values({
                    ...existing,
                    ...data,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: webPushSubscriptions.endpoint,
                    set: {
                        ...data,
                        updatedAt: new Date(),
                    },
                });
            return context.json({ success: true }, 200);
        },
    )
    .delete(
        '/devices/:id',
        describeRoute({ description: 'Revoke a push device' }),
        authValidator([...notificationCenterRoles]),
        zValidator('param', z.object({ id: z.string() })),
        async (context) => {
            const { id } = context.req.valid('param');
            const { accountId, userId } = context.get('authContext');
            const existing =
                await storage().query.webPushSubscriptions.findFirst({
                    where: (subscription, { and, eq }) =>
                        and(
                            eq(subscription.id, id),
                            eq(subscription.userId, userId),
                            eq(subscription.accountId, accountId),
                        ),
                });
            if (!existing) {
                return context.json({ error: 'Device not found' }, 404);
            }
            await storage()
                .insert(webPushSubscriptions)
                .values({
                    ...existing,
                    enabled: false,
                    revokedAt: new Date(),
                    revokedReason: 'user_revoked',
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: webPushSubscriptions.endpoint,
                    set: {
                        enabled: false,
                        revokedAt: new Date(),
                        revokedReason: 'user_revoked',
                        updatedAt: new Date(),
                    },
                });

            return context.json({ success: true }, 200);
        },
    )
    .get(
        '/push-status',
        describeRoute({
            description:
                'Get current push status/capability for authenticated user',
        }),
        authValidator([...notificationCenterRoles]),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const subscriptions =
                await storage().query.webPushSubscriptions.findMany({
                    where: (subscription, { and, eq }) =>
                        and(
                            eq(subscription.userId, userId),
                            eq(subscription.accountId, accountId),
                        ),
                });
            const hasNonRevokedSubscription = subscriptions.some(
                (subscription) => !subscription.revokedAt,
            );
            const hasDeniedSubscription = subscriptions.some(
                (subscription) =>
                    !subscription.revokedAt &&
                    subscription.permissionState === 'denied',
            );
            const hasDeliverableSubscription = subscriptions.some(
                isDeliverablePushSubscription,
            );
            const status = hasDeliverableSubscription
                ? 'subscribed'
                : !hasNonRevokedSubscription
                  ? 'unsubscribed'
                  : hasDeniedSubscription
                    ? 'denied'
                    : 'disabled';
            return context.json(
                { status, hasDevices: hasNonRevokedSubscription },
                200,
            );
        },
    )
    .post(
        '/events',
        describeRoute({
            description:
                'Record authenticated Web Push click and dismissal events.',
            security: authSecurity,
        }),
        authValidator([...notificationCenterRoles]),
        zValidator('json', pushNotificationEventSchema),
        async (context) => {
            const payload = context.req.valid('json');
            const { accountId, userId } = context.get('authContext');
            const attempt =
                await storage().query.notificationDeliveryAttempts.findFirst({
                    where: (deliveryAttempt, { and, eq }) =>
                        and(
                            eq(
                                deliveryAttempt.notificationId,
                                payload.notificationId,
                            ),
                            eq(deliveryAttempt.channel, 'push'),
                            eq(deliveryAttempt.userId, userId),
                            eq(deliveryAttempt.accountId, accountId),
                            payload.deliveryAttemptId
                                ? eq(
                                      deliveryAttempt.id,
                                      payload.deliveryAttemptId,
                                  )
                                : undefined,
                        ),
                    orderBy: (deliveryAttempt, { desc }) => [
                        desc(deliveryAttempt.acceptedAt),
                        desc(deliveryAttempt.attemptedAt),
                        desc(deliveryAttempt.createdAt),
                    ],
                });

            if (!attempt) {
                console.warn(
                    'Rejected Web Push event without matching attempt',
                    {
                        accountId,
                        deliveryAttemptId: payload.deliveryAttemptId,
                        notificationId: payload.notificationId,
                        type: payload.type,
                        userId,
                    },
                );
                return context.json(
                    { error: 'Delivery attempt not found' },
                    404,
                );
            }

            await recordNotificationDeliveryEvent({
                deliveryAttemptId: attempt.id,
                metadata: pushNotificationEventMetadata(payload),
                notificationId: payload.notificationId,
                occurredAt: payload.at ? new Date(payload.at) : undefined,
                type: payload.type,
            });

            return context.json(
                {
                    success: true,
                    deliveryAttemptId: attempt.id,
                    notificationId: payload.notificationId,
                    type: payload.type,
                },
                200,
            );
        },
    )
    .post(
        '/test',
        describeRoute({
            description:
                'Send a user-triggered test notification (rate limited)',
        }),
        authValidator([...notificationCenterRoles]),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const now = Date.now();
            const last = testNotificationRateLimit.get(userId) ?? 0;
            if (now - last < TEST_NOTIFICATION_WINDOW_MS) {
                return context.json({ error: 'Rate limit exceeded' }, 429);
            }
            testNotificationRateLimit.set(userId, now);
            const result = await createAndSendTestWebPushNotification({
                accountId,
                userId,
            });
            return context.json({ success: true, ...result }, 200);
        },
    );

export default app;
