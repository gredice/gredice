import { Hono } from 'hono';
import { z } from 'zod';
import { validator as zValidator } from 'hono-openapi/zod';
import { getNotification, getNotificationsByAccount, getNotificationsByUser, setAllNotificationsRead, setNotificationRead } from '@gredice/storage';
import { describeRoute } from 'hono-openapi';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({ description: 'Get notifications for a user. This will return a list of notifications for the specified user and current account.' }),
        authValidator(['user', 'admin']),
        zValidator('query', z.object({
            userId: z.string(),
            read: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
            page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 0),
            limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10)
        })),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { userId: reqUser, read, page, limit } = context.req.valid('query');
            if (reqUser && reqUser !== userId) {
                return context.json({ error: 'Unauthorized access to notifications' }, 403);
            }

            const [userNotifications, accountNotifications] = await Promise.all([
                getNotificationsByUser(userId, read ?? false, page, limit),
                getNotificationsByAccount(accountId, read ?? false, page, limit)
            ]);

            return context.json(userNotifications.concat(accountNotifications), 200);
        }
    )
    .put(
        '/',
        describeRoute({ description: 'Update notifications read status' }),
        authValidator(['user', 'admin']),
        zValidator('json', z.object({
            notificationIds: z
                .array(z.string())
                .describe('List of notification IDs to update. If not provided, all notifications will be updated.'),
            read: z.string().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
            readWhere: z.string().optional().describe('Where the notification was read (e.g., "dashboard", "email"). Required if read is set to true.')
        })),
        async (context) => {
            const { read, readWhere, notificationIds } = context.req.valid('json');
            if (!read || !readWhere) return context.json({ error: 'Missing read or readWhere' }, 400);

            const { accountId, userId } = context.get('authContext');
            await setAllNotificationsRead(
                accountId,
                userId,
                notificationIds,
                read,
                readWhere
            );

            return context.json({ success: true });
        }
    )
    .patch(
        '/:id',
        describeRoute({ description: 'Change notification' }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ id: z.string() })),
        zValidator('json', z.object({
            read: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
            readWhere: z.string().optional().describe('Where the notification was read (e.g., "dashboard", "email")')
        })),
        async (context) => {
            const { id } = context.req.valid('param');
            const { read, readWhere } = context.req.valid('json');
            if (!id || !readWhere) return context.json({ error: 'Missing id or readWhere' }, 400);

            const notification = await getNotification(id);
            if (!notification) {
                return context.json({ error: 'Notification not found' }, 404);
            }

            const { accountId, userId } = context.get('authContext');
            if (notification.accountId !== accountId && (!notification.userId || notification.userId !== userId)) {
                return context.json({ error: 'Unauthorized access to notification' }, 403);
            }

            if (typeof read === 'boolean') {
                if (read && !readWhere) {
                    return context.json({ error: 'readWhere is required when marking notification as read' }, 400);
                }
                await setNotificationRead(id, read, readWhere);
            }

            return context.json({ success: true });
        }
    );

export default app;
