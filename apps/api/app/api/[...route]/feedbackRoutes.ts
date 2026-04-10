import { createFeedback, getFeedbacks } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { getPostHogClient } from '../../../lib/posthog-server';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description: 'Get all feedback',
        }),
        authValidator(['admin']),
        async (context) => {
            const feedbacks = await getFeedbacks();
            return context.json(feedbacks);
        },
    )
    .post(
        '/',
        describeRoute({
            description: 'Create a new feedback',
        }),
        zValidator(
            'json',
            z.object({
                topic: z.string().nonempty(),
                data: z.any().nullable().optional(),
                score: z.string().nullable().optional(),
                comment: z.string().nullable().optional(),
            }),
        ),
        async (context) => {
            const feedback = context.req.valid('json');
            const id = await createFeedback(feedback);
            getPostHogClient().capture({
                distinctId: 'anonymous',
                event: 'feedback_submitted',
                properties: {
                    topic: feedback.topic,
                    score: feedback.score ?? undefined,
                },
            });
            return context.json({ id });
        },
    );

export default app;
