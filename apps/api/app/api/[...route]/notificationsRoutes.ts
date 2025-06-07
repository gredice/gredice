import { Hono } from 'hono';
import { z } from 'zod';
import { validator as zValidator } from 'hono-openapi/zod';
import { createNotification, getNotificationsByUser, markNotificationRead } from '@gredice/storage';
import { describeRoute } from 'hono-openapi';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({ description: 'Get notifications for a user' }),
        authValidator(['user', 'admin']),
        zValidator('query', z.object({
            userId: z.string(),
            read: z.string().optional(),
        })),
        async (c) => {
            const { userId, read } = c.req.valid('query');
            const notifications = await getNotificationsByUser(userId, read === undefined ? undefined : read === 'true');
            return c.json(notifications);
        }
    )
    .post(
        '/',
        describeRoute({ description: 'Create a notification' }),
        authValidator(['user', 'admin']),
        async (c) => {
            const data = await c.req.json();
            const notification = await createNotification(data);
            return c.json(notification, 201);
        }
    )
    .patch(
        '/:id/read',
        describeRoute({ description: 'Mark notification as read' }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ id: z.string() })),
        zValidator('json', z.object({ readWhere: z.any() })),
        async (c) => {
            const { id } = c.req.valid('param');
            const { readWhere } = c.req.valid('json');
            if (!id || !readWhere) return c.json({ error: 'Missing id or readWhere' }, 400);
            await markNotificationRead(id, readWhere);
            return c.json({ success: true });
        }
    );

export default app;
