import {
    archiveSurvey,
    createSurveyDefinition,
    createSurveyDraftVersion,
    createSurveySend,
    getSurveyAdminDetails,
    getSurveyAssignmentRuntime,
    getSurveyResultsAdmin,
    listAssignedSurveysForUser,
    listSurveysAdmin,
    previewSurveyAudience,
    publishSurveyVersion,
    seedDeliverySatisfactionSurveyDefinition,
    startSurveyAssignment,
    submitSurveyResponse,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const questionSettingsSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('opinion_scale'),
        min: z.number().int().min(0).max(10),
        max: z.number().int().min(0).max(10),
        step: z.number().int().positive().optional(),
        minLabel: z.string().trim().nullable().optional(),
        maxLabel: z.string().trim().nullable().optional(),
    }),
    z.object({
        type: z.literal('long_text'),
        maxLength: z.number().int().positive().optional(),
        placeholder: z.string().trim().nullable().optional(),
    }),
    z.object({
        type: z.literal('contact_info'),
        fields: z
            .array(z.enum(['first_name', 'last_name', 'phone', 'email']))
            .min(1),
        phoneDefaultCountry: z.string().trim().nullable().optional(),
    }),
]);

const questionSchema = z.object({
    key: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(1000).nullable().optional(),
    type: z.enum(['opinion_scale', 'long_text', 'contact_info']),
    required: z.boolean().optional(),
    settings: questionSettingsSchema,
    scoreMetadata: z
        .object({
            internalScore: z.boolean().optional(),
            publicScore: z.boolean().optional(),
            npsLike: z.boolean().optional(),
        })
        .optional(),
});

const surveyDefinitionSchema = z.object({
    key: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().min(1).max(120).optional(),
    introTitle: z.string().trim().max(300).nullable().optional(),
    introDescription: z.string().trim().max(2000).nullable().optional(),
    thankYouTitle: z.string().trim().max(300).nullable().optional(),
    thankYouDescription: z.string().trim().max(2000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    questions: z.array(questionSchema).min(1).max(50),
});

const surveyVersionDraftSchema = surveyDefinitionSchema.omit({
    key: true,
    category: true,
});

const audienceSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('accounts'),
        accountIds: z.array(z.string().trim().min(1)).min(1).max(500),
    }),
    z.object({
        type: z.literal('users'),
        userIds: z.array(z.string().trim().min(1)).min(1).max(1000),
        accountIds: z
            .array(z.string().trim().min(1))
            .min(1)
            .max(500)
            .optional(),
    }),
    z.object({
        type: z.literal('explicit'),
        recipients: z
            .array(
                z.object({
                    accountId: z.string().trim().min(1),
                    userId: z.string().trim().min(1).nullable().optional(),
                }),
            )
            .min(1)
            .max(1000),
    }),
]);

const sendSchema = z.object({
    surveyId: z.string().trim().min(1).optional(),
    surveyKey: z.string().trim().min(1).optional(),
    versionId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).max(200),
    audience: audienceSchema,
    channelPolicy: z.object({
        inApp: z.boolean().default(true),
        email: z.boolean().default(false),
    }),
    contextKey: z.string().trim().min(1).max(240),
    context: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    scheduledAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
});

const submitAnswerSchema = z.object({
    questionId: z.string().trim().min(1).optional(),
    questionKey: z.string().trim().min(1).optional(),
    value: z.unknown().optional(),
});

function responseForSubmitStatus(status: string) {
    switch (status) {
        case 'not_found':
            return 404;
        case 'unauthorized':
            return 403;
        case 'expired':
        case 'already_submitted':
            return 409;
        case 'invalid':
            return 400;
        default:
            return 400;
    }
}

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/assignments',
        describeRoute({
            description:
                'List pending and started surveys assigned to the current user and account.',
            security: authSecurity,
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const assignments = await listAssignedSurveysForUser({
                accountId,
                userId,
            });
            return context.json({ assignments }, 200);
        },
    )
    .get(
        '/assignments/:assignmentId',
        describeRoute({
            description:
                'Load an assigned survey version and ordered questions for the current user.',
            security: authSecurity,
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'param',
            z.object({ assignmentId: z.string().trim().min(1) }),
        ),
        async (context) => {
            const { assignmentId } = context.req.valid('param');
            const { accountId, userId } = context.get('authContext');
            const runtime = await getSurveyAssignmentRuntime({
                accountId,
                assignmentId,
                markOpened: true,
                userId,
            });
            if (!runtime) {
                return context.json(
                    { error: 'Survey assignment not found' },
                    404,
                );
            }
            return context.json(runtime, 200);
        },
    )
    .post(
        '/assignments/:assignmentId/start',
        describeRoute({
            description:
                'Mark a pending assigned survey as started for the current user.',
            security: authSecurity,
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'param',
            z.object({ assignmentId: z.string().trim().min(1) }),
        ),
        async (context) => {
            const { assignmentId } = context.req.valid('param');
            const { accountId, userId } = context.get('authContext');
            const assignment = await startSurveyAssignment({
                accountId,
                assignmentId,
                userId,
            });
            if (!assignment) {
                return context.json(
                    { error: 'Survey assignment not found' },
                    404,
                );
            }
            return context.json({ assignment }, 200);
        },
    )
    .post(
        '/assignments/:assignmentId/submit',
        describeRoute({
            description:
                'Submit answers for an assigned survey after validating assignment ownership and question types.',
            security: authSecurity,
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'param',
            z.object({ assignmentId: z.string().trim().min(1) }),
        ),
        zValidator(
            'json',
            z.object({
                answers: z.array(submitAnswerSchema).max(100),
                metadata: z.record(z.string(), z.unknown()).optional(),
            }),
        ),
        async (context) => {
            const { assignmentId } = context.req.valid('param');
            const payload = context.req.valid('json');
            const { accountId, userId } = context.get('authContext');
            const result = await submitSurveyResponse({
                accountId,
                answers: payload.answers,
                assignmentId,
                metadata: payload.metadata,
                userId,
            });
            if (!result.ok) {
                return context.json(
                    result,
                    responseForSubmitStatus(result.status),
                );
            }
            return context.json(result, 201);
        },
    )
    .get(
        '/admin',
        describeRoute({
            description:
                'List survey definitions with version, assignment, and response counts for admins.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        async (context) => {
            const surveys = await listSurveysAdmin();
            return context.json({ surveys }, 200);
        },
    )
    .post(
        '/admin/definitions',
        describeRoute({
            description:
                'Create a draft survey definition with the first version and ordered questions.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('json', surveyDefinitionSchema),
        async (context) => {
            const payload = context.req.valid('json');
            const { userId } = context.get('authContext');
            const created = await createSurveyDefinition({
                ...payload,
                createdByUserId: userId,
            });
            return context.json(created, 201);
        },
    )
    .post(
        '/admin/delivery-satisfaction/seed',
        describeRoute({
            description:
                'Create or return the delivery satisfaction survey definition based on the current Typeform contract.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator(
            'json',
            z
                .object({ publish: z.boolean().optional() })
                .optional()
                .default({}),
        ),
        async (context) => {
            const { publish } = context.req.valid('json');
            const { userId } = context.get('authContext');
            const survey = await seedDeliverySatisfactionSurveyDefinition({
                createdByUserId: userId,
                publish,
            });
            return context.json({ survey }, 200);
        },
    )
    .post(
        '/admin/audience/preview',
        describeRoute({
            description:
                'Preview survey recipients for an admin-selected user/account audience.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('json', z.object({ audience: audienceSchema })),
        async (context) => {
            const { audience } = context.req.valid('json');
            const preview = await previewSurveyAudience(audience);
            return context.json({ preview }, 200);
        },
    )
    .post(
        '/admin/sends',
        describeRoute({
            description:
                'Create a survey send and duplicate-safe assignments for an admin-selected audience.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('json', sendSchema),
        async (context) => {
            const payload = context.req.valid('json');
            const { accountId, userId } = context.get('authContext');
            const send = await createSurveySend({
                ...payload,
                createdByUserId: userId,
                createdFromAccountId: accountId,
            });
            return context.json(send, 201);
        },
    )
    .get(
        '/admin/:surveyId',
        describeRoute({
            description:
                'Get survey definition details, versions, sends, recent assignments, and admin result summary.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('param', z.object({ surveyId: z.string().trim().min(1) })),
        async (context) => {
            const { surveyId } = context.req.valid('param');
            const details = await getSurveyAdminDetails(surveyId);
            if (!details) {
                return context.json({ error: 'Survey not found' }, 404);
            }
            return context.json(details, 200);
        },
    )
    .post(
        '/admin/:surveyId/versions',
        describeRoute({
            description:
                'Create a new draft survey version with ordered questions for an existing survey.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('param', z.object({ surveyId: z.string().trim().min(1) })),
        zValidator('json', surveyVersionDraftSchema),
        async (context) => {
            const { surveyId } = context.req.valid('param');
            const payload = context.req.valid('json');
            const versionId = await createSurveyDraftVersion(surveyId, payload);
            return context.json({ versionId }, 201);
        },
    )
    .post(
        '/admin/:surveyId/versions/:versionId/publish',
        describeRoute({
            description:
                'Publish a survey version and make it the active immutable version for new assignments.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator(
            'param',
            z.object({
                surveyId: z.string().trim().min(1),
                versionId: z.string().trim().min(1),
            }),
        ),
        async (context) => {
            const { surveyId, versionId } = context.req.valid('param');
            await publishSurveyVersion({ surveyId, versionId });
            return context.json({ success: true }, 200);
        },
    )
    .post(
        '/admin/:surveyId/archive',
        describeRoute({
            description:
                'Archive a survey definition without deleting historical assignments, responses, or answers.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('param', z.object({ surveyId: z.string().trim().min(1) })),
        async (context) => {
            const { surveyId } = context.req.valid('param');
            await archiveSurvey(surveyId);
            return context.json({ success: true }, 200);
        },
    )
    .get(
        '/admin/:surveyId/results',
        describeRoute({
            description:
                'Get admin-only survey response details and numeric aggregates, optionally filtered by version and delivery month.',
            security: authSecurity,
        }),
        authValidator(['admin']),
        zValidator('param', z.object({ surveyId: z.string().trim().min(1) })),
        zValidator(
            'query',
            z.object({
                versionId: z.string().trim().min(1).optional(),
                monthKey: z.string().trim().min(1).optional(),
                from: z.coerce.date().optional(),
                to: z.coerce.date().optional(),
            }),
        ),
        async (context) => {
            const { surveyId } = context.req.valid('param');
            const query = context.req.valid('query');
            const results = await getSurveyResultsAdmin({
                surveyId,
                versionId: query.versionId,
                monthKey: query.monthKey,
                from: query.from,
                to: query.to,
            });
            if (!results) {
                return context.json({ error: 'Survey not found' }, 404);
            }
            return context.json(results, 200);
        },
    );

export default app;
