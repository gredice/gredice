import { subscribeNewsletter } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';

const app = new Hono().post(
    '/subscribe',
    describeRoute({
        description: 'Subscribe an email address to the newsletter list.',
    }),
    zValidator(
        'json',
        z.object({
            email: z.string().email(),
            source: z.string().optional(),
        }),
    ),
    async (context) => {
        const { email, source } = context.req.valid('json');

        try {
            await subscribeNewsletter(email, source);
        } catch (error) {
            console.error('Newsletter subscription failed', error);
            return context.json(
                { error: 'Unable to subscribe to the newsletter.' },
                { status: 400 },
            );
        }

        return context.json({ success: true });
    },
);

export default app;
