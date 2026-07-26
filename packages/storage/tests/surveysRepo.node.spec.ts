import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accounts,
    accountUsers,
    buildNumericAggregates,
    createSurveyAssignments,
    createSurveyDefinition,
    createSurveyDraftVersion,
    createSurveySend,
    DELIVERY_SATISFACTION_SURVEY_KEY,
    getPublishedSurveyVersionByKey,
    getSurveyAssignmentRuntime,
    getSurveyQuestions,
    getSurveyResponseAdmin,
    getSurveyResponsePageAdmin,
    getSurveyResultsAdmin,
    getSurveyWorkspaceAdminDetails,
    previewSurveyAudience,
    publishSurveyVersion,
    seedDeliverySatisfactionSurveyDefinition,
    storage,
    submitSurveyResponse,
    surveyResponses,
    users,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';

async function createTestUser() {
    const userId = randomUUID();
    const accountId = randomUUID();
    const email = `survey-${userId}@example.com`;
    await storage().insert(accounts).values({ id: accountId });
    await storage().insert(users).values({
        id: userId,
        userName: email,
        displayName: 'Survey Test User',
        role: 'user',
    });
    await storage().insert(accountUsers).values({ accountId, userId });
    return { accountId, userId };
}

async function createPublishedSurvey() {
    const { surveyId, versionId } = await createSurveyDefinition({
        key: `survey_${randomUUID()}`,
        title: 'Test survey',
        description: 'Repository test survey',
        category: 'test',
        introTitle: 'Test intro',
        introDescription: 'Test intro description',
        thankYouTitle: 'Thanks',
        thankYouDescription: 'Done',
        questions: [
            {
                key: 'score',
                title: 'Score',
                type: 'opinion_scale',
                required: true,
                settings: { type: 'opinion_scale', min: 0, max: 10 },
                scoreMetadata: { internalScore: true },
            },
            {
                key: 'comment',
                title: 'Comment',
                type: 'long_text',
                required: false,
                settings: { type: 'long_text', maxLength: 200 },
            },
            {
                key: 'contact',
                title: 'Contact',
                type: 'contact_info',
                required: false,
                settings: {
                    type: 'contact_info',
                    fields: ['first_name', 'last_name', 'phone', 'email'],
                    phoneDefaultCountry: 'HR',
                },
            },
        ],
    });
    await publishSurveyVersion({ surveyId, versionId });
    return { surveyId, versionId };
}

test('delivery satisfaction seed is idempotent and skips redundant contact questions', async () => {
    createTestDb();

    const first = await seedDeliverySatisfactionSurveyDefinition({
        publish: true,
    });
    const second = await seedDeliverySatisfactionSurveyDefinition({
        publish: true,
    });

    assert.equal(first.id, second.id);
    assert.equal(second.key, DELIVERY_SATISFACTION_SURVEY_KEY);
    assert.equal(second.status, 'published');
    assert.ok(second.activeVersionId);

    const published = await getPublishedSurveyVersionByKey(
        DELIVERY_SATISFACTION_SURVEY_KEY,
    );
    assert.ok(published);

    assert.deepEqual(
        published.questions.map((question) => ({
            key: question.key,
            required: question.required,
            sortOrder: question.sortOrder,
            type: question.type,
        })),
        [
            {
                key: 'vegetable_quality',
                required: false,
                sortOrder: 1,
                type: 'opinion_scale',
            },
            {
                key: 'delivery_speed_quality',
                required: false,
                sortOrder: 2,
                type: 'opinion_scale',
            },
            {
                key: 'team_communication',
                required: false,
                sortOrder: 3,
                type: 'opinion_scale',
            },
            {
                key: 'improvement_text',
                required: false,
                sortOrder: 4,
                type: 'long_text',
            },
        ],
    );

    const scaleSettings = published.questions
        .filter((question) => question.type === 'opinion_scale')
        .map((question) => question.settings);
    assert.equal(scaleSettings.length, 3);
    assert.ok(
        scaleSettings.every(
            (settings) =>
                settings.type === 'opinion_scale' &&
                settings.min === 0 &&
                settings.max === 10,
        ),
    );
});

test('survey audiences resolve account and user targets without duplicates', async () => {
    createTestDb();

    const first = await createTestUser();
    const second = await createTestUser();
    await storage().insert(accountUsers).values({
        accountId: first.accountId,
        userId: second.userId,
    });

    const accountPreview = await previewSurveyAudience({
        type: 'accounts',
        accountIds: [first.accountId, first.accountId],
    });
    assert.equal(accountPreview.accountCount, 1);
    assert.equal(accountPreview.userCount, 2);
    assert.equal(accountPreview.targetCount, 2);

    const explicitPreview = await previewSurveyAudience({
        type: 'explicit',
        recipients: [
            { accountId: first.accountId, userId: first.userId },
            { accountId: first.accountId, userId: first.userId },
            { accountId: first.accountId, userId: 'missing-user' },
            { accountId: second.accountId },
        ],
    });
    assert.equal(explicitPreview.explicitRecipientCount, 3);
    assert.equal(explicitPreview.unmatchedRecipientCount, 1);
    assert.deepEqual(
        explicitPreview.recipients
            .map((recipient) => ({
                accountId: recipient.accountId,
                userId: recipient.userId ?? null,
            }))
            .sort((left, right) =>
                `${left.accountId}:${left.userId ?? ''}`.localeCompare(
                    `${right.accountId}:${right.userId ?? ''}`,
                ),
            ),
        [
            { accountId: first.accountId, userId: first.userId },
            { accountId: second.accountId, userId: null },
        ].sort((left, right) =>
            `${left.accountId}:${left.userId ?? ''}`.localeCompare(
                `${right.accountId}:${right.userId ?? ''}`,
            ),
        ),
    );
});

test('survey assignments are duplicate-safe by version target and context key', async () => {
    createTestDb();

    const { surveyId, versionId } = await createPublishedSurvey();
    const { accountId, userId } = await createTestUser();

    const first = await createSurveyAssignments({
        versionId,
        contextKey: `context-${randomUUID()}`,
        context: { sourceWorkflow: 'test' },
        recipients: [{ accountId, userId }],
    });
    const second = await createSurveyAssignments({
        versionId,
        contextKey: first.assignments[0]?.assignment.contextKey ?? '',
        context: { sourceWorkflow: 'test' },
        recipients: [{ accountId, userId }],
    });

    assert.equal(first.createdCount, 1);
    assert.equal(first.skippedDuplicateCount, 0);
    assert.equal(second.createdCount, 0);
    assert.equal(second.skippedDuplicateCount, 1);
    assert.equal(
        first.assignments[0]?.assignment.id,
        second.assignments[0]?.assignment.id,
    );

    const send = await createSurveySend({
        versionId,
        name: 'Manual send',
        audience: {
            type: 'explicit',
            recipients: [{ accountId }],
        },
        channelPolicy: { inApp: true, email: false },
        contextKey: `manual-${randomUUID()}`,
        createdByUserId: userId,
        createdFromAccountId: accountId,
    });

    assert.equal(send.send.surveyId, surveyId);
    assert.equal(send.createdCount, 1);
    assert.equal(send.preview.targetCount, 1);
});

test('survey submission validates answers, prevents duplicates, and builds aggregates', async () => {
    createTestDb();

    const { surveyId, versionId } = await createPublishedSurvey();
    const { accountId, userId } = await createTestUser();
    const assignmentResult = await createSurveyAssignments({
        versionId,
        contextKey: `submit-${randomUUID()}`,
        recipients: [{ accountId, userId }],
    });
    const assignment = assignmentResult.assignments[0]?.assignment;
    assert.ok(assignment);

    const invalid = await submitSurveyResponse({
        assignmentId: assignment.id,
        accountId,
        userId,
        answers: [{ questionKey: 'score', value: 11 }],
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.status, 'invalid');

    const submitted = await submitSurveyResponse({
        assignmentId: assignment.id,
        accountId,
        userId,
        answers: [
            { questionKey: 'score', value: 8 },
            { questionKey: 'comment', value: 'Dostava je bila brza.' },
            {
                questionKey: 'contact',
                value: { firstName: 'Ana', email: 'ana@example.com' },
            },
        ],
    });
    assert.equal(submitted.ok, true);

    const duplicate = await submitSurveyResponse({
        assignmentId: assignment.id,
        accountId,
        userId,
        answers: [{ questionKey: 'score', value: 7 }],
    });
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.status, 'already_submitted');

    const runtime = await getSurveyAssignmentRuntime({
        assignmentId: assignment.id,
        accountId,
        userId,
    });
    assert.equal(runtime?.assignment.status, 'submitted');
    assert.ok(runtime.response);

    const results = await getSurveyResultsAdmin({ surveyId });
    assert.ok(results);
    assert.equal(results.responses.length, 1);
    assert.ok(
        results.responses[0]?.answers.some(
            (answer) => answer.questionKey === 'score',
        ),
    );
    const workspaceDetails = await getSurveyWorkspaceAdminDetails(surveyId);
    assert.ok(workspaceDetails);
    assert.equal('results' in workspaceDetails, false);
    assert.deepEqual(results.numericAggregates, [
        {
            versionId,
            questionId: (await getSurveyQuestions(versionId))[0]?.id,
            questionKey: 'score',
            title: 'Score',
            count: 1,
            unansweredCount: 0,
            average: 8,
            median: 8,
            distribution: { '8': 1 },
            scoreMetadata: { internalScore: true },
        },
    ]);
});

test('survey response explorer filters, paginates, and protects version ownership', async () => {
    createTestDb();

    const { surveyId, versionId: firstVersionId } =
        await createPublishedSurvey();
    const firstUser = await createTestUser();
    const secondUser = await createTestUser();

    async function createResponse({
        accountId,
        contextKey,
        monthKey,
        score,
        userId,
    }: {
        accountId: string;
        contextKey: string;
        monthKey: string;
        score: number;
        userId: string;
    }) {
        const assignmentResult = await createSurveyAssignments({
            versionId: firstVersionId,
            contextKey,
            context: {
                monthKey,
                sourceWorkflow: contextKey.includes('beta') ? 'beta' : 'alpha',
            },
            recipients: [{ accountId, userId }],
        });
        const assignment = assignmentResult.assignments[0]?.assignment;
        assert.ok(assignment);
        const submitted = await submitSurveyResponse({
            assignmentId: assignment.id,
            accountId,
            userId,
            answers: [
                { questionKey: 'score', value: score },
                { questionKey: 'comment', value: `${contextKey} comment` },
            ],
        });
        assert.equal(submitted.ok, true);
        if (!submitted.ok) {
            throw new Error('Expected survey response to be submitted');
        }
        return submitted.responseId;
    }

    const firstResponseId = await createResponse({
        accountId: firstUser.accountId,
        userId: firstUser.userId,
        contextKey: 'delivery-alpha',
        monthKey: '2026-05',
        score: 4,
    });
    const secondResponseId = await createResponse({
        accountId: secondUser.accountId,
        userId: secondUser.userId,
        contextKey: 'delivery-beta',
        monthKey: '2026-06',
        score: 6,
    });

    const secondVersionId = await createSurveyDraftVersion(surveyId, {
        title: 'Test survey v2',
        description: 'Second version',
        questions: [
            {
                key: 'score',
                title: 'Score v2',
                type: 'opinion_scale',
                required: true,
                settings: { type: 'opinion_scale', min: 1, max: 10 },
                scoreMetadata: { internalScore: true },
            },
            {
                key: 'comment',
                title: 'Comment v2',
                type: 'long_text',
                required: false,
                settings: { type: 'long_text', maxLength: 200 },
            },
        ],
    });
    await publishSurveyVersion({ surveyId, versionId: secondVersionId });
    const thirdAssignmentResult = await createSurveyAssignments({
        versionId: secondVersionId,
        contextKey: 'delivery-gamma',
        context: {
            monthKey: '2026-06',
            sourceWorkflow: 'workflow-only-token',
        },
        recipients: [
            {
                accountId: firstUser.accountId,
                userId: firstUser.userId,
            },
        ],
    });
    const thirdAssignment = thirdAssignmentResult.assignments[0]?.assignment;
    assert.ok(thirdAssignment);
    const thirdSubmitted = await submitSurveyResponse({
        assignmentId: thirdAssignment.id,
        accountId: firstUser.accountId,
        userId: firstUser.userId,
        answers: [
            { questionKey: 'score', value: 10 },
            { questionKey: 'comment', value: 'gamma comment' },
        ],
    });
    assert.equal(thirdSubmitted.ok, true);
    if (!thirdSubmitted.ok) {
        throw new Error('Expected v2 survey response to be submitted');
    }
    const thirdResponseId = thirdSubmitted.responseId;

    const firstSubmittedAt = new Date('2026-06-01T10:00:00.000Z');
    const latestSubmittedAt = new Date('2026-06-02T10:00:00.000Z');
    await Promise.all([
        storage()
            .update(surveyResponses)
            .set({
                accountId: null,
                userId: null,
                submittedAt: firstSubmittedAt,
            })
            .where(eq(surveyResponses.id, firstResponseId)),
        storage()
            .update(surveyResponses)
            .set({
                submittedAt: latestSubmittedAt,
                source: 'typeform',
                metadata: {
                    campaign: 'summer-beta',
                    literalContext: 'rate_100%',
                },
            })
            .where(eq(surveyResponses.id, secondResponseId)),
        storage()
            .update(surveyResponses)
            .set({
                submittedAt: latestSubmittedAt,
                source: 'admin_import',
                metadata: { literalContext: 'rateX100Z' },
            })
            .where(eq(surveyResponses.id, thirdResponseId)),
    ]);

    const foreignSurvey = await createPublishedSurvey();
    const allResults = await getSurveyResponsePageAdmin({
        surveyId,
        page: 1,
        pageSize: 1,
    });
    assert.ok(allResults);
    assert.equal(allResults.totalCount, 3);
    assert.equal(allResults.pageCount, 3);
    assert.equal(allResults.responses.length, 1);
    assert.ok((allResults.responses[0]?.answers.length ?? 0) > 0);
    assert.ok(
        allResults.responses[0]?.answers.every(
            ({ answer }) =>
                answer.responseId === allResults.responses[0]?.response.id,
        ),
    );

    const latestIds = [secondResponseId, thirdResponseId].sort((left, right) =>
        right.localeCompare(left),
    );
    const secondPage = await getSurveyResponsePageAdmin({
        surveyId,
        page: 2,
        pageSize: 1,
    });
    const thirdPage = await getSurveyResponsePageAdmin({
        surveyId,
        page: 3,
        pageSize: 1,
    });
    const clampedPage = await getSurveyResponsePageAdmin({
        surveyId,
        page: 999,
        pageSize: 1,
    });
    const clampedPageSize = await getSurveyResponsePageAdmin({
        surveyId,
        pageSize: 999,
    });
    assert.deepEqual(
        [
            allResults.responses[0]?.response.id,
            secondPage?.responses[0]?.response.id,
            thirdPage?.responses[0]?.response.id,
        ],
        [...latestIds, firstResponseId],
    );
    assert.equal(clampedPage?.page, 3);
    assert.equal(clampedPage?.responses[0]?.response.id, firstResponseId);
    assert.equal(clampedPageSize?.pageSize, 100);
    assert.equal(clampedPageSize?.pageCount, 1);

    assert.deepEqual(
        allResults.numericAggregates.map((aggregate) => ({
            versionId: aggregate.versionId,
            count: aggregate.count,
            unansweredCount: aggregate.unansweredCount,
            average: aggregate.average,
            median: aggregate.median,
        })),
        [
            {
                versionId: firstVersionId,
                count: 2,
                unansweredCount: 0,
                average: 5,
                median: 5,
            },
            {
                versionId: secondVersionId,
                count: 1,
                unansweredCount: 0,
                average: 10,
                median: 10,
            },
        ],
    );

    const firstVersionOnly = await getSurveyResponsePageAdmin({
        surveyId,
        versionId: firstVersionId,
    });
    assert.equal(firstVersionOnly?.appliedVersionId, firstVersionId);
    assert.equal(firstVersionOnly?.totalCount, 2);

    const foreignVersion = await getSurveyResponsePageAdmin({
        surveyId,
        versionId: foreignSurvey.versionId,
    });
    assert.equal(foreignVersion?.appliedVersionId, null);
    assert.equal(foreignVersion?.totalCount, 3);
    assert.ok(
        foreignVersion?.responses.every(
            ({ response }) => response.surveyId === surveyId,
        ),
    );

    const combined = await getSurveyResponsePageAdmin({
        surveyId,
        versionId: firstVersionId,
        accountId: secondUser.accountId,
        userId: secondUser.userId,
        monthKey: '2026-06',
        contextQuery: 'summer-beta',
        source: 'typeform',
        submittedFrom: new Date('2026-06-02T00:00:00.000Z'),
        submittedTo: new Date('2026-06-02T23:59:59.999Z'),
    });
    assert.equal(combined?.totalCount, 1);
    assert.equal(combined?.responses[0]?.response.id, secondResponseId);

    const monthResults = await getSurveyResponsePageAdmin({
        surveyId,
        monthKey: '2026-06',
    });
    const accountResults = await getSurveyResponsePageAdmin({
        surveyId,
        accountId: firstUser.accountId,
    });
    const sourceResults = await getSurveyResponsePageAdmin({
        surveyId,
        source: 'admin_import',
    });
    const userResults = await getSurveyResponsePageAdmin({
        surveyId,
        userId: secondUser.userId,
    });
    const fallbackUserResults = await getSurveyResponsePageAdmin({
        surveyId,
        userId: firstUser.userId,
    });
    const submittedFromResults = await getSurveyResponsePageAdmin({
        surveyId,
        submittedFrom: latestSubmittedAt,
    });
    const submittedToResults = await getSurveyResponsePageAdmin({
        surveyId,
        submittedTo: firstSubmittedAt,
    });
    const contextKeyResults = await getSurveyResponsePageAdmin({
        surveyId,
        contextQuery: 'delivery-alpha',
    });
    const contextJsonResults = await getSurveyResponsePageAdmin({
        surveyId,
        contextQuery: 'workflow-only-token',
    });
    const metadataResults = await getSurveyResponsePageAdmin({
        surveyId,
        contextQuery: 'summer-beta',
    });
    const literalContextResults = await getSurveyResponsePageAdmin({
        surveyId,
        contextQuery: 'rate_100%',
    });
    assert.equal(monthResults?.totalCount, 2);
    assert.equal(accountResults?.totalCount, 2);
    assert.equal(sourceResults?.totalCount, 1);
    assert.equal(sourceResults?.responses[0]?.response.id, thirdResponseId);
    assert.equal(userResults?.totalCount, 1);
    assert.equal(userResults?.responses[0]?.response.id, secondResponseId);
    assert.equal(fallbackUserResults?.totalCount, 2);
    assert.equal(submittedFromResults?.totalCount, 2);
    assert.equal(submittedToResults?.totalCount, 1);
    assert.equal(
        submittedToResults?.responses[0]?.response.id,
        firstResponseId,
    );
    assert.equal(contextKeyResults?.totalCount, 1);
    assert.equal(contextKeyResults?.responses[0]?.response.id, firstResponseId);
    assert.equal(contextJsonResults?.totalCount, 1);
    assert.equal(
        contextJsonResults?.responses[0]?.response.id,
        thirdResponseId,
    );
    assert.equal(metadataResults?.totalCount, 1);
    assert.equal(metadataResults?.responses[0]?.response.id, secondResponseId);
    assert.equal(literalContextResults?.totalCount, 1);
    assert.equal(
        literalContextResults?.responses[0]?.response.id,
        secondResponseId,
    );

    const detail = await getSurveyResponseAdmin({
        surveyId,
        responseId: secondResponseId,
    });
    assert.equal(detail?.version.id, firstVersionId);
    assert.equal(detail?.user?.id, secondUser.userId);
    assert.equal(detail?.answers.length, 3);
    assert.equal(
        await getSurveyResponseAdmin({
            surveyId: foreignSurvey.surveyId,
            responseId: secondResponseId,
        }),
        null,
    );
});

test('numeric aggregate helper counts skipped answers as unanswered', () => {
    const question = {
        id: 'question-score',
        key: 'score',
        type: 'opinion_scale',
        title: 'Score',
        description: null,
        sortOrder: 1,
        required: false,
        settings: { type: 'opinion_scale', min: 0, max: 10 },
        scoreMetadata: { internalScore: true },
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        versionId: 'version',
    } satisfies Awaited<ReturnType<typeof getSurveyQuestions>>[number];

    const aggregates = buildNumericAggregates(
        [question],
        [
            {
                response: {
                    id: 'response-1',
                    assignmentId: 'assignment-1',
                    surveyId: 'survey',
                    versionId: 'version',
                    accountId: 'account',
                    userId: 'user',
                    source: 'in_app',
                    status: 'submitted',
                    metadata: {},
                    importedExternalId: null,
                    startedAt: null,
                    submittedAt: new Date('2026-06-01T00:00:00.000Z'),
                    createdAt: new Date('2026-06-01T00:00:00.000Z'),
                },
                assignment: null,
                answers: [
                    {
                        id: 'answer-1',
                        responseId: 'response-1',
                        questionId: 'question-score',
                        questionKey: 'score',
                        type: 'opinion_scale',
                        numericValue: 4,
                        textValue: null,
                        contactValue: null,
                        skipped: false,
                        createdAt: new Date('2026-06-01T00:00:00.000Z'),
                    },
                ],
            },
            {
                response: {
                    id: 'response-2',
                    assignmentId: 'assignment-2',
                    surveyId: 'survey',
                    versionId: 'version',
                    accountId: 'account',
                    userId: 'user',
                    source: 'in_app',
                    status: 'submitted',
                    metadata: {},
                    importedExternalId: null,
                    startedAt: null,
                    submittedAt: new Date('2026-06-01T00:00:00.000Z'),
                    createdAt: new Date('2026-06-01T00:00:00.000Z'),
                },
                assignment: null,
                answers: [
                    {
                        id: 'answer-2',
                        responseId: 'response-2',
                        questionId: 'question-score',
                        questionKey: 'score',
                        type: 'opinion_scale',
                        numericValue: null,
                        textValue: null,
                        contactValue: null,
                        skipped: true,
                        createdAt: new Date('2026-06-01T00:00:00.000Z'),
                    },
                ],
            },
            {
                response: {
                    id: 'response-other-version',
                    assignmentId: null,
                    surveyId: 'survey',
                    versionId: 'other-version',
                    accountId: 'account',
                    userId: 'user',
                    source: 'in_app',
                    status: 'submitted',
                    metadata: {},
                    importedExternalId: null,
                    startedAt: null,
                    submittedAt: new Date('2026-06-01T00:00:00.000Z'),
                    createdAt: new Date('2026-06-01T00:00:00.000Z'),
                },
                assignment: null,
                answers: [],
            },
        ],
    );

    assert.deepEqual(aggregates, [
        {
            versionId: 'version',
            questionId: 'question-score',
            questionKey: 'score',
            title: 'Score',
            count: 1,
            unansweredCount: 1,
            average: 4,
            median: 4,
            distribution: { '4': 1 },
            scoreMetadata: { internalScore: true },
        },
    ]);
});
