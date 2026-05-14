import {
    getNotification,
    getNotificationsByAccount,
    getNotificationsByUser,
    notificationUserChannelPreferences,
    setAllNotificationsRead,
    setNotificationRead,
    sql,
    storage,
    webPushSubscriptions,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const testNotificationRateLimit = new Map<string, number>();
const TEST_NOTIFICATION_WINDOW_MS = 5 * 60 * 1000;

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description:
                'Get notifications for a user. This will return a list of notifications for the specified user and current account.',
        }),
        authValidator(['user', 'admin']),
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

            const [userNotifications, accountNotifications] = await Promise.all(
                [
                    getNotificationsByUser(userId, read ?? false, page, limit),
                    getNotificationsByAccount(
                        accountId,
                        read ?? false,
                        page,
                        limit,
                    ),
                ],
            );

            // Deduplicate notifications by ID to prevent duplicates when a notification
            // has both userId and accountId set
            const allNotifications =
                userNotifications.concat(accountNotifications);
            const uniqueNotifications = Array.from(
                new Map(allNotifications.map((n) => [n.id, n])).values(),
            );

            return context.json(uniqueNotifications, 200);
        },
    )
    .put(
        '/',
        describeRoute({ description: 'Update notifications read status' }),
        authValidator(['user', 'admin']),
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
        authValidator(['user', 'admin']),
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
                notification.accountId !== accountId &&
                (!notification.userId || notification.userId !== userId)
            ) {
                return context.json(
                    { error: 'Unauthorized access to notification' },
                    403,
                );
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
        authValidator(['user', 'admin']),
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
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({
                preferences: z.array(
                    z.object({
                        scope: z.enum(['global', 'account']),
                        category: z.string().min(1),
                        channel: z.enum(['in_app', 'email', 'push', 'sms']),
                        enabled: z.boolean(),
                        quietHoursStartMinute: z
                            .number()
                            .int()
                            .min(0)
                            .max(1439)
                            .nullable()
                            .optional(),
                        quietHoursEndMinute: z
                            .number()
                            .int()
                            .min(0)
                            .max(1439)
                            .nullable()
                            .optional(),
                    }),
                ),
            }),
        ),
        async (context) => {
            const { userId, accountId } = context.get('authContext');
            const { preferences } = context.req.valid('json');
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
                            updatedAt: new Date(),
                        },
                    });
            }

            return context.json({ success: true }, 200);
        },
    )
    .get(
        '/devices',
        describeRoute({ description: 'List push devices for user/account' }),
        authValidator(['user', 'admin']),
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

            return context.json({ devices }, 200);
        },
    )
    .patch(
        '/devices/:id',
        describeRoute({ description: 'Update push device metadata' }),
        authValidator(['user', 'admin']),
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
            const data = context.req.valid('json');
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
        authValidator(['user', 'admin']),
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
        authValidator(['user', 'admin']),
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
            const hasEnabledSubscription = subscriptions.some(
                (subscription) =>
                    !subscription.revokedAt && subscription.enabled,
            );
            const status = !hasNonRevokedSubscription
                ? 'unsubscribed'
                : hasDeniedSubscription
                  ? 'denied'
                  : hasEnabledSubscription
                    ? 'subscribed'
                    : 'disabled';
            return context.json(
                { status, hasDevices: subscriptions.length > 0 },
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
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.get('authContext');
            const now = Date.now();
            const last = testNotificationRateLimit.get(userId) ?? 0;
            if (now - last < TEST_NOTIFICATION_WINDOW_MS) {
                return context.json({ error: 'Rate limit exceeded' }, 429);
            }
            testNotificationRateLimit.set(userId, now);
            return context.json({ success: true, queued: true }, 200);
        },
    );

export default app;
