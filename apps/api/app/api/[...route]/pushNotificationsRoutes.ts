import { removePushSubscription, savePushSubscription } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const pushSubscriptionSchema = z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().optional().nullable(),
    keys: z.object({
        auth: z.string(),
        p256dh: z.string(),
    }),
});

const metadataSchema = z
    .object({
        userAgent: z.string().optional(),
        platform: z.string().optional(),
    })
    .optional();

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/public-key',
        describeRoute({
            description:
                'Returns the VAPID public key used for configuring web push subscriptions.',
        }),
        (context) => {
            const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
            if (!publicKey) {
                return context.json(
                    { error: 'Push notifications are not configured.' },
                    404,
                );
            }

            return context.json({ publicKey });
        },
    )
    .post(
        '/subscriptions',
        describeRoute({
            description:
                'Registers or updates a web push subscription for the current user.',
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({
                subscription: pushSubscriptionSchema,
                metadata: metadataSchema,
            }),
        ),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { subscription, metadata } = context.req.valid('json');

            await savePushSubscription({
                accountId,
                userId,
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                expirationTime:
                    subscription.expirationTime != null
                        ? new Date(subscription.expirationTime)
                        : null,
                userAgent: metadata?.userAgent ?? null,
                platform: metadata?.platform ?? null,
            });

            return context.json({ success: true });
        },
    )
    .delete(
        '/subscriptions',
        describeRoute({
            description:
                'Removes a web push subscription for the current user.',
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({
                endpoint: z.string().url(),
            }),
        ),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { endpoint } = context.req.valid('json');
            await removePushSubscription(endpoint, accountId);
            return context.json({ success: true });
        },
    );

export default app;
