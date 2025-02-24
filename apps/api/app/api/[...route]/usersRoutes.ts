import { Hono } from 'hono';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { createJwt, setCookie, withAuth } from '../../../lib/auth/auth';
import { getUser } from '@gredice/storage';
import { describeRoute } from 'hono-openapi';

const app = new Hono()
    .get(
        '/current',
        describeRoute({
            description: 'Get the current user',
        }),
        async (context) => await withAuth(['user', 'admin'], async (user) => {
            const dbUser = await getUser(user.userId);
            return context.json(dbUser);
        }))
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