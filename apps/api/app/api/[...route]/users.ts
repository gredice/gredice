import { Hono } from 'hono';
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createJwt, setCookie, withAuth } from '../../../lib/auth/auth';
import { getUser } from '@gredice/storage';

const app = new Hono()
    .get(
        '/current',
        async (context) => {
            return await withAuth(['user', 'admin'], async (user) => {
                const dbUser = await getUser(user.userId);
                return context.json(dbUser);
            });
        })
    .post(
        '/:userId/impersonate',
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