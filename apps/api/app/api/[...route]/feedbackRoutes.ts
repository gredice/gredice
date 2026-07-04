import { createFeedback, getFeedbacks, updateFeedback } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { getPostHogClient } from '../../../lib/posthog-server';

const feedbackUpdateSchema = z
    .object({
        score: z.string().nullable().optional(),
        comment: z.string().nullable().optional(),
    })
    .strict()
    .refine(
        (feedback) =>
            Object.hasOwn(feedback, 'score') ||
            Object.hasOwn(feedback, 'comment'),
        { message: 'At least one feedback field is required' },
    );

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
                data: z.unknown().nullable().optional(),
                score: z.string().nullable().optional(),
                comment: z.string().nullable().optional(),
            }),
        ),
        async (context) => {
            const feedback = context.req.valid('json');
            const id = await createFeedback(feedback);
            (await getPostHogClient()).capture({
                distinctId: 'anonymous',
                event: 'feedback_submitted',
                properties: {
                    topic: feedback.topic,
                    score: feedback.score ?? undefined,
                },
            });
            return context.json({ id });
        },
    )
    .patch(
        '/:feedbackId',
        describeRoute({
            description: 'Update an existing feedback rating or comment',
        }),
        zValidator(
            'param',
            z.object({
                feedbackId: z.string().uuid(),
            }),
        ),
        zValidator('json', feedbackUpdateSchema),
        async (context) => {
            const { feedbackId } = context.req.valid('param');
            const feedback = context.req.valid('json');
            const id = await updateFeedback(feedbackId, feedback);

            if (!id) {
                return context.json({ error: 'Feedback not found' }, 404);
            }

            return context.json({ id });
        },
    );

export default app;
