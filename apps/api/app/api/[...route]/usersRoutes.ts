import { Hono } from 'hono';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { createJwt, setCookie, withAuth } from '../../../lib/auth/auth';
import { getUser } from '@gredice/storage';
import { describeRoute } from 'hono-openapi';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/current',
        describeRoute({
            description: 'Get the current user',
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
                displayName: dbUser.userName, // TODO: Replace with display name when added to schema
                createdAt: dbUser.createdAt,
            });
        })
    .post(
        '/:userId/impersonate',
        describeRoute({
            description: 'Impersonate a user',
        }),
        zValidator(
            "param",
            z.object({
                userId: z.string(),
            })
        ),
        async (context) => {
            const { userId } = context.req.valid('param');
            return await withAuth(['admin'], async () => {
                await setCookie(context, createJwt(userId));
                return new Response(null, { status: 200 });
            });
        });

export default app;