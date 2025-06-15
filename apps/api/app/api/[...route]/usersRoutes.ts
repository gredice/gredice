import { Hono } from 'hono';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { getUser, updateUser } from '@gredice/storage';
import { describeRoute } from 'hono-openapi';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/current',
        describeRoute({
            description: 'Get the current user.',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.get('authContext');
            const dbUser = await getUser(userId);
            if (!dbUser) {
                return context.json({ error: 'User not found' }, { status: 404 });
            }

            return context.json({
                id: dbUser.id,
                userName: dbUser.userName,
                displayName: dbUser.displayName ?? dbUser.userName,
                avatarUrl: dbUser.avatarUrl,
                createdAt: dbUser.createdAt,
            });
        })
    .patch(
        '/:userId',
        describeRoute({
            description: 'Update a user. Only the current user can update their own information. You can submit partial information to update only specific fields.',
        }),
        zValidator(
            "param",
            z.object({
                userId: z.string(),
            })
        ),
        zValidator(
            "json",
            z.object({
                userName: z.string().optional(),
                displayName: z.string().optional(),
                avatarUrl: z.string().optional().nullable(),
            })
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.req.valid('param');
            const userInfo = context.req.valid('json');
            const { userId: authUserId } = context.get('authContext');
            if (userId !== authUserId) {
                console.warn(`User ${authUserId} tried to update user ${userId} without permission`);
                return context.json({ error: 'User not found' }, { status: 404 });
            }

            await updateUser({
                id: userId,
                ...userInfo
            });

            return context.json({ success: true });
        }
    );

export default app;