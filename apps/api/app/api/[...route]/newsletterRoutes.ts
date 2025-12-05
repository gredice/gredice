import { subscribeToNewsletter } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';

const app = new Hono().post(
    '/subscribe',
    describeRoute({
        description: 'Subscribe to the newsletter',
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
            const subscriber = await subscribeToNewsletter({
                email,
                source,
            });
            return context.json({
                success: true,
                status: subscriber.status,
            });
        } catch (error) {
            console.error('Newsletter subscription failed:', error);
            return context.json(
                { success: false, error: 'Subscription failed' },
                500,
            );
        }
    },
);

export default app;
